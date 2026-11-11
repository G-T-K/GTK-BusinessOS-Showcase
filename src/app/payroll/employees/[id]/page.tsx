import { notFound } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/permissions";
import { assignSalaryComponent, deactivateEmployee, updateEmployee } from "../../actions";
import { EmployeeForm } from "../EmployeeForm";
import { moneyInCurrency } from "@/lib/format";

export default async function EmployeeDetailPage({ params }: { params: { id: string } }) {
  const { businessId } = await requirePagePermission("payrollManage");
  const employee = await prisma.employee.findFirst({
    where: { id: params.id, businessId },
    include: {
      salaryComponents: { include: { component: true }, orderBy: { effectiveFrom: "desc" } },
      user: { select: { name: true, email: true } },
    },
  });
  if (!employee) notFound();
  const [departments, users, components, salaryChanges] = await Promise.all([
    prisma.department.findMany({ where: { businessId, active: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { memberships: { some: { businessId, active: true } } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    prisma.salaryComponent.findMany({ where: { businessId, active: true }, orderBy: { name: "asc" } }),
    prisma.auditLog.findMany({
      where: { businessId, entityType: "Employee", entityId: employee.id, action: "payroll.employee_salary_changed" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div><p className="text-sm text-gray-500">{employee.employeeNumber}</p><h1 className="text-2xl font-semibold text-gray-900">{employee.fullName}</h1></div>
          <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">{employee.status}</span>
        </header>
        <EmployeeForm
          action={updateEmployee}
          employee={employee}
          departments={departments}
          users={users}
        />
        {employee.status === "ACTIVE" && (
          <form action={deactivateEmployee} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <input type="hidden" name="employeeId" value={employee.id} />
            <p className="text-sm text-amber-900">Deactivating an employee preserves their payroll and payslip history.</p>
            <button className="mt-3 rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100">Deactivate employee</button>
          </form>
        )}
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-900">Salary structure</h2>
          <p className="mt-1 text-sm text-gray-500">Effective-dated components are snapshotted into each payroll run.</p>
          <div className="my-4 space-y-2">
            {employee.salaryComponents.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                <span>{entry.component.name} · {entry.component.mode === "FIXED" ? "Fixed" : "Variable"} · {entry.component.kind.replace("_", " ")}</span>
                <span className="font-medium">{moneyInCurrency(Number(entry.amount), employee.salaryCurrency)} <span className="font-normal text-gray-500">from {entry.effectiveFrom.toISOString().slice(0, 10)}{entry.effectiveTo ? ` to ${entry.effectiveTo.toISOString().slice(0, 10)}` : ""}</span></span>
              </div>
            ))}
            {employee.salaryComponents.length === 0 && <p className="text-sm text-gray-500">No salary components assigned.</p>}
          </div>
          <form action={assignSalaryComponent} className="grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-4">
            <input type="hidden" name="employeeId" value={employee.id} />
            <select name="componentId" required defaultValue="" className="rounded-lg border border-gray-300 px-3 py-2 text-sm"><option value="" disabled>Choose component</option>{components.map((component) => <option key={component.id} value={component.id}>{component.name} · {component.kind.replace("_", " ")}</option>)}</select>
            <input name="amount" type="number" step="0.01" min="0" required placeholder="Amount / variable default" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input name="effectiveFrom" type="date" required aria-label="Effective from" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <button className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">Assign component</button>
          </form>
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-900">Salary change audit history</h2>
          <div className="mt-3 divide-y divide-gray-100">
            {salaryChanges.length === 0 && <p className="py-3 text-sm text-gray-500">No salary changes recorded.</p>}
            {salaryChanges.map((item) => {
              const metadata = item.metadata as { oldBasicSalary?: number; newBasicSalary?: number; oldCurrency?: string; newCurrency?: string } | null;
              return <div key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{item.createdAt.toLocaleString()} · {metadata?.oldCurrency} {metadata?.oldBasicSalary?.toFixed(2)} → {metadata?.newCurrency} {metadata?.newBasicSalary?.toFixed(2)}</span><span className="text-gray-500">Recorded by {item.userId ?? "system"}</span></div>;
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
