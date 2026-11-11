import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { money } from "@/lib/format";

export default async function PurchaseOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;

  const orders = await prisma.purchaseOrder.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { name: true } },
      taxRate: { select: { name: true, rate: true } },
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Purchase orders</h1>
            <p className="text-sm text-gray-500">Planned purchases waiting to be received</p>
          </div>
          <Link
            href="/purchases/orders/new"
            className="rounded-lg bg-brand-600 text-white text-sm font-medium px-4 py-2 hover:bg-brand-700"
          >
            New order
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {orders.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No purchase orders yet. <Link href="/purchases/orders/new" className="text-brand-600 underline">Create one</Link>.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Tax</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{order.reference ?? "Draft"}</td>
                    <td className="px-4 py-3 text-gray-700">{order.supplier?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{order.taxRate ? `${order.taxRate.name} (${Number(order.taxRate.rate)}%)` : "No tax"}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{money(Number(order.totalBaseAmount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
