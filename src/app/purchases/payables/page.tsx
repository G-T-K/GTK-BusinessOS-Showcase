import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { money } from "@/lib/format";
import { recordSupplierPayment } from "@/app/purchases/actions";

export default async function SupplierPayablesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;

  const [bills, accounts] = await Promise.all([
    prisma.supplierBill.findMany({
      where: { businessId },
      orderBy: { dueDate: "asc" },
      include: { supplier: { select: { name: true } } },
    }),
    prisma.financialAccount.findMany({
      where: { businessId, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const openBills = bills.filter((bill) => bill.status !== "PAID" && bill.status !== "CANCELLED");

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Supplier payables</h1>
          <p className="text-sm text-gray-500">Track what the business still owes to its suppliers</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {openBills.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">No open payables.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {openBills.map((bill) => {
                const balance = Number(bill.totalAmount) - Number(bill.paidAmount);

                return (
                  <div key={bill.id} className="p-4 space-y-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{bill.supplier?.name ?? "Supplier"}</p>
                        <p className="text-xs text-gray-500">{bill.reference} · due {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : "No due date"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Balance</p>
                        <p className="text-lg font-semibold text-gray-900">{money(balance)}</p>
                      </div>
                    </div>

                    <form action={recordSupplierPayment} className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 md:grid-cols-[1fr_200px_120px_auto]">
                      <input type="hidden" name="billId" value={bill.id} />
                      <input type="hidden" name="supplierId" value={bill.supplierId} />
                      <select name="accountId" required className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                        <option value="">Select account</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>{account.name}</option>
                        ))}
                      </select>
                      <input name="amount" type="number" min="0.01" max={balance} step="0.01" placeholder="Amount" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
                      <select name="method" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                        <option value="BANK_TRANSFER">Bank transfer</option>
                        <option value="CASH">Cash</option>
                        <option value="CARD">Card</option>
                        <option value="MOBILE_MONEY">Mobile money</option>
                        <option value="OTHER">Other</option>
                      </select>
                      <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
