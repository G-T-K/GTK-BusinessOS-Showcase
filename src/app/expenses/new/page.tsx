import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { createExpense } from "../actions";

export default async function NewExpensePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  const [categories, accounts, business] = await Promise.all([
    prisma.expenseCategory.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
    }),
    prisma.financialAccount.findMany({
      where: { businessId, active: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { baseCurrency: true } }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-lg mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Add expense</h1>

        <form action={createExpense} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <input
              name="description"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Amount ({business?.baseCurrency ?? "USD"})</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Paid from account</label>
            <select
              name="accountId"
              required
              defaultValue=""
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="" disabled>Choose cash or bank account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.type === "CASH" ? "Cash" : "Bank"}
                </option>
              ))}
            </select>
            {accounts.length === 0 && (
              <Link href="/finance/accounts" className="mt-1 inline-block text-xs text-brand-700 hover:underline">
                Set up an account first
              </Link>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input
              name="incurredAt"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <input
              name="categoryName"
              list="category-options"
              placeholder="e.g. Rent, Utilities, Transport"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <datalist id="category-options">
              {categories.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-gray-400">
              Type an existing category or a new one — it&apos;ll be created automatically.
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-brand-600 text-white text-sm font-medium py-2 hover:bg-brand-700"
          >
            Save expense
          </button>
        </form>
      </div>
    </div>
  );
}
