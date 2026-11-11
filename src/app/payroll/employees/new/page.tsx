import { AppNav } from "@/components/AppNav";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/permissions";
import { createEmployee } from "../../actions";
import { EmployeeForm } from "../EmployeeForm";

export default async function NewEmployeePage() {
  const { businessId } = await requirePagePermission("payrollManage");
  const [departments, users] = await Promise.all([
    prisma.department.findMany({ where: { businessId, active: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { memberships: { some: { businessId, active: true } } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">Add employee</h1>
        <EmployeeForm action={createEmployee} departments={departments} users={users} />
      </main>
    </div>
  );
}
