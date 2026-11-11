import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import { createProduct } from "../actions";

export default async function NewProductPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-lg mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Add product</h1>

        <form action={createProduct} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              name="name"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">SKU (optional)</label>
            <input
              name="sku"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Cost price</label>
              <input
                name="costPrice"
                type="number"
                step="0.01"
                min="0"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Selling price</label>
              <input
                name="sellingPrice"
                type="number"
                step="0.01"
                min="0"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Opening quantity</label>
              <input
                name="quantityOnHand"
                type="number"
                step="0.001"
                min="0"
                defaultValue={0}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Reorder level</label>
              <input
                name="reorderLevel"
                type="number"
                step="0.001"
                min="0"
                defaultValue={0}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Unit</label>
            <input
              name="unit"
              defaultValue="unit"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-brand-600 text-white text-sm font-medium py-2 hover:bg-brand-700"
          >
            Save product
          </button>
        </form>
      </div>
    </div>
  );
}
