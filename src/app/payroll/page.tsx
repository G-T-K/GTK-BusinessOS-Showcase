import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { hasPermission } from "@/lib/role-permissions";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { moneyInCurrency } from "@/lib/format";

export default async function PayrollDashboardPage() {
  const { businessId, role } = await requirePagePermission(["payroll", "payrollSelf"]);
  if (!hasPermission(role, "payroll")) redirect("/payroll/my-payslips");
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
  const [employees, runs, monthlyRuns, upcomingRuns] = await Promise.all([
    prisma.employee.count({ where: { businessId, status: "ACTIVE" } }),
    prisma.payrollRun.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, reference: true, year: true, month: true, currency: true, status: true, grossTotal: true, netTotal: true },
    }),
    prisma.payrollRun.findMany({
      where: { businessId, year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, status: { in: ["APPROVED", "PAID"] } },
      select: { id: true, currency: true, grossTotal: true, statutoryTotal: true, otherDeductionTotal: true, netTotal: true, status: true, employeeCount: true },
    }),
    prisma.payrollRun.findMany({
      where: { businessId, status: "APPROVED", payDate: { gte: now, lte: monthEnd } },
      orderBy: { payDate: "asc" },
      select: { id: true, reference: true, currency: true, payDate: true, netTotal: true },
    }),
  ]);
  const paidEmployees = await prisma.payrollLine.count({
    where: { payrollRun: { businessId, year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, status: "PAID" } },
  });
  const awaitingEmployees = await prisma.payrollLine.count({
    where: { payrollRun: { businessId, year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, status: "APPROVED" } },
  });

  const canManage = hasPermission(role, "payrollManage");
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
  const businessName = business?.name ?? "Business";

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Payroll</h1>
            <p className="mt-1 text-sm text-gray-500">{businessName} · {now.toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" })}</p>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Link href="/payroll/runs/new" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Prepare payroll</Link>
              <Link href="/payroll/employees" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Employees</Link>
            </div>
          )}
        </header>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Total monthly payroll" value={multiCurrency(monthlyRuns, "grossTotal")} />
          <Metric label="Gross salaries" value={multiCurrency(monthlyRuns, "grossTotal")} />
          <Metric label="Net salaries" value={multiCurrency(monthlyRuns, "netTotal")} />
          <Metric label="Statutory deductions" value={multiCurrency(monthlyRuns, "statutoryTotal")} />
          <Metric label="Other deductions" value={multiCurrency(monthlyRuns, "otherDeductionTotal")} />
        </section>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Active employees" value={String(employees)} />
          <Metric label="Paid this month" value={String(paidEmployees)} />
          <Metric label="Awaiting payment" value={String(awaitingEmployees)} />
          <Metric label="Monthly payroll runs" value={String(monthlyRuns.length)} />
        </section>
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="font-semibold text-gray-900">Recent payroll runs</h2>
              <Link href="/payroll/runs" className="text-sm text-brand-700 hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-gray-100">
              {runs.length === 0 && <p className="p-4 text-sm text-gray-500">No payroll runs yet.</p>}
              {runs.map((run) => (
                <Link key={run.id} href={`/payroll/runs/${run.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                  <span><span className="block text-sm font-medium text-gray-900">{run.reference}</span><span className="text-xs text-gray-500">{monthName(run.month)} {run.year} · {run.status}</span></span>
                  <span className="text-sm font-medium text-gray-800">{moneyInCurrency(Number(run.netTotal), run.currency)}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3"><h2 className="font-semibold text-gray-900">Upcoming pay dates</h2></div>
            <div className="divide-y divide-gray-100">
              {upcomingRuns.length === 0 && <p className="p-4 text-sm text-gray-500">No approved pay dates scheduled this month.</p>}
              {upcomingRuns.map((run) => (
                <Link key={run.id} href={`/payroll/runs/${run.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                  <span><span className="block text-sm font-medium text-gray-900">{run.reference}</span><span className="text-xs text-gray-500">{run.payDate?.toLocaleDateString()}</span></span>
                  <span className="text-sm font-medium text-gray-800">{moneyInCurrency(Number(run.netTotal), run.currency)}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50" href="/payroll/reports">Payroll reports</Link>
          {canManage && <Link className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50" href="/payroll/statutory">Statutory tables</Link>}
          {canManage && <Link className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50" href="/payroll/components">Salary components</Link>}
        </div>
      </main>
    </div>
  );
}

function monthName(month: number) {
  return new Date(Date.UTC(2020, month - 1, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" });
}

function multiCurrency(
  runs: { currency: string; grossTotal: unknown; statutoryTotal: unknown; otherDeductionTotal: unknown; netTotal: unknown }[],
  field: "grossTotal" | "statutoryTotal" | "otherDeductionTotal" | "netTotal",
) {
  const totals = new Map<string, number>();
  for (const run of runs) totals.set(run.currency, (totals.get(run.currency) ?? 0) + Number(run[field]));
  return Array.from(totals, ([currency, value]) => moneyInCurrency(value, currency)).join(" · ") || "—";
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-lg font-semibold text-gray-900">{value}</p></div>;
}
