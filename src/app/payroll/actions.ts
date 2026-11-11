"use server";

import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import {
  EmploymentStatus,
  EmploymentType,
  PayrollCorrectionStatus,
  PayrollRunKind,
  PayrollRunStatus,
  SalaryComponentKind,
  SalaryComponentMode,
  StatutoryBasis,
  StatutoryCalculation,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import {
  calculatePayroll,
  validateStatutoryRuleConfiguration,
  type PayrollComponentInput,
  type StatutoryRuleInput,
} from "@/lib/payroll-calculations";
import { readFormDate, readFormNumber, readFormText } from "@/lib/form-data";

const MAX_AMOUNT = 9_000_000_000_000_000;

type PayrollFingerprintEmployee = {
  id: string;
  fullName: string;
  employeeNumber: string;
  basicSalary: number;
  salaryCurrency: string;
  departmentName: string | null;
  jobTitle: string;
  components: PayrollComponentInput[];
};

function payrollCalculationHash(rules: StatutoryRuleInput[], employees: PayrollFingerprintEmployee[]) {
  const canonicalEmployees = employees.map((employee) => ({
    ...employee,
    components: [...employee.components].sort((a, b) => a.id.localeCompare(b.id)),
  })).sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256").update(JSON.stringify({ rules, employees: canonicalEmployees })).digest("hex");
}

async function requirePayrollAdmin() {
  return requirePermission("payrollManage");
}

function readCurrency(formData: FormData, key = "currency") {
  const currency = readFormText(formData, key, "Currency", { required: true, maxLength: 3 }).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO code");
  return currency;
}

function readEnum<T extends string>(value: string, values: readonly T[], label: string): T {
  if (!values.includes(value as T)) throw new Error(`Choose a valid ${label}`);
  return value as T;
}

async function generatedEmployeeNumber(businessId: string, tx: Prisma.TransactionClient) {
  const year = new Date().getFullYear();
  const prefix = `EMP-${year}-`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${businessId}), hashtext(${prefix})) IS NULL`;
  const employees = await tx.employee.findMany({
    where: { businessId, employeeNumber: { startsWith: prefix } },
    select: { employeeNumber: true },
  });
  const latest = employees.reduce((max, employee) => {
    const suffix = employee.employeeNumber.slice(prefix.length);
    return /^\d+$/.test(suffix) ? Math.max(max, Number(suffix)) : max;
  }, 0);
  return `${prefix}${String(latest + 1).padStart(4, "0")}`;
}

function employeeValues(formData: FormData) {
  const fullName = readFormText(formData, "fullName", "Full name", { required: true, maxLength: 120 });
  const nationalId = readFormText(formData, "nationalId", "National ID", { maxLength: 80 }) || null;
  const phone = readFormText(formData, "phone", "Phone number", { maxLength: 40 }) || null;
  const email = readFormText(formData, "email", "Email", { maxLength: 254 }).toLowerCase() || null;
  const address = readFormText(formData, "address", "Address", { maxLength: 500 }) || null;
  const departmentId = readFormText(formData, "departmentId", "Department", { maxLength: 64 }) || null;
  const jobTitle = readFormText(formData, "jobTitle", "Job title", { required: true, maxLength: 120 });
  const employmentDate = readFormDate(formData, "employmentDate", "employment date");
  const employmentType = readEnum(
    readFormText(formData, "employmentType", "Employment type", { required: true }),
    Object.values(EmploymentType),
    "employment type",
  );
  const basicSalary = readFormNumber(formData, "basicSalary", "Basic salary", {
    min: 0,
    max: MAX_AMOUNT,
    decimalPlaces: 2,
  });
  const salaryCurrency = readCurrency(formData, "salaryCurrency");
  const userId = readFormText(formData, "userId", "Login account", { maxLength: 64 }) || null;
  const status = readEnum(
    readFormText(formData, "status", "Employment status") || "ACTIVE",
    Object.values(EmploymentStatus),
    "employment status",
  );
  const bankName = readFormText(formData, "bankName", "Bank name", { maxLength: 120 }) || null;
  const bankAccountName = readFormText(formData, "bankAccountName", "Bank account name", { maxLength: 120 }) || null;
  const bankAccountNumber = readFormText(formData, "bankAccountNumber", "Bank account number", { maxLength: 80 }) || null;
  const mobileMoneyProvider = readFormText(formData, "mobileMoneyProvider", "Mobile money provider", { maxLength: 80 }) || null;
  const mobileMoneyNumber = readFormText(formData, "mobileMoneyNumber", "Mobile money number", { maxLength: 40 }) || null;
  const taxNumber = readFormText(formData, "taxNumber", "Tax number", { maxLength: 80 }) || null;
  const nssaNumber = readFormText(formData, "nssaNumber", "NSSA number", { maxLength: 80 }) || null;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid employee email address");
  return {
    fullName,
    nationalId,
    phone,
    email,
    address,
    departmentId,
    jobTitle,
    employmentDate,
    employmentType,
    basicSalary,
    salaryCurrency,
    userId,
    status,
    bankName,
    bankAccountName,
    bankAccountNumber,
    mobileMoneyProvider,
    mobileMoneyNumber,
    taxNumber,
    nssaNumber,
  };
}

async function assertEmployeeReferences(businessId: string, departmentId: string | null, userId: string | null) {
  if (departmentId) {
    const department = await prisma.department.findFirst({ where: { id: departmentId, businessId, active: true } });
    if (!department) throw new Error("Choose an active department from this business");
  }
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new Error("Selected login account was not found");
    const membership = await prisma.membership.findUnique({
      where: { userId_businessId: { userId, businessId } },
      select: { active: true },
    });
    if (membership && !membership.active) {
      throw new Error("The selected login account has an inactive membership in this business");
    }
  }
}

export async function createEmployee(formData: FormData) {
  const { businessId, userId: actorId } = await requirePayrollAdmin();
  const values = employeeValues(formData);
  await assertEmployeeReferences(businessId, values.departmentId, values.userId);

  const employee = await prisma.$transaction(async (tx) => {
    const employeeNumber = await generatedEmployeeNumber(businessId, tx);
    const created = await tx.employee.create({
      data: { businessId, employeeNumber, ...values },
    });
    if (values.userId) {
      await tx.membership.upsert({
        where: { userId_businessId: { userId: values.userId, businessId } },
        update: {},
        create: { userId: values.userId, businessId, role: "EMPLOYEE" },
      });
    }
    return created;
  });

  await logAction({
    businessId,
    userId: actorId,
    action: "payroll.employee_created",
    entityType: "Employee",
    entityId: employee.id,
    metadata: { employeeNumber: employee.employeeNumber, salaryCurrency: employee.salaryCurrency },
  });
  revalidatePath("/payroll/employees");
  redirect(`/payroll/employees/${employee.id}`);
}

export async function updateEmployee(formData: FormData) {
  const { businessId, userId: actorId } = await requirePayrollAdmin();
  const employeeId = readFormText(formData, "employeeId", "Employee", { required: true, maxLength: 64 });
  const values = employeeValues(formData);
  await assertEmployeeReferences(businessId, values.departmentId, values.userId);
  const existing = await prisma.employee.findFirst({ where: { id: employeeId, businessId } });
  if (!existing) throw new Error("Employee not found");

  const employee = await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: existing.id },
      data: values,
    });
    if (values.userId) {
      await tx.membership.upsert({
        where: { userId_businessId: { userId: values.userId, businessId } },
        update: {},
        create: { userId: values.userId, businessId, role: "EMPLOYEE" },
      });
    }
    return updated;
  });

  if (
    Number(existing.basicSalary) !== values.basicSalary ||
    existing.salaryCurrency !== values.salaryCurrency
  ) {
    await logAction({
      businessId,
      userId: actorId,
      action: "payroll.employee_salary_changed",
      entityType: "Employee",
      entityId: employee.id,
      metadata: {
        employeeNumber: employee.employeeNumber,
        oldBasicSalary: Number(existing.basicSalary),
        newBasicSalary: values.basicSalary,
        oldCurrency: existing.salaryCurrency,
        newCurrency: values.salaryCurrency,
      },
    });
  }
  await logAction({
    businessId,
    userId: actorId,
    action: "payroll.employee_updated",
    entityType: "Employee",
    entityId: employee.id,
    metadata: { employeeNumber: employee.employeeNumber },
  });
  revalidatePath("/payroll/employees");
  revalidatePath(`/payroll/employees/${employee.id}`);
  redirect(`/payroll/employees/${employee.id}`);
}

export async function deactivateEmployee(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const employeeId = readFormText(formData, "employeeId", "Employee", { required: true, maxLength: 64 });
  const updated = await prisma.employee.updateMany({
    where: { id: employeeId, businessId, status: "ACTIVE" },
    data: { status: "INACTIVE" },
  });
  if (updated.count !== 1) throw new Error("Active employee not found");
  await logAction({ businessId, userId, action: "payroll.employee_deactivated", entityType: "Employee", entityId: employeeId });
  revalidatePath("/payroll/employees");
}

export async function createDepartment(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const name = readFormText(formData, "name", "Department name", { required: true, maxLength: 100 });
  const department = await prisma.department.create({ data: { businessId, name } });
  await logAction({ businessId, userId, action: "payroll.department_created", entityType: "Department", entityId: department.id, metadata: { name } });
  revalidatePath("/payroll/employees/new");
  revalidatePath("/payroll/employees");
  redirect("/payroll/employees");
}

export async function createSalaryComponent(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const code = readFormText(formData, "code", "Component code", { required: true, maxLength: 30 }).toUpperCase();
  const name = readFormText(formData, "name", "Component name", { required: true, maxLength: 100 });
  const kind = readEnum(
    readFormText(formData, "kind", "Component type", { required: true }),
    Object.values(SalaryComponentKind),
    "component type",
  );
  const mode = readEnum(
    readFormText(formData, "mode", "Component mode", { required: true }),
    Object.values(SalaryComponentMode),
    "component mode",
  );
  const component = await prisma.salaryComponent.create({ data: { businessId, code, name, kind, mode } });
  await logAction({ businessId, userId, action: "payroll.salary_component_created", entityType: "SalaryComponent", entityId: component.id, metadata: { code, kind, mode } });
  revalidatePath("/payroll/components");
  revalidatePath("/payroll/employees");
  redirect("/payroll/components");
}

export async function deactivateSalaryComponent(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const componentId = readFormText(formData, "componentId", "Salary component", { required: true, maxLength: 64 });
  const component = await prisma.salaryComponent.updateMany({
    where: { id: componentId, businessId, active: true },
    data: { active: false },
  });
  if (component.count !== 1) throw new Error("Active salary component not found");
  await logAction({ businessId, userId, action: "payroll.salary_component_deactivated", entityType: "SalaryComponent", entityId: componentId });
  revalidatePath("/payroll/components");
  revalidatePath("/payroll/runs/new");
}

export async function assignSalaryComponent(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const employeeId = readFormText(formData, "employeeId", "Employee", { required: true, maxLength: 64 });
  const componentId = readFormText(formData, "componentId", "Salary component", { required: true, maxLength: 64 });
  const amount = readFormNumber(formData, "amount", "Component amount", { min: 0, max: MAX_AMOUNT, decimalPlaces: 2 });
  const effectiveFrom = readFormDate(formData, "effectiveFrom", "effective-from date");
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, businessId } });
  const component = await prisma.salaryComponent.findFirst({ where: { id: componentId, businessId, active: true } });
  if (!employee || !component) throw new Error("Employee or salary component not found");

  const assignment = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${employeeId}), hashtext(${componentId})) IS NULL`;
    const existing = await tx.employeeSalaryComponent.findMany({
      where: { employeeId, componentId },
      select: { id: true, effectiveFrom: true, effectiveTo: true },
    });
    const dayBeforeStart = new Date(effectiveFrom);
    dayBeforeStart.setUTCDate(dayBeforeStart.getUTCDate() - 1);
    for (const prior of existing) {
      const overlaps = !prior.effectiveTo || prior.effectiveTo >= effectiveFrom;
      if (!overlaps) continue;
      if (prior.effectiveFrom >= effectiveFrom) {
        throw new Error("A salary component assignment already starts on or after this effective date");
      }
      await tx.employeeSalaryComponent.update({
        where: { id: prior.id },
        data: { effectiveTo: dayBeforeStart },
      });
    }
    return tx.employeeSalaryComponent.create({
      data: { employeeId, componentId, amount, effectiveFrom },
    });
  });
  await logAction({
    businessId,
    userId,
    action: "payroll.salary_component_assigned",
    entityType: "EmployeeSalaryComponent",
    entityId: assignment.id,
    metadata: { employeeNumber: employee.employeeNumber, componentCode: component.code, amount, effectiveFrom: effectiveFrom.toISOString().slice(0, 10) },
  });
  revalidatePath(`/payroll/employees/${employeeId}`);
  redirect(`/payroll/employees/${employeeId}`);
}

