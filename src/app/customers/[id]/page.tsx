import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { money, daysOverdue, overdueLevel } from "@/lib/format";
import { getInvoiceOutstandingBalance } from "@/lib/customer-invoice-balance";
import { allocatePaymentToInvoice, recordPayment } from "../actions";

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  const [customer, financialAccounts] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: params.id, businessId },
      include: {
        invoices: {
          where: { businessId },
          orderBy: { issuedAt: "desc" },
          include: {
            payments: {
              where: { businessId },
              select: { baseAmount: true },
            },
          },
        },
        payments: {
          where: { businessId },
          orderBy: { paidAt: "desc" },
          include: { receipt: true, invoice: { select: { reference: true } } },
        },
      },
    }),
    prisma.financialAccount.findMany({
      where: { businessId, active: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
  ]);

  if (!customer) notFound();

  const owing = customer.invoices.reduce(
    (sum, inv) =>
      sum +
      getInvoiceOutstandingBalance(
        Number(inv.totalBaseAmount),
        inv.payments.map((payment) => Number(payment.baseAmount)),
      ),
    0
  );
  const openInvoices = customer.invoices.filter(
    (inv) =>
      (inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID" || inv.status === "OVERDUE") &&
      getInvoiceOutstandingBalance(
        Number(inv.totalBaseAmount),
        inv.payments.map((payment) => Number(payment.baseAmount)),
      ) > 0,
  );
  const invoiceBalance = (invoice: (typeof customer.invoices)[number]) =>
    getInvoiceOutstandingBalance(
      Number(invoice.totalBaseAmount),
      invoice.payments.map((payment) => Number(payment.baseAmount)),
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{customer.name}</h1>
            <p className="text-sm text-gray-500">
              {customer.phone ?? "No phone"} · {customer.email ?? "No email"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Total owing</p>
            <p className={`text-xl font-semibold ${owing > 0 ? "text-danger" : "text-gray-900"}`}>
              {money(owing)}
            </p>
          </div>
        </div>

        {/* Record a payment */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Record a payment</h2>
          <form action={recordPayment} className="grid grid-cols-2 gap-3">
            <input type="hidden" name="customerId" value={customer.id} />
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600">Deposit into account</label>
              <select
                name="accountId"
                required
                defaultValue=""
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="" disabled>Choose cash or bank account</option>
                {financialAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.type === "CASH" ? "Cash" : "Bank"}
                  </option>
                ))}
              </select>
              {financialAccounts.length === 0 && (
                <Link href="/finance/accounts" className="mt-1 inline-block text-xs text-brand-700 hover:underline">
                  Set up an account first
                </Link>
              )}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600">Apply to invoice</label>
              <select
                name="invoiceId"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">General payment (no invoice)</option>
                {openInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.reference} — {money(invoiceBalance(inv))} due
                  </option>
                ))}
              </select>
              {openInvoices.length === 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  No outstanding invoices. Payments recorded now will be saved as unallocated customer payments.
                </p>
              )}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600">Method</label>
              <select
                name="method"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="MOBILE_MONEY">Mobile money</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-600">Amount</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg bg-brand-600 text-white text-sm font-medium py-2 hover:bg-brand-700"
              >
                Record payment
              </button>
            </div>
          </form>
        </section>

        {/* Invoices */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Invoices</h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {customer.invoices.length === 0 && (
              <p className="p-4 text-sm text-gray-500">No invoices yet.</p>
            )}
            {customer.invoices.map((inv) => {
              const balance = invoiceBalance(inv);
              const days = daysOverdue(inv.dueDate);
              return (
                <div key={inv.id} className="p-4 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{inv.reference}</p>
                    <p className="text-gray-500">
                      {inv.status} {inv.dueDate && balance > 0 ? `· ${overdueLevel(days)} ${days}d` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{money(Number(inv.totalBaseAmount))}</p>
                    <p className="text-gray-500">{balance > 0 ? `${money(balance)} due` : "Paid"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Payment / statement history */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Payment history (statement)
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {customer.payments.length === 0 && (
              <p className="p-4 text-sm text-gray-500">No payments recorded yet.</p>
            )}
            {customer.payments.map((p) => {
              const allocatableInvoices = openInvoices.filter((invoice) => {
                const balance = invoiceBalance(invoice);
                return balance > 0 && balance + 0.005 >= Number(p.baseAmount);
              });

              return (
                <div key={p.id} className="flex items-start justify-between gap-4 p-4 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{p.receipt?.reference ?? "Payment"}</p>
                    <p className="text-gray-500">
                      {new Date(p.paidAt).toLocaleDateString()} · {p.method.replace(/_/g, " ")} ·{" "}
                      {p.invoice ? (
                        <span>Applied to {p.invoice.reference}</span>
                      ) : (
                        <span className="font-medium text-amber-700">Unallocated · no invoice</span>
                      )}
                    </p>
                    {!p.invoiceId && (allocatableInvoices.length > 0 ? (
                      <form action={allocatePaymentToInvoice} className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input type="hidden" name="customerId" value={customer.id} />
                        <input type="hidden" name="paymentId" value={p.id} />
                        <label htmlFor={`allocation-${p.id}`} className="sr-only">Allocate payment to invoice</label>
                        <select
                          id={`allocation-${p.id}`}
                          name="invoiceId"
                          required
                          defaultValue=""
                          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="" disabled>Choose an invoice</option>
                          {allocatableInvoices.map((invoice) => (
                            <option key={invoice.id} value={invoice.id}>
                              {invoice.reference} · {money(invoiceBalance(invoice))} due
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-lg border border-brand-600 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                        >
                          Allocate
                        </button>
                      </form>
                    ) : (
                      <p className="mt-2 text-xs text-gray-500">No open invoice can accept this full payment.</p>
                    ))}
                  </div>
                  <p className="shrink-0 font-medium text-gray-900">{money(Number(p.baseAmount))}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
