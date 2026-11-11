import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { createSupplierBill } from "@/app/purchases/actions";

export default async function NewSupplierBillPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;

  const [suppliers, taxRates] = await Promise.all([
    prisma.supplier.findMany({ where: { businessId }, orderBy: { name: "asc" } }),
    prisma.taxRate.findMany({ where: { businessId, active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Record supplier bill</h1>
        <form action={createSupplierBill} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Supplier</label>
            <select name="supplierId" required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Reference</label>
            <input name="reference" required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="INV-1001" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Bill date</label>
              <input name="billDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Due date</label>
              <input name="dueDate" type="date" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Tax/VAT</label>
            <select name="taxRateId" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">No tax</option>
              {taxRates.map((rate) => (
                <option key={rate.id} value={rate.id}>{rate.name} ({Number(rate.rate)}%)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Subtotal</label>
            <input name="subtotal" type="number" min="0" step="0.01" defaultValue="0" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <button type="submit" className="w-full rounded-lg bg-brand-600 text-white text-sm font-medium py-2 hover:bg-brand-700">Save bill</button>
        </form>
      </div>
    </div>
  );
}