export async function createStatutoryRule(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const code = readFormText(formData, "code", "Rule code", { required: true, maxLength: 30 }).toUpperCase();
  const name = readFormText(formData, "name", "Rule name", { required: true, maxLength: 100 });
  const currency = readCurrency(formData);
  const calculation = readEnum(readFormText(formData, "calculation", "Calculation", { required: true }), Object.values(StatutoryCalculation), "calculation");
  const basis = readEnum(readFormText(formData, "basis", "Calculation basis", { required: true }), Object.values(StatutoryBasis), "calculation basis");
  const ratePercent = calculation === "PERCENTAGE"
    ? readFormNumber(formData, "ratePercent", "Rate percentage", { min: 0, max: 100, decimalPlaces: 6 })
    : null;
  const bandsRaw = readFormText(formData, "bands", "Progressive bands", { maxLength: 5000 });
  let bands: unknown = null;
  if (calculation === "PROGRESSIVE") {
    try {
      bands = JSON.parse(bandsRaw);
    } catch {
      throw new Error("Enter progressive bands as valid JSON");
    }
  }
  validateStatutoryRuleConfiguration({ calculation, ratePercent, bands });
  const effectiveFrom = readFormDate(formData, "effectiveFrom", "effective-from date");
  const effectiveTo = readFormDate(formData, "effectiveTo", "effective-to date", true);
  if (effectiveTo && effectiveTo < effectiveFrom) throw new Error("Effective-to date must not be before effective-from date");
  const overlappingRule = await prisma.statutoryRule.findFirst({
    where: {
      businessId,
      code,
      currency,
      active: true,
      effectiveFrom: { lte: effectiveTo ?? new Date("9999-12-31T00:00:00.000Z") },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    },
    select: { id: true },
  });
  if (overlappingRule) {
    throw new Error("This statutory rule overlaps an existing active effective period for the same code and currency");
  }

  const rule = await prisma.statutoryRule.create({
    data: {
      businessId,
      code,
      name,
      currency,
      calculation,
      basis,
      ratePercent,
      bands: bands === null ? Prisma.DbNull : bands as Prisma.InputJsonValue,
      effectiveFrom,
      effectiveTo,
    },
  });
  await logAction({
    businessId,
    userId,
    action: "payroll.statutory_rule_created",
    entityType: "StatutoryRule",
    entityId: rule.id,
    metadata: { code, currency, calculation, basis, effectiveFrom: effectiveFrom.toISOString().slice(0, 10), effectiveTo: effectiveTo?.toISOString().slice(0, 10) ?? null },
  });
  revalidatePath("/payroll/statutory");
  redirect("/payroll/statutory");
}

