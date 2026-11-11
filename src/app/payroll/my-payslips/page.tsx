import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moneyInCurrency } from "@/lib/format";

export default async function MyPayslipsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const user = session.user as typeof session.user & { id?: string; businessId?: string };
  if (!user.id || !user.businessId) redirect("/login");
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, businessId: user.businessId, active: true },
    select: { id: true },
  });
  if (!membership) redirect("/login");
  const employee = await prisma.employee.findFirst({
    where: { businessId: user.businessId, userId: user.id },
    select: { id: true, employeeNumber: true, fullName: true },
  });
  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-50"><AppNav businessId={user.businessId} /><main className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><h1 className="text-2xl font-semibold text-gray-900">My payslips</h1><p className="mt-3 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">Your login is not linked to an employee record. Contact your payroll administrator.</p></main></div>
    );
  }
  const payslips = await prisma.payrollLine.findMany({
    where: {
      employeeId: employee.id,
      payrollRun: { businessId: user.businessId, status: { in: ["APPROVED", "PAID"] } },
    },
    include: { payrollRun: { select: { id: true, reference: true, year: true, month: true, currency: true, status: true, payDate: true, netTotal: true } } },
    orderBy: [{ payrollRun: { year: "desc" } }, { payrollRun: { month: "desc" } }],
  });
  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={user.businessId} />
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6">
        <header><p className="text-sm text-gray-500">{employee.employeeNumber}</p><h1 className="text-2xl font-semibold text-gray-900">My payslips</h1><p className="mt-1 text-sm text-gray-500">Only payslips linked to your employee account are shown.</p></header>
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {payslips.map((line) => <div key={line.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"><div><p className="font-medium text-gray-900">{monthName(line.payrollRun.month)} {line.payrollRun.year}</p><p className="text-xs text-gray-500">{line.payrollRun.reference} · {line.payrollRun.status}{line.payrollRun.payDate ? ` · Paid ${line.payrollRun.payDate.toISOString().slice(0, 10)}` : ""}</p></div><div className="flex items-center justify-between gap-4 sm:justify-end"><span className="text-sm font-semibold">{moneyInCurrency(Number(line.netPay), line.payrollRun.currency)}</span><a href={`/api/payroll/payslips/${line.id}`} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-brand-700 hover:bg-gray-50">Download PDF</a><a href={`/api/payroll/payslips/${line.id}?inline=1`} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Print</a></div></div>)}
          {payslips.length === 0 && <p className="p-5 text-sm text-gray-500">No approved payslips yet.</p>}
        </div>
      </main>
    </div>
  );
}

function monthName(month: number) {
  return new Date(Date.UTC(2020, month - 1, 1)).toLocaleString("en", { month: "long", timeZone: "UTC" });
}
