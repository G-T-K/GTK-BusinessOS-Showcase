import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import { createSupplier } from "../../actions";

export default async function NewSupplierPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-lg mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Add supplier</h1>
        <form action={createSupplier} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input name="name" required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input name="phone" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input name="email" type="email" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <textarea name="address" rows={2} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="w-full rounded-lg bg-brand-600 text-white text-sm font-medium py-2 hover:bg-brand-700">
            Save supplier
          </button>
        </form>
      </div>
    </div>
  );
}