export async function closeStatutoryRule(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const ruleId = readFormText(formData, "ruleId", "Statutory rule", { required: true, maxLength: 64 });
  const effectiveTo = readFormDate(formData, "effectiveTo", "effective-to date");
  const rule = await prisma.statutoryRule.findFirst({
    where: { id: ruleId, businessId, active: true },
    select: { id: true, code: true, currency: true, effectiveFrom: true, effectiveTo: true },
  });
  if (!rule) throw new Error("Active statutory rule not found");
  if (effectiveTo < rule.effectiveFrom) throw new Error("Effective-to date must not be before effective-from date");
  if (rule.effectiveTo && effectiveTo > rule.effectiveTo) {
    throw new Error("A rule's effective end date cannot be extended through this action");
  }
  const nextRule = await prisma.statutoryRule.findFirst({
    where: {
      businessId,
      code: rule.code,
      currency: rule.currency,
      active: true,
      id: { not: rule.id },
      effectiveFrom: { gt: rule.effectiveFrom, lte: effectiveTo },
    },
    select: { id: true },
  });
  if (nextRule) throw new Error("Choose an end date before the next effective rule");
  const updated = await prisma.statutoryRule.updateMany({
    where: { id: rule.id, businessId, active: true },
    data: { effectiveTo },
  });
  if (updated.count !== 1) throw new Error("Statutory rule changed while it was being updated");
  await logAction({
    businessId,
    userId,
    action: "payroll.statutory_rule_closed",
    entityType: "StatutoryRule",
    entityId: rule.id,
    metadata: { code: rule.code, currency: rule.currency, effectiveTo: effectiveTo.toISOString().slice(0, 10) },
  });
  revalidatePath("/payroll/statutory");
}

