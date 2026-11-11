import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { moneyInCurrency } from "@/lib/format";
import { createDepartment } from "../actions";

export default async function EmployeesPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const { businessId } = await requirePagePermission("payrollManage");
  const query = searchParams.q?.trim() ?? "";
  const status = searchParams.status === "INACTIVE" || searchParams.status === "TERMINATED"
    ? searchParams.status
    : "ACTIVE";
  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      where: {
        businessId,
        status,
        ...(query ? {
          OR: [
            { fullName: { contains: query, mode: "insensitive" } },
            { employeeNumber: { contains: query, mode: "insensitive" } },
            { jobTitle: { contains: query, mode: "insensitive" } },
          ],
        } : {}),
      },
      include: { department: { select: { name: true } } },
      orderBy: { fullName: "asc" },
    }),
    prisma.department.findMany({ where: { businessId }, orderBy: { name: "asc" } }),
  ]);
  if (!businessId) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="text-2xl font-semibold text-gray-900">Employees</h1><p className="text-sm text-gray-500">Manage employee records and compensation details.</p></div>
          <Link href="/payroll/employees/new" className="rounded-lg bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-brand-700">Add employee</Link>
        </header>
        <form className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-[1fr_auto_auto]">
          <input name="q" defaultValue={query} placeholder="Search name, employee number or job title" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <select name="status" defaultValue={status} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="TERMINATED">Terminated</option>
          </select>
          <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Search</button>
        </form>
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Role</th><th className="px-4 py-3 text-right">Basic salary</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No matching employees.</td></tr>}
                  {employees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><Link href={`/payroll/employees/${employee.id}`} className="font-medium text-brand-700 hover:underline">{employee.fullName}</Link><span className="block text-xs text-gray-500">{employee.employeeNumber}</span></td>
                      <td className="px-4 py-3 text-gray-700">{employee.department?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{employee.jobTitle}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{moneyInCurrency(Number(employee.basicSalary), employee.salaryCurrency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <aside className="h-fit rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="font-semibold text-gray-900">Departments</h2>
            <ul className="my-3 space-y-2 text-sm text-gray-600">{departments.map((department) => <li key={department.id} className="flex justify-between"><span>{department.name}</span><span>{department.active ? "Active" : "Inactive"}</span></li>)}</ul>
            <form action={createDepartment} className="space-y-2 border-t border-gray-100 pt-3">
              <label htmlFor="department-name" className="text-xs font-medium text-gray-600">Add department</label>
              <input id="department-name" name="name" required maxLength={100} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Department name" />
              <button className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Save department</button>
            </form>
          </aside>
        </section>
      </main>
    </div>
  );
}
