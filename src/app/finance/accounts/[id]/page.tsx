import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { ReconciliationForm } from "@/components/ReconciliationForm";
import { moneyInCurrency } from "@/lib/format";
import { hasPermission, requirePagePermission } from "@/lib/permissions";

export default async function FinancialAccountDetailPage({ params }: { params: { id: string } }) {
  const { role } = await requirePagePermission("finance");
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const canReconcile = hasPermission(role, "finance");
  const account = await prisma.financialAccount.findFirst({
    where: { id: params.id, businessId, active: true },
    include: { business: { select: { baseCurrency: true } } },
  });
  if (!account) notFound();

  const [latestReconciliation, payments, expenses, reconciliations] = await Promise.all([
    prisma.financialReconciliation.findFirst({
      where: { accountId: account.id, businessId },
      orderBy: { statementDate: "desc" },
    }),
    prisma.payment.findMany({
      where: { businessId, accountId: account.id, paidAt: { gte: account.openingDate } },
      include: {
        customer: { select: { name: true } },
        receipt: { select: { reference: true } },
        invoice: { select: { reference: true } },
      },
      orderBy: { paidAt: "desc" },
    }),
    prisma.expense.findMany({
      where: { businessId, accountId: account.id, incurredAt: { gte: account.openingDate } },
      include: { category: { select: { name: true } } },
      orderBy: { incurredAt: "desc" },
    }),
    prisma.financialReconciliation.findMany({
      where: { accountId: account.id, businessId },
      orderBy: { statementDate: "desc" },
      take: 10,
    }),
  ]);

  const startingBalance = latestReconciliation
    ? Number(latestReconciliation.statementBalance)
    : Number(account.openingBalance);
  const previousStatementDate = latestReconciliation?.statementDate ?? account.openingDate;
  const reconciliationPayments = payments.filter((payment) => (
    payment.reconciliationId === null
  ));
  const reconciliationExpenses = expenses.filter((expense) => (
    expense.reconciliationId === null
  ));
  const bookBalance = Number(account.openingBalance)
    + payments.reduce((sum, payment) => sum + Number(payment.baseAmount), 0)
    - expenses.reduce((sum, expense) => sum + Number(expense.baseAmount), 0);
  const ledger = [
    ...payments.map((payment) => ({
      id: payment.id,
      type: "PAYMENT" as const,
      date: payment.paidAt,
      description: payment.customer.name,
      reference: payment.receipt?.reference ?? "Payment",
      detail: [payment.method.replace(/_/g, " "), payment.invoice?.reference].filter(Boolean).join(" · "),
      amount: Number(payment.baseAmount),
      reconciliationId: payment.reconciliationId,
    })),
    ...expenses.map((expense) => ({
      id: expense.id,
      type: "EXPENSE" as const,
      date: expense.incurredAt,
      description: expense.description,
      reference: expense.category?.name ?? "Expense",
      detail: expense.currency,
      amount: Number(expense.baseAmount),
      reconciliationId: expense.reconciliationId,
    })),
  ].sort((first, second) => second.date.getTime() - first.date.getTime());

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-6">
        <div>
          <Link href="/finance/accounts" className="text-sm font-medium text-brand-700 hover:underline">← Accounts</Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{account.name}</h1>
              <p className="mt-1 text-sm text-gray-500">{account.type === "CASH" ? "Cash" : "Bank"} · {account.business.baseCurrency} · opening balance {moneyInCurrency(Number(account.openingBalance), account.business.baseCurrency)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Current book balance</p>
              <p className="text-2xl font-semibold text-gray-900">{moneyInCurrency(bookBalance, account.business.baseCurrency)}</p>
            </div>
          </div>
        </div>

        {canReconcile && (
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Reconcile statement</h2>
              <p className="mt-1 text-sm text-gray-500">
                Select the account activity shown on the statement. The ending balance must match before reconciliation is completed.
              </p>
            </div>
            <ReconciliationForm
              accountId={account.id}
              currency={account.business.baseCurrency}
              startingBalance={startingBalance}
              previousStatementDate={previousStatementDate.toISOString().slice(0, 10)}
              includeStartDate={!latestReconciliation}
              transactions={[
                ...reconciliationPayments.map((payment) => ({
                  id: payment.id,
                  type: "PAYMENT" as const,
                  date: payment.paidAt.toISOString().slice(0, 10),
                  description: `${payment.receipt?.reference ?? "Payment"} · ${payment.customer.name}`,
                  amount: Number(payment.baseAmount),
                })),
                ...reconciliationExpenses.map((expense) => ({
                  id: expense.id,
                  type: "EXPENSE" as const,
                  date: expense.incurredAt.toISOString().slice(0, 10),
                  description: expense.description,
                  amount: Number(expense.baseAmount),
                })),
              ]}
            />
          </section>
        )}

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Account activity</h2>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {ledger.length === 0 && <p className="p-4 text-sm text-gray-500">No activity is assigned to this account yet.</p>}
            {ledger.map((entry) => (
              <div key={`${entry.type}-${entry.id}`} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{entry.description}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{entry.reference} · {entry.date.toLocaleDateString()} · {entry.detail}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-semibold ${entry.type === "PAYMENT" ? "text-green-700" : "text-gray-900"}`}>
                    {entry.type === "PAYMENT" ? "+" : "−"}{moneyInCurrency(entry.amount, account.business.baseCurrency)}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">{entry.reconciliationId ? "Reconciled" : "Unreconciled"}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {reconciliations.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Recent reconciliations</h2>
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {reconciliations.map((reconciliation) => (
                <div key={reconciliation.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-medium text-gray-900">Statement to {reconciliation.statementDate.toLocaleDateString()}</p>
                    <p className="text-xs text-gray-500">Completed {reconciliation.reconciledAt.toLocaleString()}</p>
                  </div>
                  <p className="font-semibold text-gray-900">{moneyInCurrency(Number(reconciliation.statementBalance), account.business.baseCurrency)}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}