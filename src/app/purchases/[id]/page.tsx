import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { money } from "@/lib/format";
import { requirePagePermission } from "@/lib/permissions";

export default async function PurchaseDetailPage({ params }: { params: { id: string } }) {
  await requirePagePermission("purchasing");
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  const purchase = await prisma.purchase.findFirst({
    where: { id: params.id, businessId },
    include: { supplier: true, items: { include: { product: { select: { name: true } } } } },
  });

  if (!purchase) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Purchase from {purchase.supplier?.name ?? "unspecified supplier"}
          </h1>
          <p className="text-sm text-gray-500">
            {new Date(purchase.createdAt).toLocaleDateString()} · {purchase.status}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {purchase.items.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-gray-900">{item.product.name}</p>
                <p className="text-gray-500">
                  {Number(item.quantity)} × {money(Number(item.unitCost))}
                </p>
              </div>
              <p className="font-medium text-gray-900">{money(Number(item.lineTotal))}</p>
            </div>
          ))}
          <div className="p-4 flex items-center justify-between text-sm bg-gray-50">
            <span className="text-gray-600">Total</span>
            <span className="font-semibold text-gray-900">{money(Number(purchase.totalBaseAmount))}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
