import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { moneyInCurrency } from "@/lib/format";
import { hasPermission, requirePagePermission } from "@/lib/permissions";
import { assignFinancialEntry, createFinancialAccount, createFinancialTransfer } from "./actions";

export default async function FinancialAccountsPage({ searchParams }: { searchParams: { error?: string } }) {
  const { role } = await requirePagePermission("finance");
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const canManage = hasPermission(role, "finance");
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { baseCurrency: true },
  });
  if (!business) redirect("/dashboard");

  const [accounts, unassignedPayments, unassignedExpenses] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { businessId, active: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    prisma.payment.findMany({
      where: { businessId, accountId: null },
      include: { customer: { select: { name: true } }, receipt: { select: { reference: true } } },
      orderBy: { paidAt: "desc" },
      take: 100,
    }),
    prisma.expense.findMany({
      where: { businessId, accountId: null },
      include: { category: { select: { name: true } } },
      orderBy: { incurredAt: "desc" },
      take: 100,
    }),
  ]);

  const accountBalances = await Promise.all(accounts.map(async (account) => {
    const [payments, expenses, transfersIn, transfersOut] = await Promise.all([
      prisma.payment.aggregate({
        where: { businessId, accountId: account.id, paidAt: { gte: account.openingDate } },
        _sum: { baseAmount: true },
      }),
      prisma.expense.aggregate({
        where: { businessId, accountId: account.id, incurredAt: { gte: account.openingDate } },
        _sum: { baseAmount: true },
      }),
      prisma.financialTransfer.aggregate({
        where: { businessId, toAccountId: account.id, transferDate: { gte: account.openingDate } },
        _sum: { amount: true },
      }),
      prisma.financialTransfer.aggregate({
        where: { businessId, fromAccountId: account.id, transferDate: { gte: account.openingDate } },
        _sum: { amount: true },
      }),
    ]);
    return {
      ...account,
      bookBalance: Number(account.openingBalance)
        + Number(payments._sum.baseAmount ?? 0)
        - Number(expenses._sum.baseAmount ?? 0)
        + Number(transfersIn._sum.amount ?? 0)
        - Number(transfersOut._sum.amount ?? 0),
    };
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <main className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Cash & bank accounts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track receipts and expenses against accounts, then match them to statement balances in {business.baseCurrency}.
          </p>
        </div>

        {searchParams.error === "duplicate-account-name" && (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This business already has an account with that name. Choose a different name; the default Cash account is already set up.
          </p>
        )}

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Accounts</h2>
          {accountBalances.length === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">No accounts have been set up.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {accountBalances.map((account) => (
                <Link
                  key={account.id}
                  href={`/finance/accounts/${account.id}`}
                  className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-green-600 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{account.name}</p>
                      <p className="mt-1 text-xs text-gray-500">{account.type === "CASH" ? "Cash" : "Bank"} · opened {account.openingDate.toLocaleDateString()}</p>
                    </div>
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800">{account.type}</span>
                  </div>
                  <p className="mt-4 text-xs text-gray-500">Book balance</p>
                  <p className="text-xl font-semibold text-gray-900">{moneyInCurrency(account.bookBalance, business.baseCurrency)}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {canManage && (
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Add an account</h2>
            <form action={createFinancialAccount} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="account-name" className="block text-xs font-medium text-gray-600">Account name</label>
                <input id="account-name" name="name" required maxLength={80} placeholder="e.g. Main till" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="account-type" className="block text-xs font-medium text-gray-600">Type</label>
                <select id="account-type" name="type" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank</option>
                </select>
              </div>
              <div>
                <label htmlFor="opening-balance" className="block text-xs font-medium text-gray-600">Opening balance ({business.baseCurrency})</label>
                <input id="opening-balance" name="openingBalance" type="number" step="0.01" defaultValue="0" required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="opening-date" className="block text-xs font-medium text-gray-600">Opening balance date</label>
                <input id="opening-date" name="openingDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Add account</button>
              </div>
            </form>
          </section>
        )}

        {canManage && accountBalances.length > 1 && (
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">Transfer between accounts</h2>
            <p className="mt-1 text-xs text-gray-500">Transfers change account balances but are not counted as income or expenses.</p>
            <form action={createFinancialTransfer} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor="transfer-from" className="block text-xs font-medium text-gray-600">From</label>
                <select id="transfer-from" name="fromAccountId" required defaultValue="" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="" disabled>Source account</option>
                  {accountBalances.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="transfer-to" className="block text-xs font-medium text-gray-600">To</label>
                <select id="transfer-to" name="toAccountId" required defaultValue="" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="" disabled>Destination account</option>
                  {accountBalances.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="transfer-amount" className="block text-xs font-medium text-gray-600">Amount ({business.baseCurrency})</label>
                <input id="transfer-amount" name="amount" type="number" step="0.01" min="0.01" required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="transfer-date" className="block text-xs font-medium text-gray-600">Date</label>
                <input id="transfer-date" name="transferDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="flex items-end">
                <button type="submit" className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Record transfer</button>
              </div>
              <div className="sm:col-span-2 lg:col-span-5">
                <label htmlFor="transfer-reference" className="block text-xs font-medium text-gray-600">Reference or note (optional)</label>
                <input id="transfer-reference" name="reference" maxLength={100} placeholder="e.g. Cash deposit slip number" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </form>
          </section>
        )}

        {canManage && (unassignedPayments.length > 0 || unassignedExpenses.length > 0) && (
          <section>
            <div className="mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Unassigned activity</h2>
              <p className="mt-1 text-sm text-gray-500">Attach past payments and expenses to the account that received or paid them. This does not change invoice balances.</p>
            </div>
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {unassignedPayments.map((payment) => {
                const eligibleAccounts = accounts.filter((account) => payment.paidAt >= account.openingDate);
                return (
                  <div key={`payment-${payment.id}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{payment.receipt?.reference ?? "Payment"} · {payment.customer.name}</p>
                      <p className="text-sm text-gray-500">{payment.paidAt.toLocaleDateString()} · {payment.method.replace(/_/g, " ")} · {moneyInCurrency(Number(payment.baseAmount), business.baseCurrency)}</p>
                    </div>
                    {eligibleAccounts.length > 0 ? (
                      <form action={assignFinancialEntry} className="flex gap-2">
                        <input type="hidden" name="entryType" value="PAYMENT" />
                        <input type="hidden" name="entryId" value={payment.id} />
                        <label htmlFor={`payment-account-${payment.id}`} className="sr-only">Assign payment account</label>
                        <select id={`payment-account-${payment.id}`} name="accountId" required defaultValue="" className="min-w-0 rounded-lg border border-gray-300 px-2 py-2 text-sm">
                          <option value="" disabled>Choose account</option>
                          {eligibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                        </select>
                        <button type="submit" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Assign</button>
                      </form>
                    ) : <p className="text-xs text-gray-500">No account was open on this date.</p>}
                  </div>
                );
              })}
              {unassignedExpenses.map((expense) => {
                const eligibleAccounts = accounts.filter((account) => expense.incurredAt >= account.openingDate);
                return (
                  <div key={`expense-${expense.id}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{expense.description}</p>
                      <p className="text-sm text-gray-500">{expense.incurredAt.toLocaleDateString()} · {expense.category?.name ?? "Expense"} · {moneyInCurrency(Number(expense.baseAmount), business.baseCurrency)}</p>
                    </div>
                    {eligibleAccounts.length > 0 ? (
                      <form action={assignFinancialEntry} className="flex gap-2">
                        <input type="hidden" name="entryType" value="EXPENSE" />
                        <input type="hidden" name="entryId" value={expense.id} />
                        <label htmlFor={`expense-account-${expense.id}`} className="sr-only">Assign expense account</label>
                        <select id={`expense-account-${expense.id}`} name="accountId" required defaultValue="" className="min-w-0 rounded-lg border border-gray-300 px-2 py-2 text-sm">
                          <option value="" disabled>Choose account</option>
                          {eligibleAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                        </select>
                        <button type="submit" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Assign</button>
                      </form>
                    ) : <p className="text-xs text-gray-500">No account was open on this date.</p>}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}