export async function deactivateStatutoryRule(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const ruleId = readFormText(formData, "ruleId", "Statutory rule", { required: true, maxLength: 64 });
  const updated = await prisma.statutoryRule.updateMany({
    where: { id: ruleId, businessId, active: true },
    data: { active: false },
  });
  if (updated.count !== 1) throw new Error("Active statutory rule not found");
  await logAction({ businessId, userId, action: "payroll.statutory_rule_deactivated", entityType: "StatutoryRule", entityId: ruleId });
  revalidatePath("/payroll/statutory");
}

async function effectiveRules(businessId: string, currency: string, periodEnd: Date) {
  const rules = await prisma.statutoryRule.findMany({
    where: {
      businessId,
      currency,
      active: true,
      effectiveFrom: { lte: periodEnd },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodEnd } }],
    },
    orderBy: [{ code: "asc" }, { effectiveFrom: "desc" }],
  });
  const seen = new Set<string>();
  const selected = rules.filter((rule) => {
    if (seen.has(rule.code)) return false;
    seen.add(rule.code);
    return true;
  });
  return selected.sort((a, b) => {
    if (a.code.toUpperCase() === "PAYE") return -1;
    if (b.code.toUpperCase() === "PAYE") return 1;
    return a.code.localeCompare(b.code);
  }).map((rule) => ({
    id: rule.id,
    code: rule.code,
    name: rule.name,
    calculation: rule.calculation,
    basis: rule.basis,
    ratePercent: rule.ratePercent === null ? null : Number(rule.ratePercent),
    bands: rule.bands,
  }));
}

