import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { InventorySearch } from "@/components/InventorySearch";
import { money } from "@/lib/format";

export default async function InventoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  const products = await prisma.product.findMany({
    where: { businessId, active: true },
    orderBy: { name: "asc" },
  });

  const totalStockValue = products.reduce(
    (sum, p) => sum + Number(p.costPrice) * Number(p.quantityOnHand),
    0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Inventory</h1>
            <p className="text-sm text-gray-500">
              {products.length} product{products.length === 1 ? "" : "s"} · Stock value {money(totalStockValue)}
            </p>
          </div>
          <Link
            href="/inventory/new"
            className="rounded-lg bg-brand-600 text-white text-sm font-medium px-4 py-2 hover:bg-brand-700"
          >
            Add product
          </Link>
        </div>

        <InventorySearch products={products} />
      </div>
    </div>
  );
}
