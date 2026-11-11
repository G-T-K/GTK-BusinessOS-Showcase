export type PayrollComponentInput = {
  id: string;
  code: string;
  name: string;
  kind: "EARNING" | "OTHER_DEDUCTION";
  mode: "FIXED" | "VARIABLE";
  amount: number;
};

export type StatutoryRuleInput = {
  id: string;
  code: string;
  name: string;
  calculation: "PERCENTAGE" | "PROGRESSIVE";
  basis: "BASIC" | "GROSS" | "PAYE";
  ratePercent: number | null;
  bands: unknown;
};

export type PayrollItem = {
  kind: "EARNING" | "STATUTORY_DEDUCTION" | "OTHER_DEDUCTION";
  code: string;
  name: string;
  amount: number;
  ruleSnapshot?: Record<string, unknown>;
};

export type PayrollCalculation = {
  basic: number;
  gross: number;
  statutoryDeductions: number;
  otherDeductions: number;
  netPay: number;
  items: PayrollItem[];
};

type TaxBand = { upTo: number | null; ratePercent: number };

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseBands(bands: unknown): TaxBand[] {
  if (!Array.isArray(bands) || bands.length === 0) {
    throw new Error("Progressive statutory rule requires at least one configured band");
  }
  const parsed = bands.map((band) => {
    if (!band || typeof band !== "object" || !("ratePercent" in band) || !("upTo" in band)) {
      throw new Error("Invalid progressive statutory band");
    }
    const raw = band as { upTo: unknown; ratePercent: unknown };
    const upTo =
      raw.upTo === null || raw.upTo === undefined
        ? null
        : typeof raw.upTo === "number" && Number.isFinite(raw.upTo) && raw.upTo > 0
          ? raw.upTo
          : NaN;
    const ratePercent = raw.ratePercent;
    if (
      Number.isNaN(upTo) ||
      typeof ratePercent !== "number" ||
      !Number.isFinite(ratePercent) ||
      ratePercent < 0 ||
      ratePercent > 100
    ) {
      throw new Error("Invalid progressive statutory band");
    }
    return { upTo, ratePercent };
  });

  for (let index = 0; index < parsed.length; index++) {
    const band = parsed[index];
    if (index < parsed.length - 1 && band.upTo === null) {
      throw new Error("Only the final progressive band can have no upper limit");
    }
    if (index > 0 && (parsed[index - 1].upTo === null || parsed[index - 1].upTo! >= (band.upTo ?? Infinity))) {
      throw new Error("Progressive band limits must increase");
    }
  }
  if (parsed[parsed.length - 1].upTo !== null) {
    throw new Error("Final progressive band must have no upper limit");
  }
  return parsed;
}

function calculateRule(rule: StatutoryRuleInput, base: number) {
  if (base <= 0) return 0;
  if (rule.calculation === "PERCENTAGE") {
    if (rule.ratePercent === null || !Number.isFinite(rule.ratePercent) || rule.ratePercent < 0 || rule.ratePercent > 100) {
      throw new Error(`Configure a valid percentage for ${rule.name}`);
    }
    return roundMoney((base * rule.ratePercent) / 100);
  }

  const bands = parseBands(rule.bands);
  let lower = 0;
  let amount = 0;
  for (const band of bands) {
    const upper = band.upTo ?? base;
    const taxable = Math.max(0, Math.min(base, upper) - lower);
    amount += (taxable * band.ratePercent) / 100;
    if (base <= upper) break;
    lower = upper;
  }
  return roundMoney(amount);
}

export function calculatePayroll(
  basic: number,
  components: PayrollComponentInput[],
  rules: StatutoryRuleInput[],
  variableAmounts: Record<string, number> = {},
): PayrollCalculation {
  if (!Number.isFinite(basic) || basic < 0) throw new Error("Basic salary must be a non-negative number");

  const earnings = [
    { kind: "EARNING" as const, code: "BASIC", name: "Basic salary", amount: roundMoney(basic) },
  ];
  const deductions: PayrollItem[] = [];

  for (const component of components) {
    const supplied = variableAmounts[component.id];
    const amount =
      component.mode === "VARIABLE"
        ? roundMoney(supplied ?? 0)
        : roundMoney(component.amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 9_000_000_000_000_000) {
      throw new Error(`Invalid amount for ${component.name}`);
    }
    if (amount === 0) continue;
    if (component.kind === "EARNING") {
      earnings.push({ kind: "EARNING", code: component.code, name: component.name, amount });
    } else {
      deductions.push({ kind: "OTHER_DEDUCTION", code: component.code, name: component.name, amount });
    }
  }

  const gross = roundMoney(earnings.reduce((sum, item) => sum + item.amount, 0));
  const statutory: PayrollItem[] = [];
  let paye = 0;
  for (const rule of rules) {
    const base = rule.basis === "BASIC" ? basic : rule.basis === "GROSS" ? gross : paye;
    const amount = calculateRule(rule, base);
    if (rule.code.toUpperCase() === "PAYE") paye = amount;
    if (amount > 0) {
      statutory.push({
        kind: "STATUTORY_DEDUCTION",
        code: rule.code,
        name: rule.name,
        amount,
        ruleSnapshot: {
          calculation: rule.calculation,
          basis: rule.basis,
          ratePercent: rule.ratePercent,
          bands: rule.bands,
        },
      });
    }
  }

  const statutoryDeductions = roundMoney(statutory.reduce((sum, item) => sum + item.amount, 0));
  const otherDeductions = roundMoney(deductions.reduce((sum, item) => sum + item.amount, 0));
  const netPay = roundMoney(gross - statutoryDeductions - otherDeductions);
  if (netPay < 0) throw new Error("Total deductions exceed gross earnings");

  return {
    basic: roundMoney(basic),
    gross,
    statutoryDeductions,
    otherDeductions,
    netPay,
    items: [...earnings, ...statutory, ...deductions],
  };
}

export function validateStatutoryRuleConfiguration(input: {
  calculation: "PERCENTAGE" | "PROGRESSIVE";
  ratePercent?: number | null;
  bands?: unknown;
}) {
  if (input.calculation === "PERCENTAGE") {
    if (
      input.ratePercent === null ||
      input.ratePercent === undefined ||
      !Number.isFinite(input.ratePercent) ||
      input.ratePercent < 0 ||
      input.ratePercent > 100
    ) {
      throw new Error("Percentage rate must be between 0 and 100");
    }
    return;
  }
  parseBands(input.bands);
}
