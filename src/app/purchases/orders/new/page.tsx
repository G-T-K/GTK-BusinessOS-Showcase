import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { NewPurchaseForm } from "@/app/purchases/new/NewPurchaseForm";
import { createPurchaseOrder } from "@/app/purchases/actions";

export default async function NewPurchaseOrderPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;

  const [suppliers, products, taxRates] = await Promise.all([
    prisma.supplier.findMany({ where: { businessId }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { businessId, active: true }, orderBy: { name: "asc" } }),
    prisma.taxRate.findMany({ where: { businessId, active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">New purchase order</h1>
        <NewPurchaseForm
          suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))}
          products={products.map((product) => ({ id: product.id, name: product.name, costPrice: Number(product.costPrice) }))}
          taxRates={taxRates.map((rate) => ({ id: rate.id, code: rate.code, name: rate.name, rate: Number(rate.rate) }))}
          action={createPurchaseOrder}
          submitLabel="Create purchase order"
        />
      </div>
    </div>
  );
}