export async function createPayrollDraft(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const year = readFormNumber(formData, "year", "Payroll year", { min: 2000, max: 2200, decimalPlaces: 0 });
  const month = readFormNumber(formData, "month", "Payroll month", { min: 1, max: 12, decimalPlaces: 0 });
  const currency = readCurrency(formData);
  const payDate = readFormDate(formData, "payDate", "pay date", true);
  const employeeIds = [...new Set(formData.getAll("employeeIds").map((value) => {
    if (typeof value !== "string" || value.length > 64) throw new Error("Invalid employee selection");
    return value;
  }).filter(Boolean))];
  if (employeeIds.length === 0 || employeeIds.length > 500) throw new Error("Select between 1 and 500 employees");
  const periodEnd = new Date(Date.UTC(year, month, 0));
  if (payDate && (payDate.getUTCFullYear() !== year || payDate.getUTCMonth() + 1 !== month)) {
    throw new Error("Pay date must be within the selected payroll month");
  }

  const employees = await prisma.employee.findMany({
    where: { businessId, id: { in: employeeIds }, status: "ACTIVE", salaryCurrency: currency },
    include: {
      department: { select: { name: true } },
      salaryComponents: {
        where: { effectiveFrom: { lte: periodEnd }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodEnd } }] },
        include: { component: true },
      },
    },
  });
  if (employees.length !== employeeIds.length) throw new Error("Every selected employee must be active and paid in the selected currency");
  const rules = await effectiveRules(businessId, currency, periodEnd);
  const employeeInputs = employees.map((employee) => {
    const components = employee.salaryComponents
      .filter((entry) => entry.component.active)
      .map((entry) => ({
        id: entry.componentId,
        code: entry.component.code,
        name: entry.component.name,
        kind: entry.component.kind,
        mode: entry.component.mode,
        amount: Number(entry.amount),
      }));
    const variableAmounts: Record<string, number> = {};
    for (const component of components.filter((item) => item.mode === "VARIABLE")) {
      const key = `variable_${employee.id}_${component.id}`;
      const raw = formData.get(key);
      if (raw === null || raw === "") {
        variableAmounts[component.id] = 0;
      } else {
        variableAmounts[component.id] = readFormNumber(formData, key, `${employee.fullName} ${component.name}`, {
          min: 0,
          max: MAX_AMOUNT,
          decimalPlaces: 2,
        });
      }
    }
    return { employee, components, variableAmounts, calculation: calculatePayroll(Number(employee.basicSalary), components, rules, variableAmounts) };
  });
  const calculationHash = payrollCalculationHash(rules, employeeInputs.map(({ employee, components }) => ({
    id: employee.id,
    fullName: employee.fullName,
    employeeNumber: employee.employeeNumber,
    basicSalary: Number(employee.basicSalary),
    salaryCurrency: employee.salaryCurrency,
    departmentName: employee.department?.name ?? null,
    jobTitle: employee.jobTitle,
    components,
  })));

  const run = await prisma.$transaction(async (tx) => {
    const prefix = `PR-${year}${String(month).padStart(2, "0")}-${currency}-`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${businessId}), hashtext(${prefix})) IS NULL`;
    const references = await tx.payrollRun.findMany({
      where: { businessId, reference: { startsWith: prefix } },
      select: { reference: true },
    });
    const latest = references.reduce((max, entry) => {
      const suffix = entry.reference.slice(prefix.length);
      return /^\d+$/.test(suffix) ? Math.max(max, Number(suffix)) : max;
    }, 0);
    const reference = `${prefix}${String(latest + 1).padStart(3, "0")}`;
    return tx.payrollRun.create({
      data: {
        businessId,
        reference,
        year,
        month,
        currency,
        calculationHash,
        kind: PayrollRunKind.REGULAR,
        status: PayrollRunStatus.DRAFT,
        payDate,
        employeeCount: employeeInputs.length,
        grossTotal: employeeInputs.reduce((sum, item) => sum + item.calculation.gross, 0),
        statutoryTotal: employeeInputs.reduce((sum, item) => sum + item.calculation.statutoryDeductions, 0),
        otherDeductionTotal: employeeInputs.reduce((sum, item) => sum + item.calculation.otherDeductions, 0),
        netTotal: employeeInputs.reduce((sum, item) => sum + item.calculation.netPay, 0),
        createdById: userId,
        lines: {
          create: employeeInputs.map(({ employee, calculation, components }) => ({
            employeeId: employee.id,
            employeeNumber: employee.employeeNumber,
            employeeName: employee.fullName,
            departmentName: employee.department?.name ?? null,
            jobTitle: employee.jobTitle,
            basicSalary: calculation.basic,
            gross: calculation.gross,
            statutoryDeductions: calculation.statutoryDeductions,
            otherDeductions: calculation.otherDeductions,
            netPay: calculation.netPay,
            items: {
              create: calculation.items.map((item) => ({
                kind: item.kind,
                code: item.code,
                name: item.name,
                amount: item.amount,
                ruleSnapshot: item.ruleSnapshot as object | undefined,
                componentId: components.find((component) => component.code === item.code)?.id ?? null,
                isEditable: item.kind === "EARNING" && item.code !== "BASIC"
                  ? components.some((component) => component.code === item.code && component.mode === "VARIABLE")
                  : item.kind === "OTHER_DEDUCTION" && components.some((component) => component.code === item.code && component.mode === "VARIABLE"),
              })),
            },
          })),
        },
      },
    });
  });
  await logAction({
    businessId,
    userId,
    action: "payroll.draft_created",
    entityType: "PayrollRun",
    entityId: run.id,
    metadata: { reference: run.reference, year, month, currency, employeeCount: employees.length, statutoryRuleIds: rules.map((rule) => rule.id) },
  });
  revalidatePath("/payroll");
  revalidatePath("/payroll/runs");
  redirect(`/payroll/runs/${run.id}`);
}

export async function updatePayrollLine(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const runId = readFormText(formData, "runId", "Payroll run", { required: true, maxLength: 64 });
  const lineId = readFormText(formData, "lineId", "Payroll line", { required: true, maxLength: 64 });
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, businessId, status: "DRAFT" },
    include: {
      lines: { where: { id: lineId }, include: { employee: { include: { department: true, salaryComponents: { include: { component: true } } } }, items: true } },
    },
  });
  const line = run?.lines[0];
  if (!run || !line) throw new Error("Draft payroll line not found");
  const periodEnd = new Date(Date.UTC(run.year, run.month, 0));
  const components = line.employee.salaryComponents
    .filter((entry) => entry.component.active && entry.effectiveFrom <= periodEnd && (!entry.effectiveTo || entry.effectiveTo >= periodEnd))
    .map((entry) => ({
      id: entry.componentId,
      code: entry.component.code,
      name: entry.component.name,
      kind: entry.component.kind,
      mode: entry.component.mode,
      amount: Number(entry.amount),
    }));
  const variableAmounts: Record<string, number> = {};
  for (const component of components.filter((item) => item.mode === "VARIABLE")) {
    const key = `variable_${component.id}`;
    const raw = formData.get(key);
    variableAmounts[component.id] = raw === null || raw === ""
      ? 0
      : readFormNumber(formData, key, component.name, { min: 0, max: MAX_AMOUNT, decimalPlaces: 2 });
  }
  const rules = await effectiveRules(businessId, run.currency, periodEnd);
  const calculation = calculatePayroll(Number(line.employee.basicSalary), components, rules, variableAmounts);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "PayrollRun" WHERE "id" = ${run.id} AND "businessId" = ${businessId} FOR UPDATE`;
    const stillDraft = await tx.payrollRun.findFirst({
      where: { id: run.id, businessId, status: "DRAFT" },
      select: { id: true },
    });
    if (!stillDraft) throw new Error("Payroll run is no longer a draft");
    await tx.payrollLineItem.deleteMany({ where: { payrollLineId: line.id } });
    await tx.payrollLine.update({
      where: { id: line.id },
      data: {
        basicSalary: calculation.basic,
        gross: calculation.gross,
        statutoryDeductions: calculation.statutoryDeductions,
        otherDeductions: calculation.otherDeductions,
        netPay: calculation.netPay,
        items: {
          create: calculation.items.map((item) => ({
            kind: item.kind,
            code: item.code,
            name: item.name,
            amount: item.amount,
            ruleSnapshot: item.ruleSnapshot as object | undefined,
            componentId: components.find((component) => component.code === item.code)?.id ?? null,
            isEditable: item.kind === "EARNING" && item.code !== "BASIC"
              ? components.some((component) => component.code === item.code && component.mode === "VARIABLE")
              : item.kind === "OTHER_DEDUCTION" && components.some((component) => component.code === item.code && component.mode === "VARIABLE"),
          })),
        },
      },
    });
    const aggregate = await tx.payrollLine.aggregate({
      where: { payrollRunId: run.id },
      _sum: { gross: true, statutoryDeductions: true, otherDeductions: true, netPay: true },
    });
    await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        grossTotal: aggregate._sum.gross ?? 0,
        statutoryTotal: aggregate._sum.statutoryDeductions ?? 0,
        otherDeductionTotal: aggregate._sum.otherDeductions ?? 0,
        netTotal: aggregate._sum.netPay ?? 0,
      },
    });
  });
  await logAction({ businessId, userId, action: "payroll.draft_line_updated", entityType: "PayrollLine", entityId: line.id, metadata: { runReference: run.reference } });
  revalidatePath(`/payroll/runs/${run.id}`);
}

