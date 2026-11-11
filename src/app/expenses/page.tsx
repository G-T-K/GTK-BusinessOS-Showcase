import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { money } from "@/lib/format";
import { startOfMonth, endOfMonth } from "date-fns";

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const expenses = await prisma.expense.findMany({
    where: { businessId },
    orderBy: { incurredAt: "desc" },
    include: { category: { select: { name: true } } },
  });

  const monthTotal = expenses
    .filter((e) => e.incurredAt >= monthStart && e.incurredAt <= monthEnd)
    .reduce((sum, e) => sum + Number(e.baseAmount), 0);

  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    const key = e.category?.name ?? "Uncategorized";
    byCategory.set(key, (byCategory.get(key) ?? 0) + Number(e.baseAmount));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Expenses</h1>
            <p className="text-sm text-gray-500">This month: {money(monthTotal)}</p>
          </div>
          <Link
            href="/expenses/new"
            className="rounded-lg bg-brand-600 text-white text-sm font-medium px-4 py-2 hover:bg-brand-700"
          >
            Add expense
          </Link>
        </div>

        {byCategory.size > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from(byCategory.entries()).map(([name, total]) => (
              <div key={name} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500">{name}</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">{money(total)}</p>
              </div>
            ))}
          </div>
        )}

        <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No expenses recorded yet.{" "}
                    <Link href="/expenses/new" className="text-brand-600 underline">
                      Add your first one
                    </Link>
                    .
                  </td>
                </tr>
              )}
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(e.incurredAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{e.description}</td>
                  <td className="px-4 py-3 text-gray-500">{e.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{money(Number(e.baseAmount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="block md:hidden space-y-3">
          {expenses.length === 0 && (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
              No expenses recorded yet. {" "}
              <Link href="/expenses/new" className="text-brand-600 underline">
                Add your first one
              </Link>
              .
            </div>
          )}
          {expenses.map((expense) => (
            <article key={expense.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words font-semibold text-gray-900">{expense.description}</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(expense.incurredAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-900">
                  {money(Number(expense.baseAmount))}
                </span>
              </div>
              <div className="mt-3 border-t border-gray-100 pt-3 text-sm">
                <span className="text-gray-500">Category</span>
                <p className="mt-0.5 text-gray-900">{expense.category?.name ?? "Uncategorized"}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
