import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { requirePagePermission } from "@/lib/permissions";
import { hasPermission } from "@/lib/role-permissions";
import { prisma } from "@/lib/prisma";
import { moneyInCurrency } from "@/lib/format";

export default async function PayrollRunsPage() {
  const { businessId, role } = await requirePagePermission("payroll");
  const canManage = hasPermission(role, "payrollManage");
  const runs = await prisma.payrollRun.findMany({
    where: { businessId },
    include: { _count: { select: { lines: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-gray-900">Payroll runs</h1><p className="text-sm text-gray-500">Payroll is separated by period and salary currency.</p></div>{canManage && <Link href="/payroll/runs/new" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Prepare payroll</Link>}</header>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-gray-100 text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Period</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Employees</th><th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3 text-right">Net</th></tr></thead><tbody className="divide-y divide-gray-100">
            {runs.map((run) => <tr key={run.id}><td className="px-4 py-3"><Link href={`/payroll/runs/${run.id}`} className="font-medium text-brand-700 hover:underline">{run.reference}</Link></td><td className="px-4 py-3">{monthName(run.month)} {run.year} · {run.currency}</td><td className="px-4 py-3">{run.status}{run.kind === "ADJUSTMENT" ? " · adjustment" : ""}</td><td className="px-4 py-3">{run._count.lines}</td><td className="px-4 py-3 text-right">{moneyInCurrency(Number(run.grossTotal), run.currency)}</td><td className="px-4 py-3 text-right font-medium">{moneyInCurrency(Number(run.netTotal), run.currency)}</td></tr>)}
            {runs.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No payroll runs.</td></tr>}
          </tbody></table>
        </div>
      </main>
    </div>
  );
}

function monthName(month: number) {
  return new Date(Date.UTC(2020, month - 1, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" });
}
