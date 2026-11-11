import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { money } from "@/lib/format";

export default async function SupplierBillsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;

  const bills = await prisma.supplierBill.findMany({
    where: { businessId },
    orderBy: { billDate: "desc" },
    include: { supplier: { select: { name: true } } },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Supplier bills</h1>
            <p className="text-sm text-gray-500">Open liabilities from purchases and supplier invoices</p>
          </div>
          <div className="flex gap-2">
            <Link href="/purchases/payables" className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Payables</Link>
            <Link href="/purchases/bills/new" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">New bill</Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {bills.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">No supplier bills yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Supplier</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-right">Paid</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{bill.reference}</td>
                    <td className="px-4 py-3 text-gray-700">{bill.supplier?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{bill.status}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{money(Number(bill.totalAmount))}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{money(Number(bill.paidAmount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