export async function approvePayrollRun(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const runId = readFormText(formData, "runId", "Payroll run", { required: true, maxLength: 64 });
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, businessId, status: "DRAFT" } });
  if (!run) throw new Error("Draft payroll run not found");
  const periodEnd = new Date(Date.UTC(run.year, run.month, 0));
  const rules = await effectiveRules(businessId, run.currency, periodEnd);
  if (rules.length === 0) throw new Error("Configure and review effective statutory rules before approving payroll");
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "PayrollRun" WHERE "id" = ${runId} AND "businessId" = ${businessId} FOR UPDATE`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${businessId}), hashtext(${`${run.year}-${run.month}-${run.currency}`})) IS NULL`;
    const draft = await tx.payrollRun.findFirst({
      where: { id: runId, businessId, status: "DRAFT" },
      include: { lines: { select: { employeeId: true } } },
    });
    if (!draft) return 0;
    const employeeIds = draft.lines.map((line) => line.employeeId);
    const existingApproved = await tx.payrollLine.findFirst({
      where: {
        employeeId: { in: employeeIds },
        payrollRun: {
          businessId,
          year: run.year,
          month: run.month,
          currency: run.currency,
          kind: "REGULAR",
          status: { in: ["APPROVED", "PAID"] },
        },
      },
      select: { employeeNumber: true },
    });
    if (existingApproved) {
      throw new Error(`Employee ${existingApproved.employeeNumber} already has approved payroll for this period and currency`);
    }
    const currentEmployees = await tx.employee.findMany({
      where: { businessId, id: { in: employeeIds }, status: "ACTIVE", salaryCurrency: run.currency },
      include: {
        department: { select: { name: true } },
        salaryComponents: {
          where: { effectiveFrom: { lte: periodEnd }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodEnd } }] },
          include: { component: true },
        },
      },
    });
    if (currentEmployees.length !== employeeIds.length) {
      throw new Error("Employee eligibility changed after draft creation. Delete and regenerate the draft.");
    }
    const currentHash = payrollCalculationHash(rules, currentEmployees.map((employee) => ({
      id: employee.id,
      fullName: employee.fullName,
      employeeNumber: employee.employeeNumber,
      basicSalary: Number(employee.basicSalary),
      salaryCurrency: employee.salaryCurrency,
      departmentName: employee.department?.name ?? null,
      jobTitle: employee.jobTitle,
      components: employee.salaryComponents.filter((entry) => entry.component.active).map((entry) => ({
        id: entry.componentId,
        code: entry.component.code,
        name: entry.component.name,
        kind: entry.component.kind,
        mode: entry.component.mode,
        amount: Number(entry.amount),
      })),
    })));
    if (currentHash !== run.calculationHash) {
      throw new Error("Employee pay or statutory settings changed after draft creation. Delete and regenerate the draft for review.");
    }
    const result = await tx.payrollRun.updateMany({
      where: { id: runId, businessId, status: "DRAFT" },
      data: { status: "APPROVED", approvedById: userId, approvedAt: new Date() },
    });
    return result.count;
  });
  if (updated !== 1) throw new Error("Payroll run changed during approval. Refresh and try again.");
  await logAction({ businessId, userId, action: "payroll.run_approved", entityType: "PayrollRun", entityId: run.id, metadata: { reference: run.reference, gross: Number(run.grossTotal), net: Number(run.netTotal), currency: run.currency } });
  revalidatePath("/payroll");
  revalidatePath("/payroll/runs");
  revalidatePath(`/payroll/runs/${run.id}`);
}

