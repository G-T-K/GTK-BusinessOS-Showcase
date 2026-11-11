import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculatePayroll,
  validateStatutoryRuleConfiguration,
  type PayrollComponentInput,
  type StatutoryRuleInput,
} from "./payroll-calculations";

const components: PayrollComponentInput[] = [
  { id: "housing", code: "HOUSE", name: "Housing", kind: "EARNING", mode: "FIXED", amount: 125 },
  { id: "overtime", code: "OT", name: "Overtime", kind: "EARNING", mode: "VARIABLE", amount: 0 },
  { id: "loan", code: "LOAN", name: "Loan", kind: "OTHER_DEDUCTION", mode: "FIXED", amount: 50 },
];

const rules: StatutoryRuleInput[] = [
  {
    id: "paye",
    code: "PAYE",
    name: "PAYE",
    calculation: "PROGRESSIVE",
    basis: "GROSS",
    ratePercent: null,
    bands: [{ upTo: 1000, ratePercent: 0 }, { upTo: null, ratePercent: 10 }],
  },
  {
    id: "aids",
    code: "AIDS",
    name: "AIDS levy",
    calculation: "PERCENTAGE",
    basis: "PAYE",
    ratePercent: 3,
    bands: null,
  },
];

test("payroll calculation combines fixed and variable components and configured deductions", () => {
  const result = calculatePayroll(1000, components, rules, { overtime: 75 });
  assert.equal(result.gross, 1200);
  assert.equal(result.statutoryDeductions, 20.6);
  assert.equal(result.otherDeductions, 50);
  assert.equal(result.netPay, 1129.4);
});

test("payroll calculation does not invent statutory deductions", () => {
  const result = calculatePayroll(1000, [], []);
  assert.equal(result.statutoryDeductions, 0);
  assert.equal(result.netPay, 1000);
});

test("progressive rule configuration rejects malformed or unordered bands", () => {
  assert.throws(
    () => validateStatutoryRuleConfiguration({ calculation: "PROGRESSIVE", bands: [{ upTo: 100, ratePercent: 5 }] }),
    /Final progressive band must have no upper limit/,
  );
  assert.throws(
    () => validateStatutoryRuleConfiguration({
      calculation: "PROGRESSIVE",
      bands: [{ upTo: 100, ratePercent: 5 }, { upTo: 90, ratePercent: 10 }],
    }),
    /limits must increase/,
  );
});

test("net pay cannot be negative", () => {
  assert.throws(
    () => calculatePayroll(100, [
      { id: "deduction", code: "DED", name: "Deduction", kind: "OTHER_DEDUCTION", mode: "FIXED", amount: 101 },
    ], []),
    /exceed gross/,
  );
});
