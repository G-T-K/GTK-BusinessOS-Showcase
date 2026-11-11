import Link from "next/link";
import { notFound } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { moneyInCurrency } from "@/lib/format";
import { requirePagePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/role-permissions";
import {
  approvePayrollCorrection,
  approvePayrollRun,
  createPayrollCorrection,
  deleteDraftPayrollCorrection,
  deleteDraftPayrollRun,
  markPayrollCorrectionPaid,
  markPayrollRunPaid,
  updatePayrollLine,
} from "../../actions";

export default async function PayrollRunDetailPage({ params }: { params: { id: string } }) {
  const { businessId, role } = await requirePagePermission("payroll");
  const canViewLines = hasPermission(role, "payrollSensitive");
  const run = await prisma.payrollRun.findFirst({
    where: { id: params.id, businessId },
    select: {
      id: true,
      reference: true,
      year: true,
      month: true,
      currency: true,
      status: true,
      payDate: true,
      employeeCount: true,
      grossTotal: true,
      statutoryTotal: true,
      otherDeductionTotal: true,
      netTotal: true,
    },
  });
  if (!run) notFound();
  const lines = canViewLines
    ? await prisma.payrollLine.findMany({
      where: { payrollRunId: run.id },
      include: { items: { orderBy: [{ kind: "asc" }, { name: "asc" }] } },
      orderBy: { employeeName: "asc" },
    })
    : null;
  const corrections = canViewLines
    ? await prisma.payrollCorrection.findMany({
      where: { payrollRunId: run.id },
      include: { employee: { select: { employeeNumber: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
    })
    : null;
  const canManage = hasPermission(role, "payrollManage");
  const monthLabel = new Date(Date.UTC(run.year, run.month - 1, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" });

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm text-gray-500">{monthLabel} {run.year} · {run.currency}</p><h1 className="text-2xl font-semibold text-gray-900">{run.reference}</h1><p className="mt-1 text-sm text-gray-600">{run.status}{run.payDate ? ` · Pay date ${run.payDate.toISOString().slice(0, 10)}` : ""}</p></div>
          <div className="flex flex-wrap gap-2">{canViewLines && <a href={`/api/payroll/runs/${run.id}/payslips.zip`} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Download all payslips (.zip)</a>}<Link href="/payroll/reports" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Reports</Link></div>
        </header>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label="Employees" value={String(run.employeeCount)} />
          <Metric label="Gross" value={moneyInCurrency(Number(run.grossTotal), run.currency)} />
          <Metric label="Statutory" value={moneyInCurrency(Number(run.statutoryTotal), run.currency)} />
          <Metric label="Other deductions" value={moneyInCurrency(Number(run.otherDeductionTotal), run.currency)} />
          <Metric label="Net payable" value={moneyInCurrency(Number(run.netTotal), run.currency)} />
        </section>
        {canManage && run.status === "DRAFT" && (
          <section className="flex flex-wrap gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <form action={approvePayrollRun}><input type="hidden" name="runId" value={run.id} /><button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Approve payroll</button></form>
            <form action={deleteDraftPayrollRun}><input type="hidden" name="runId" value={run.id} /><button className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">Delete draft</button></form>
            <p className="basis-full text-xs text-amber-900">Approval locks payroll calculations. Corrections after approval must be recorded as audited adjustments.</p>
          </section>
        )}
        {canManage && run.status === "APPROVED" && (
          <form action={markPayrollRunPaid} className="flex flex-wrap items-end gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <input type="hidden" name="runId" value={run.id} />
            <label className="text-sm text-gray-700">Payment date<input name="payDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 block rounded-lg border border-gray-300 px-3 py-2" /></label>
            <button className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800">Mark payroll paid</button>
            <p className="basis-full text-xs text-green-900">Records payroll payment status without duplicating ordinary expense records.</p>
          </form>
        )}
        {!canViewLines && <p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">This summary is available to managers. Employee-level payroll details are restricted to payroll administrators and finance.</p>}
        {canViewLines && <section className="space-y-4">
          {lines?.map((line) => (
            <article key={line.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex flex-col justify-between gap-2 border-b border-gray-100 p-4 sm:flex-row sm:items-center">
                <div><h2 className="font-semibold text-gray-900">{line.employeeName}</h2><p className="text-xs text-gray-500">{line.employeeNumber} · {line.departmentName ?? "No department"} · {line.jobTitle}</p></div>
                <div className="text-sm sm:text-right"><span className="text-gray-500">Net pay </span><strong>{moneyInCurrency(Number(line.netPay), run.currency)}</strong></div>
              </div>
              {canManage && run.status === "DRAFT" ? (
                <form action={updatePayrollLine} className="p-4">
                  <input type="hidden" name="runId" value={run.id} /><input type="hidden" name="lineId" value={line.id} />
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {line.items.filter((item) => item.isEditable && item.componentId).map((item) => <label key={item.id} className="text-xs text-gray-600">{item.name}<input name={`variable_${item.componentId}`} type="number" step="0.01" min="0" defaultValue={Number(item.amount)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>)}
                    <button className="self-end rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Recalculate draft</button>
                  </div>
                </form>
              ) : (
                <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_16rem]">
                  <div className="divide-y divide-gray-100">{line.items.map((item) => <div key={item.id} className="flex justify-between gap-3 py-2 text-sm"><span className="text-gray-700">{item.name}<span className="ml-2 text-xs text-gray-400">{item.kind.replace("_", " ")}</span></span><span className="font-medium">{item.kind === "EARNING" ? "" : "−"}{moneyInCurrency(Number(item.amount), run.currency)}</span></div>)}</div>
                  <dl className="space-y-2 rounded-lg bg-gray-50 p-3 text-sm"><Totals label="Gross" amount={line.gross} currency={run.currency} /><Totals label="Statutory deductions" amount={line.statutoryDeductions} currency={run.currency} /><Totals label="Other deductions" amount={line.otherDeductions} currency={run.currency} /><Totals label="Net pay" amount={line.netPay} currency={run.currency} bold /></dl>
                </div>
              )}
              <div className="flex flex-wrap justify-between gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3">
                <a href={`/api/payroll/payslips/${line.id}`} className="text-sm font-medium text-brand-700 hover:underline">Download payslip PDF</a>
                {canManage && run.status !== "DRAFT" && <form action={createPayrollCorrection} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="runId" value={run.id} /><input type="hidden" name="lineId" value={line.id} />
                  <input name="earningsDelta" type="number" step="0.01" defaultValue="0" placeholder="Earnings ±" className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-xs" />
                  <input name="deductionsDelta" type="number" step="0.01" defaultValue="0" placeholder="Deductions ±" className="w-28 rounded-lg border border-gray-300 px-2 py-1.5 text-xs" />
                  <input name="reason" required maxLength={500} placeholder="Adjustment reason" className="w-40 rounded-lg border border-gray-300 px-2 py-1.5 text-xs" />
                  <button className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700">Record adjustment</button>
                </form>}
              </div>
            </article>
          ))}
        </section>}
        {corrections && corrections.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="font-semibold text-gray-900">Audited corrections</h2>
            <ul className="mt-3 divide-y divide-gray-100">{corrections.map((correction) => <li key={correction.id} className="flex flex-col justify-between gap-2 py-3 text-sm sm:flex-row sm:items-center"><span><strong>{correction.employee.fullName}</strong> · {correction.reason}<span className="block text-xs text-gray-500">Earnings {moneyInCurrency(Number(correction.earningsDelta), run.currency)} · deductions {moneyInCurrency(Number(correction.deductionsDelta), run.currency)} · {correction.status}</span></span><span className="flex gap-2">{canManage && correction.status === "DRAFT" && <><form action={approvePayrollCorrection}><input type="hidden" name="correctionId" value={correction.id} /><button className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs">Approve adjustment</button></form><form action={deleteDraftPayrollCorrection}><input type="hidden" name="correctionId" value={correction.id} /><button className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-700">Delete draft</button></form></>}{canManage && correction.status === "APPROVED" && <form action={markPayrollCorrectionPaid}><input type="hidden" name="correctionId" value={correction.id} /><button className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs">Mark adjustment paid</button></form>}</span></li>)}</ul>
          </section>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-sm font-semibold text-gray-900">{value}</p></div>;
}

function Totals({ label, amount, currency, bold = false }: { label: string; amount: unknown; currency: string; bold?: boolean }) {
  return <div className={`flex justify-between gap-2 ${bold ? "border-t border-gray-200 pt-2 font-semibold" : ""}`}><dt className="text-gray-600">{label}</dt><dd className="text-gray-900">{moneyInCurrency(Number(amount), currency)}</dd></div>;
}
