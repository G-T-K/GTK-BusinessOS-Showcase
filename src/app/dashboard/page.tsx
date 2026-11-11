import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import { AppNav } from "@/components/AppNav";
import { DashboardTips } from "@/components/DashboardTips";
import { DashboardWelcome } from "@/components/DashboardWelcome";
import { money } from "@/lib/format";

async function getDashboardData(businessId: string) {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const [salesToday, collectionsToday, expensesToday, products, overdueInvoices, lowStock] =
    await Promise.all([
      prisma.invoice.aggregate({
        where: { businessId, issuedAt: { gte: todayStart, lte: todayEnd }, status: { not: "CANCELLED" } },
        _sum: { totalBaseAmount: true },
      }),
      prisma.payment.aggregate({
        where: { businessId, paidAt: { gte: todayStart, lte: todayEnd } },
        _sum: { baseAmount: true },
      }),
      prisma.expense.aggregate({
        where: { businessId, incurredAt: { gte: todayStart, lte: todayEnd } },
        _sum: { baseAmount: true },
      }),
      prisma.product.findMany({
        where: { businessId, active: true },
        select: { costPrice: true, quantityOnHand: true, reorderLevel: true, sellingPrice: true },
      }),
      prisma.invoice.findMany({
        where: {
          businessId,
          status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
          dueDate: { lt: new Date() },
        },
        select: { id: true, totalBaseAmount: true, amountPaidBase: true, dueDate: true, customer: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.product.findMany({
        where: { businessId, active: true },
      }),
    ]);

  const stockValue = products.reduce(
    (sum, p) => sum + Number(p.costPrice) * Number(p.quantityOnHand),
    0
  );
  const lowStockCount = lowStock.filter(
    (p) => Number(p.quantityOnHand) <= Number(p.reorderLevel)
  ).length;

  const outstanding = overdueInvoices.reduce(
    (sum, inv) => sum + (Number(inv.totalBaseAmount) - Number(inv.amountPaidBase)),
    0
  );

  return {
    salesToday: Number(salesToday._sum.totalBaseAmount ?? 0),
    collectionsToday: Number(collectionsToday._sum.baseAmount ?? 0),
    expensesToday: Number(expensesToday._sum.baseAmount ?? 0),
    stockValue,
    lowStockCount,
    overdueCount: overdueInvoices.length,
    outstanding,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;
  const data = await getDashboardData(businessId);
  const grossProfitProxy = data.salesToday - data.expensesToday;

  const attention = [
    data.overdueCount > 0 && {
      level: "🔴",
      text: `${data.overdueCount} invoice${data.overdueCount === 1 ? "" : "s"} overdue`,
    },
    data.lowStockCount > 0 && {
      level: "🟡",
      text: `${data.lowStockCount} product${data.lowStockCount === 1 ? "" : "s"} need reordering`,
    },
  ].filter(Boolean) as { level: string; text: string }[];

  return (
    <div className="min-h-screen bg-[#E8F0EA]">
      <AppNav businessId={businessId} />
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <section className="grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
          <DashboardWelcome businessName={businessName} />
          <DashboardTips
            performance={{
              overdueCount: data.overdueCount,
              outstandingLabel: money(data.outstanding),
              lowStockCount: data.lowStockCount,
              salesToday: data.salesToday,
              salesLabel: money(data.salesToday),
              collectionsToday: data.collectionsToday,
              collectionsLabel: money(data.collectionsToday),
              expensesToday: data.expensesToday,
              expensesLabel: money(data.expensesToday),
              stockValueLabel: data.stockValue > 0 ? money(data.stockValue) : "",
            }}
          />
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Today</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric label="Sales" value={money(data.salesToday)} />
            <Metric label="Collections" value={money(data.collectionsToday)} />
            <Metric label="Expenses" value={money(data.expensesToday)} />
            <Metric label="Gross Profit (proxy)" value={money(grossProfitProxy)} />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Customers</h2>
          <div className="grid grid-cols-2 gap-4">
            <Metric label="Outstanding (overdue)" value={money(data.outstanding)} tone="danger" />
            <Metric label="Overdue invoices" value={String(data.overdueCount)} tone="danger" />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Inventory</h2>
          <div className="grid grid-cols-2 gap-4">
            <Metric label="Stock value" value={money(data.stockValue)} />
            <Metric label="Low stock items" value={String(data.lowStockCount)} tone="warn" />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            What needs my attention?
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {attention.length === 0 && (
              <p className="p-4 text-sm text-gray-500">Nothing urgent today. 🎉</p>
            )}
            {attention.map((item, i) => (
              <div key={i} className="p-4 text-sm flex items-center gap-2">
                <span>{item.level}</span>
                <span className="text-gray-800">{item.text}</span>
              </div>
            ))}
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
