import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { money } from "@/lib/format";

export default async function QuotationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  const quotations = await prisma.quotation.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { name: true } } },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Quotations</h1>
            <p className="text-sm text-gray-500">{quotations.length} total</p>
          </div>
          <Link
            href="/sales/quotations/new"
            className="rounded-lg bg-brand-600 text-white text-sm font-medium px-4 py-2 hover:bg-brand-700"
          >
            New quotation
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {quotations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No quotations yet.{" "}
                    <Link href="/sales/quotations/new" className="text-brand-600 underline">
                      Create your first one
                    </Link>
                    .
                  </td>
                </tr>
              )}
              {quotations.map((q) => (
                <tr key={q.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/sales/quotations/${q.id}`} className="text-brand-700 hover:underline">
                      {q.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{q.customer.name}</td>
                  <td className="px-4 py-3">{q.status}</td>
                  <td className="px-4 py-3 text-right">{money(Number(q.totalBaseAmount))}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/sales/quotations/${q.id}`} className="text-brand-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