export async function markPayrollRunPaid(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const runId = readFormText(formData, "runId", "Payroll run", { required: true, maxLength: 64 });
  const payDate = readFormDate(formData, "payDate", "payment date");
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, businessId, status: "APPROVED" } });
  if (!run) throw new Error("Approved payroll run not found");
  const updated = await prisma.payrollRun.updateMany({
    where: { id: run.id, businessId, status: "APPROVED" },
    data: { status: "PAID", payDate, paidById: userId, paidAt: new Date() },
  });
  if (updated.count !== 1) throw new Error("Payroll run changed during payment. Refresh and try again.");
  await logAction({ businessId, userId, action: "payroll.run_marked_paid", entityType: "PayrollRun", entityId: run.id, metadata: { reference: run.reference, paymentDate: payDate.toISOString().slice(0, 10), net: Number(run.netTotal), currency: run.currency } });
  revalidatePath("/payroll");
  revalidatePath("/payroll/runs");
  revalidatePath(`/payroll/runs/${run.id}`);
  revalidatePath("/reports");
}

export async function createPayrollCorrection(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const runId = readFormText(formData, "runId", "Payroll run", { required: true, maxLength: 64 });
  const lineId = readFormText(formData, "lineId", "Payroll line", { required: true, maxLength: 64 });
  const reason = readFormText(formData, "reason", "Correction reason", { required: true, maxLength: 500 });
  const earningsDelta = readFormNumber(formData, "earningsDelta", "Earnings adjustment", { min: -MAX_AMOUNT, max: MAX_AMOUNT, decimalPlaces: 2 });
  const deductionsDelta = readFormNumber(formData, "deductionsDelta", "Deduction adjustment", { min: -MAX_AMOUNT, max: MAX_AMOUNT, decimalPlaces: 2 });
  if (earningsDelta === 0 && deductionsDelta === 0) throw new Error("Enter an earnings or deduction adjustment");
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, businessId, status: { in: ["APPROVED", "PAID"] } },
    include: { lines: { where: { id: lineId } } },
  });
  const line = run?.lines[0];
  if (!run || !line) throw new Error("Approved payroll line not found");
  if (Number(line.netPay) + earningsDelta - deductionsDelta < 0) throw new Error("Correction cannot make net pay negative");
  const correction = await prisma.payrollCorrection.create({
    data: {
      payrollRunId: run.id,
      payrollLineId: line.id,
      employeeId: line.employeeId,
      reason,
      earningsDelta,
      deductionsDelta,
      createdById: userId,
    },
  });
  await logAction({ businessId, userId, action: "payroll.correction_created", entityType: "PayrollCorrection", entityId: correction.id, metadata: { runReference: run.reference, employeeNumber: line.employeeNumber, reason, earningsDelta, deductionsDelta } });
  revalidatePath(`/payroll/runs/${run.id}`);
}

