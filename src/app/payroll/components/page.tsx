import { AppNav } from "@/components/AppNav";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createSalaryComponent, deactivateSalaryComponent } from "../actions";

export default async function SalaryComponentsPage() {
  const { businessId } = await requirePagePermission("payrollManage");
  const components = await prisma.salaryComponent.findMany({ where: { businessId }, orderBy: [{ kind: "asc" }, { name: "asc" }] });
  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <header><h1 className="text-2xl font-semibold text-gray-900">Salary components</h1><p className="mt-1 text-sm text-gray-500">Configure earnings and voluntary deductions. Statutory deductions are configured separately.</p></header>
        <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <ul className="divide-y divide-gray-100">{components.map((component) => <li key={component.id} className="flex flex-wrap justify-between gap-3 px-4 py-3 text-sm"><span className="font-medium text-gray-900">{component.name}<span className="ml-2 text-xs text-gray-500">{component.code}</span><span className="ml-2 text-xs text-gray-500">{component.active ? "Active" : "Inactive"}</span></span><span className="flex items-center gap-3 text-gray-600">{component.kind.replace("_", " ")} · {component.mode}{component.active && <form action={deactivateSalaryComponent}><input type="hidden" name="componentId" value={component.id} /><button className="text-xs text-red-700 hover:underline">Deactivate</button></form>}</span></li>)}{components.length === 0 && <li className="p-4 text-sm text-gray-500">No components configured.</li>}</ul>
          </div>
          <form action={createSalaryComponent} className="h-fit space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="font-semibold text-gray-900">New component</h2>
            <label className="block text-sm text-gray-700">Code<input name="code" required maxLength={30} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
            <label className="block text-sm text-gray-700">Name<input name="name" required maxLength={100} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
            <label className="block text-sm text-gray-700">Type<select name="kind" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"><option value="EARNING">Earning</option><option value="OTHER_DEDUCTION">Voluntary deduction</option></select></label>
            <label className="block text-sm text-gray-700">Mode<select name="mode" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"><option value="FIXED">Fixed amount</option><option value="VARIABLE">Variable per payroll</option></select></label>
            <button className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">Save component</button>
          </form>
        </section>
      </main>
    </div>
  );
}
