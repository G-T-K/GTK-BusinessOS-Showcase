import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { moneyInCurrency } from "@/lib/format";
import { startOfMonth, endOfMonth } from "date-fns";

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  let invoicesThisMonth: any[] = [];
  let paymentsThisMonth: any = {
    _sum: { baseAmount: null },
    _count: { _all: 0 },
    _avg: { baseAmount: null },
    _min: { baseAmount: null },
    _max: { baseAmount: null },
  };
  let expensesThisMonth: any[] = [];
  let payrollThisMonth: { currency: string; grossTotal: any }[] = [];
  let payrollCorrectionsThisMonth: { payrollRun: { currency: string }; earningsDelta: any }[] = [];
  let business: { baseCurrency: string } | null = null;
  let baseCurrency = "USD";
  let customers: any[] = [];
  let products: any[] = [];

  [invoicesThisMonth, paymentsThisMonth, expensesThisMonth, payrollThisMonth, payrollCorrectionsThisMonth, customers, products, business] = await Promise.all([
      prisma.invoice.findMany({
        where: { businessId, issuedAt: { gte: monthStart, lte: monthEnd }, status: { not: "CANCELLED" } },
        include: { items: { include: { product: { select: { costPrice: true } } } } },
      }),
      prisma.payment.aggregate({
        where: { businessId, paidAt: { gte: monthStart, lte: monthEnd } },
        _sum: { baseAmount: true },
      }),
      prisma.expense.findMany({
        where: { businessId, incurredAt: { gte: monthStart, lte: monthEnd } },
        include: { category: { select: { name: true } } },
      }),
      prisma.payrollRun.findMany({
        where: {
          businessId,
          year: monthStart.getFullYear(),
          month: monthStart.getMonth() + 1,
          status: { in: ["APPROVED", "PAID"] },
        },
        select: { currency: true, grossTotal: true },
      }),
      prisma.payrollCorrection.findMany({
        where: {
          payrollRun: {
            businessId,
            year: monthStart.getFullYear(),
            month: monthStart.getMonth() + 1,
            status: { in: ["APPROVED", "PAID"] },
          },
          status: { in: ["APPROVED", "PAID"] },
        },
        select: { earningsDelta: true, payrollRun: { select: { currency: true } } },
      }),
      prisma.customer.findMany({
        where: { businessId },
        include: {
          invoices: {
            where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
            select: { totalBaseAmount: true, amountPaidBase: true },
          },
        },
      }),
      prisma.product.findMany({ where: { businessId, active: true } }),
      prisma.business.findUnique({ where: { id: businessId }, select: { baseCurrency: true } }),
  ]);
  baseCurrency = business?.baseCurrency ?? "USD";
  const baseMoney = (amount: number) => moneyInCurrency(amount, baseCurrency);

  const revenue = invoicesThisMonth.reduce((sum, inv) => sum + Number(inv.totalBaseAmount), 0);
  const costOfGoods = invoicesThisMonth.reduce(
    (sum, inv) =>
      sum +
      inv.items.reduce(
        (itemSum: number, item: any) => itemSum + Number(item.product.costPrice) * Number(item.quantity),
        0
      ),
    0
  );
  const payrollByCurrency = new Map<string, number>();
  for (const run of payrollThisMonth) {
    payrollByCurrency.set(run.currency, (payrollByCurrency.get(run.currency) ?? 0) + Number(run.grossTotal));
  }
  for (const correction of payrollCorrectionsThisMonth) {
    const currency = correction.payrollRun.currency;
    payrollByCurrency.set(currency, (payrollByCurrency.get(currency) ?? 0) + Number(correction.earningsDelta));
  }
  const totalExpenses = expensesThisMonth.reduce((sum, e) => sum + Number(e.baseAmount), 0)
    + (payrollByCurrency.get(baseCurrency) ?? 0);
  const grossProfit = revenue - costOfGoods;
  const operatingResult = grossProfit - totalExpenses;

  const expenseByCategory = new Map<string, number>();
  for (const e of expensesThisMonth) {
    const key = e.category?.name ?? "Uncategorized";
    expenseByCategory.set(key, (expenseByCategory.get(key) ?? 0) + Number(e.baseAmount));
  }
  if ((payrollByCurrency.get(baseCurrency) ?? 0) > 0) {
    expenseByCategory.set("Payroll", (expenseByCategory.get("Payroll") ?? 0) + (payrollByCurrency.get(baseCurrency) ?? 0));
  }

  const topDebtors = customers
    .map((c) => ({
      name: c.name,
      owing: c.invoices.reduce(
        (sum: number, inv: any) => sum + (Number(inv.totalBaseAmount) - Number(inv.amountPaidBase)),
        0
      ),
    }))
    .filter((c) => c.owing > 0)
    .sort((a, b) => b.owing - a.owing)
    .slice(0, 5);

  const stockValue = products.reduce(
    (sum, p) => sum + Number(p.costPrice) * Number(p.quantityOnHand),
    0
  );
  const lowStock = products.filter((p) => Number(p.quantityOnHand) <= Number(p.reorderLevel));

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">This month so far.</p>
        </div>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Profitability
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Metric label="Revenue" value={baseMoney(revenue)} />
            <Metric label="Cost of goods" value={baseMoney(costOfGoods)} />
            <Metric label="Gross profit" value={baseMoney(grossProfit)} />
            <Metric label="Expenses" value={baseMoney(totalExpenses)} />
            <Metric
              label="Operating result"
              value={baseMoney(operatingResult)}
              tone={operatingResult < 0 ? "danger" : undefined}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Collections received this month: {baseMoney(Number(paymentsThisMonth._sum.baseAmount ?? 0))}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Approved payroll costs in {baseCurrency} are included in expenses without creating duplicate expense transactions.
            {Array.from(payrollByCurrency.entries()).filter(([currency]) => currency !== baseCurrency).map(([currency, amount]) => ` ${currency} payroll: ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (reported separately; not converted).`)}
          </p>
        </section>

        <div className="grid md:grid-cols-2 gap-8">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
              Top customers owing
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {topDebtors.length === 0 && (
                <p className="p-4 text-sm text-gray-500">No outstanding balances.</p>
              )}
              {topDebtors.map((d) => (
                <div key={d.name} className="p-4 flex items-center justify-between text-sm">
                  <span className="text-gray-900">{d.name}</span>
                  <span className="font-medium text-danger">{baseMoney(d.owing)}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
              Expenses by category (this month)
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {expenseByCategory.size === 0 && (
                <p className="p-4 text-sm text-gray-500">No expenses recorded this month.</p>
              )}
              {Array.from(expenseByCategory.entries()).map(([name, total]) => (
                <div key={name} className="p-4 flex items-center justify-between text-sm">
                  <span className="text-gray-900">{name}</span>
                  <span className="font-medium text-gray-900">{baseMoney(total)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Inventory
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Metric label="Stock value" value={baseMoney(stockValue)} />
            <Metric label="Low stock items" value={String(lowStock.length)} tone="warn" />
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "danger" | "warn" }) {
  const toneClass = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : "text-gray-900";
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${toneClass}`}>{value}</p>
    </div>
  );
}