export async function approvePayrollCorrection(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const correctionId = readFormText(formData, "correctionId", "Correction", { required: true, maxLength: 64 });
  const correction = await prisma.payrollCorrection.findFirst({
    where: { id: correctionId, payrollRun: { businessId }, status: PayrollCorrectionStatus.DRAFT },
  });
  if (!correction) throw new Error("Draft correction not found");
  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${correction.payrollLineId}), hashtext('payroll-correction')) IS NULL`;
    const [line, approvedDeltas] = await Promise.all([
      tx.payrollLine.findUnique({ where: { id: correction.payrollLineId }, select: { netPay: true } }),
      tx.payrollCorrection.aggregate({
        where: { payrollLineId: correction.payrollLineId, status: { in: ["APPROVED", "PAID"] } },
        _sum: { earningsDelta: true, deductionsDelta: true },
      }),
    ]);
    if (!line) throw new Error("Payroll line for correction not found");
    const correctedNet = Number(line.netPay)
      + Number(approvedDeltas._sum.earningsDelta ?? 0)
      - Number(approvedDeltas._sum.deductionsDelta ?? 0)
      + Number(correction.earningsDelta)
      - Number(correction.deductionsDelta);
    if (correctedNet < 0) throw new Error("Approved corrections cannot make employee net pay negative");
    const result = await tx.payrollCorrection.updateMany({
      where: { id: correctionId, status: "DRAFT", payrollRun: { businessId } },
      data: { status: "APPROVED", approvedById: userId, approvedAt: new Date() },
    });
    return result.count;
  });
  if (updated !== 1) throw new Error("Correction changed during approval");
  await logAction({ businessId, userId, action: "payroll.correction_approved", entityType: "PayrollCorrection", entityId: correction.id, metadata: { earningsDelta: Number(correction.earningsDelta), deductionsDelta: Number(correction.deductionsDelta) } });
  revalidatePath("/payroll/runs");
  revalidatePath(`/payroll/runs/${correction.payrollRunId}`);
}

export async function deleteDraftPayrollCorrection(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const correctionId = readFormText(formData, "correctionId", "Correction", { required: true, maxLength: 64 });
  const correction = await prisma.payrollCorrection.findFirst({
    where: { id: correctionId, status: "DRAFT", payrollRun: { businessId } },
    include: {
      payrollRun: { select: { id: true, reference: true } },
      employee: { select: { employeeNumber: true } },
    },
  });
  if (!correction) throw new Error("Draft correction not found");
  const deleted = await prisma.payrollCorrection.deleteMany({
    where: { id: correctionId, status: "DRAFT", payrollRun: { businessId } },
  });
  if (deleted.count !== 1) throw new Error("Correction changed before it could be deleted");
  await logAction({
    businessId,
    userId,
    action: "payroll.correction_draft_deleted",
    entityType: "PayrollCorrection",
    entityId: correctionId,
    metadata: {
      runReference: correction.payrollRun.reference,
      employeeNumber: correction.employee.employeeNumber,
      reason: correction.reason,
      earningsDelta: Number(correction.earningsDelta),
      deductionsDelta: Number(correction.deductionsDelta),
    },
  });
  revalidatePath(`/payroll/runs/${correction.payrollRun.id}`);
}

export async function markPayrollCorrectionPaid(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const correctionId = readFormText(formData, "correctionId", "Correction", { required: true, maxLength: 64 });
  const correction = await prisma.payrollCorrection.findFirst({
    where: { id: correctionId, payrollRun: { businessId }, status: "APPROVED" },
    select: { id: true, payrollRunId: true },
  });
  if (!correction) throw new Error("Approved correction not found");
  const updated = await prisma.payrollCorrection.updateMany({
    where: { id: correctionId, status: "APPROVED", payrollRun: { businessId } },
    data: { status: "PAID", paidById: userId, paidAt: new Date() },
  });
  if (updated.count !== 1) throw new Error("Correction changed during payment");
  await logAction({ businessId, userId, action: "payroll.correction_paid", entityType: "PayrollCorrection", entityId: correction.id });
  revalidatePath(`/payroll/runs/${correction.payrollRunId}`);
  revalidatePath("/payroll");
}

export async function deleteDraftPayrollRun(formData: FormData) {
  const { businessId, userId } = await requirePayrollAdmin();
  const runId = readFormText(formData, "runId", "Payroll run", { required: true, maxLength: 64 });
  const deleted = await prisma.payrollRun.deleteMany({ where: { id: runId, businessId, status: PayrollRunStatus.DRAFT } });
  if (deleted.count !== 1) throw new Error("Only draft payroll can be deleted");
  await logAction({ businessId, userId, action: "payroll.draft_deleted", entityType: "PayrollRun", entityId: runId });
  revalidatePath("/payroll");
  revalidatePath("/payroll/runs");
  redirect("/payroll/runs");
}
