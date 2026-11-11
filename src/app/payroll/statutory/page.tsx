import { AppNav } from "@/components/AppNav";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { closeStatutoryRule, createStatutoryRule, deactivateStatutoryRule } from "../actions";

export default async function StatutoryRulesPage() {
  const { businessId } = await requirePagePermission("payrollManage");
  const rules = await prisma.statutoryRule.findMany({ where: { businessId }, orderBy: [{ currency: "asc" }, { code: "asc" }, { effectiveFrom: "desc" }] });
  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <header><h1 className="text-2xl font-semibold text-gray-900">Statutory deduction tables</h1><p className="mt-1 max-w-3xl text-sm text-gray-600">No tax rates or contribution percentages are preloaded. Add verified, applicable rates from authoritative current guidance with effective dates. Payroll approval is blocked until an effective rule exists for the period and currency.</p></header>
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-gray-100 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Rule</th><th className="px-4 py-3">Basis</th><th className="px-4 py-3">Formula</th><th className="px-4 py-3">Effective period</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">
              {rules.map((rule) => <tr key={rule.id}><td className="px-4 py-3"><strong>{rule.name}</strong><span className="block text-xs text-gray-500">{rule.code} · {rule.currency} · {rule.active ? "Active" : "Inactive"}</span></td><td className="px-4 py-3">{rule.basis}</td><td className="px-4 py-3">{rule.calculation === "PERCENTAGE" ? `${Number(rule.ratePercent)}%` : "Progressive bands"}</td><td className="px-4 py-3">{rule.effectiveFrom.toISOString().slice(0, 10)}{rule.effectiveTo ? ` — ${rule.effectiveTo.toISOString().slice(0, 10)}` : " — ongoing"}</td><td className="px-4 py-3"><div className="flex flex-col gap-2">{rule.active && !rule.effectiveTo && <form action={closeStatutoryRule} className="flex items-center gap-1"><input type="hidden" name="ruleId" value={rule.id} /><input type="date" name="effectiveTo" required min={rule.effectiveFrom.toISOString().slice(0, 10)} aria-label="Close rule after date" className="w-32 rounded border border-gray-300 px-2 py-1 text-xs" /><button className="text-xs text-brand-700 hover:underline">Close</button></form>}{rule.active && <form action={deactivateStatutoryRule}><input type="hidden" name="ruleId" value={rule.id} /><button className="text-xs text-red-700 hover:underline">Deactivate</button></form>}</div></td></tr>)}
              {rules.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No statutory rules configured.</td></tr>}
            </tbody></table>
          </div>
          <form action={createStatutoryRule} className="h-fit space-y-3 rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="font-semibold text-gray-900">Configure a rule</h2>
            <Field label="Code (e.g. PAYE)" name="code" required />
            <Field label="Name" name="name" required />
            <label className="block text-sm text-gray-700">Currency<input name="currency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" placeholder="ISO currency code" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 uppercase" /></label>
            <label className="block text-sm text-gray-700">Calculation<select name="calculation" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"><option value="PERCENTAGE">Percentage</option><option value="PROGRESSIVE">Progressive bands</option></select></label>
            <label className="block text-sm text-gray-700">Basis<select name="basis" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"><option value="GROSS">Gross</option><option value="BASIC">Basic salary</option><option value="PAYE">Previously calculated PAYE</option></select></label>
            <Field label="Rate percentage (percentage rules)" name="ratePercent" type="number" step="0.000001" min="0" max="100" />
            <label className="block text-sm text-gray-700">Progressive bands JSON<textarea name="bands" rows={4} maxLength={5000} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs" placeholder="JSON bands with upTo and ratePercent; final upTo is null." /></label>
            <Field label="Effective from" name="effectiveFrom" type="date" required />
            <Field label="Effective to (optional)" name="effectiveTo" type="date" />
            <button className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">Save effective-dated rule</button>
          </form>
        </section>
      </main>
    </div>
  );
}

function Field({ label, name, type = "text", required = false, step, min, max }: { label: string; name: string; type?: string; required?: boolean; step?: string; min?: string; max?: string }) {
  return <label className="block text-sm text-gray-700">{label}<input name={name} type={type} required={required} step={step} min={min} max={max} maxLength={100} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>;
}
