import { AppNav } from "@/components/AppNav";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { moneyInCurrency } from "@/lib/format";
import { hasPermission } from "@/lib/role-permissions";

export default async function PayrollReportsPage({ searchParams }: { searchParams: { year?: string } }) {
  const { businessId, role } = await requirePagePermission("payroll");
  const yearValue = Number(searchParams.year);
  const year = Number.isInteger(yearValue) && yearValue >= 2000 && yearValue <= 2200 ? yearValue : new Date().getUTCFullYear();
  const [runs, corrections] = await Promise.all([
    prisma.payrollRun.findMany({
      where: { businessId, year, status: { in: ["APPROVED", "PAID"] } },
      orderBy: [{ month: "asc" }, { currency: "asc" }],
    }),
    prisma.payrollCorrection.findMany({
      where: {
        payrollRun: { businessId, year, status: { in: ["APPROVED", "PAID"] } },
        status: { in: ["APPROVED", "PAID"] },
      },
      include: { payrollRun: { select: { currency: true, status: true } } },
    }),
  ]);
  const summary = new Map<string, { gross: number; statutory: number; other: number; net: number; paid: number; outstanding: number }>();
  for (const run of runs) {
    const item = summary.get(run.currency) ?? { gross: 0, statutory: 0, other: 0, net: 0, paid: 0, outstanding: 0 };
    item.gross += Number(run.grossTotal);
    item.statutory += Number(run.statutoryTotal);
    item.other += Number(run.otherDeductionTotal);
    item.net += Number(run.netTotal);
    if (run.status === "PAID") item.paid += Number(run.netTotal);
    else item.outstanding += Number(run.netTotal);
    summary.set(run.currency, item);
  }
  for (const correction of corrections) {
    const currency = correction.payrollRun.currency;
    const item = summary.get(currency) ?? { gross: 0, statutory: 0, other: 0, net: 0, paid: 0, outstanding: 0 };
    const earnings = Number(correction.earningsDelta);
    const deductions = Number(correction.deductionsDelta);
    const net = earnings - deductions;
    item.gross += earnings;
    item.other += deductions;
    item.net += net;
    if (correction.status === "PAID") item.paid += net;
    else item.outstanding += net;
    summary.set(currency, item);
  }
  const reports = [
    ["summary", "Monthly and annual payroll summary", true],
    ["gross-net", "Gross versus net salaries", true],
    ["outstanding", "Outstanding salaries", hasPermission(role, "payrollSensitive")],
    ["register", "Payroll payment register", hasPermission(role, "payrollSensitive")],
    ["history", "Employee salary history", hasPermission(role, "payrollSensitive")],
    ["statutory", "Statutory deductions", hasPermission(role, "payrollSensitive")],
    ["department", "Department payroll costs", hasPermission(role, "payrollSensitive")],
  ] as const;
  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <header><h1 className="text-2xl font-semibold text-gray-900">Payroll reports</h1><p className="mt-1 text-sm text-gray-500">Approved and paid payroll only · all values remain in their original currency.</p></header>
        <form className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <label className="text-sm text-gray-700">Year<input name="year" type="number" min="2000" max="2200" defaultValue={year} className="mt-1 block w-32 rounded-lg border border-gray-300 px-3 py-2" /></label>
          <button className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Apply</button>
        </form>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from(summary.entries()).map(([currency, totals]) => <article key={currency} className="rounded-xl border border-gray-200 bg-white p-4"><h2 className="font-semibold text-gray-900">{currency} · {year}</h2><dl className="mt-3 space-y-2 text-sm"><Metric label="Gross" value={moneyInCurrency(totals.gross, currency)} /><Metric label="Net" value={moneyInCurrency(totals.net, currency)} /><Metric label="Paid" value={moneyInCurrency(totals.paid, currency)} /><Metric label="Outstanding" value={moneyInCurrency(totals.outstanding, currency)} /><Metric label="Statutory deductions" value={moneyInCurrency(totals.statutory, currency)} /><Metric label="Other deductions" value={moneyInCurrency(totals.other, currency)} /></dl></article>)}
          {summary.size === 0 && <p className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">No approved payroll for {year}.</p>}
        </section>
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-100 px-4 py-3 font-semibold text-gray-900">Export reports · CSV opens in Excel</h2>
          <ul className="divide-y divide-gray-100">{reports.filter(([, , allowed]) => allowed).map(([type, label]) => <li key={type} className="flex flex-col justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center"><span className="text-sm text-gray-700">{label}</span><span className="flex gap-2"><a href={`/api/payroll/reports?type=${type}&year=${year}&format=csv`} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-gray-50">CSV / Excel</a><a href={`/api/payroll/reports?type=${type}&year=${year}&format=pdf`} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">PDF</a></span></li>)}</ul>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-2"><dt className="text-gray-500">{label}</dt><dd className="text-right font-medium text-gray-900">{value}</dd></div>;
}
