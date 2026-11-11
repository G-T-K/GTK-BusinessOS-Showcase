import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PayrollRunForm } from "./PayrollRunForm";

export default async function NewPayrollRunPage() {
  const { businessId } = await requirePagePermission("payrollManage");
  const employees = await prisma.employee.findMany({
    where: { businessId, status: "ACTIVE" },
    include: {
      department: { select: { name: true } },
      salaryComponents: { where: { effectiveTo: null }, include: { component: true } },
    },
    orderBy: [{ salaryCurrency: "asc" }, { fullName: "asc" }],
  });
  const formEmployees = employees.map((employee) => ({
    id: employee.id,
    fullName: employee.fullName,
    employeeNumber: employee.employeeNumber,
    departmentName: employee.department?.name ?? null,
    jobTitle: employee.jobTitle,
    salaryCurrency: employee.salaryCurrency,
    basicSalary: Number(employee.basicSalary),
    salaryComponents: employee.salaryComponents.map((entry) => ({
      id: entry.id,
      componentId: entry.componentId,
      effectiveFrom: entry.effectiveFrom.toISOString().slice(0, 10),
      effectiveTo: entry.effectiveTo?.toISOString().slice(0, 10) ?? null,
      component: {
        name: entry.component.name,
        kind: entry.component.kind,
        mode: entry.component.mode,
        active: entry.component.active,
      },
    })),
  }));
  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <header><h1 className="text-2xl font-semibold text-gray-900">Prepare payroll</h1><p className="mt-1 text-sm text-gray-500">Select the period and currency, then choose employees and enter variable earnings or deductions.</p></header>
        {employees.length === 0 ? (
          <section className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">Add active employees before preparing a payroll run. <Link href="/payroll/employees/new" className="text-brand-700 underline">Add an employee</Link>.</section>
        ) : (
          <PayrollRunForm employees={formEmployees} />
        )}
      </main>
    </div>
  );
}
