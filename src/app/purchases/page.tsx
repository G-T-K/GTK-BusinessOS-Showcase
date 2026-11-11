import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { money } from "@/lib/format";
import { hasPermission, requirePagePermission } from "@/lib/permissions";

export default async function PurchasesPage() {
  const actor = await requirePagePermission("purchasing");
  const canManagePayables = hasPermission(actor.role, "finance");
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  const purchases = await prisma.purchase.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    include: { supplier: { select: { name: true } } },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Purchases</h1>
            <p className="text-sm text-gray-500">Stock coming into the business</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/purchases/orders"
              className="rounded-lg border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 hover:bg-gray-50"
            >
              Orders
            </Link>
            {canManagePayables && (
              <>
                <Link
                  href="/purchases/bills"
                  className="rounded-lg border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 hover:bg-gray-50"
                >
                  Bills
                </Link>
                <Link
                  href="/purchases/payables"
                  className="rounded-lg border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 hover:bg-gray-50"
                >
                  Payables
                </Link>
              </>
            )}
            <Link
              href="/purchases/suppliers"
              className="rounded-lg border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 hover:bg-gray-50"
            >
              Suppliers
            </Link>
            <Link
              href="/purchases/new"
              className="rounded-lg bg-brand-600 text-white text-sm font-medium px-4 py-2 hover:bg-brand-700"
            >
              New purchase
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No purchases yet.{" "}
                      <Link href="/purchases/new" className="text-brand-600 underline">
                        Record your first one
                      </Link>
                      .
                    </td>
                  </tr>
                )}
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.supplier?.name ?? "—"}</td>
                    <td className="px-4 py-3">{p.status}</td>
                    <td className="px-4 py-3 text-right">{money(Number(p.totalBaseAmount))}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/purchases/${p.id}`} className="text-brand-600 hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="block md:hidden p-3 space-y-3">
            {purchases.length === 0 && (
              <div className="px-2 py-8 text-center text-gray-500">
                No purchases yet.{" "}
                <Link href="/purchases/new" className="text-brand-600 underline">
                  Record your first one
                </Link>
                .
              </div>
            )}
            {purchases.map((p) => (
              <div key={p.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{p.supplier?.name ?? "—"}</p>
                    <p className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-1 text-xs font-medium text-brand-700">
                    {p.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Total</p>
                    <p className="font-medium text-gray-900">{money(Number(p.totalBaseAmount))}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Supplier</p>
                    <p className="font-medium text-gray-900">{p.supplier?.name ?? "—"}</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/purchases/${p.id}`}
                    className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-700"
                  >
                    View
                  </Link>
                  <Link
                    href="/purchases/suppliers"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Suppliers
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
