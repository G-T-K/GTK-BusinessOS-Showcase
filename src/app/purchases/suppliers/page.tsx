import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";

export default async function SuppliersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  const suppliers = await prisma.supplier.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Suppliers</h1>
            <p className="text-sm text-gray-500">{suppliers.length} total</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/purchases"
              className="rounded-lg border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 hover:bg-gray-50"
            >
              Purchases
            </Link>
            <Link
              href="/purchases/suppliers/new"
              className="rounded-lg bg-brand-600 text-white text-sm font-medium px-4 py-2 hover:bg-brand-700"
            >
              Add supplier
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {suppliers.length === 0 && (
            <p className="p-4 text-sm text-gray-500">No suppliers yet.</p>
          )}
          {suppliers.map((s) => (
            <div key={s.id} className="p-4 text-sm">
              <p className="font-medium text-gray-900">{s.name}</p>
              <p className="text-gray-500">{s.phone ?? "—"} · {s.email ?? "—"}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
