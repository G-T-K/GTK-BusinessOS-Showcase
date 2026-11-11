import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { NewInvoiceForm } from "./NewInvoiceForm";

export default async function NewInvoicePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({ where: { businessId }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { businessId, active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">New invoice</h1>
        <NewInvoiceForm
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          products={products.map((p) => ({
            id: p.id,
            name: p.name,
            sellingPrice: Number(p.sellingPrice),
            quantityOnHand: Number(p.quantityOnHand),
            unit: p.unit,
          }))}
        />
      </div>
    </div>
  );
}
