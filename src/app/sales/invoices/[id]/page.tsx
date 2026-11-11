import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { BusinessDocumentIdentity } from "@/components/BusinessDocumentIdentity";
import { moneyInCurrency, daysOverdue, overdueLevel } from "@/lib/format";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, businessId },
    include: {
      business: { select: { name: true, address: true, phone: true, email: true, website: true, logo: true, logoMimeType: true, baseCurrency: true } },
      customer: true,
      items: { include: { product: { select: { name: true } } } },
      payments: { include: { receipt: true }, orderBy: { paidAt: "desc" } },
      quotation: { select: { id: true, reference: true } },
    },
  });

  if (!invoice) notFound();

  const balance = Number(invoice.totalBaseAmount) - Number(invoice.amountPaidBase);
  const days = daysOverdue(invoice.dueDate);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <BusinessDocumentIdentity business={invoice.business} />
          <a
            href={`/api/sales/invoices/${invoice.id}/pdf`}
            download={`${invoice.reference}.pdf`}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Download PDF
          </a>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{invoice.reference}</h1>
            <p className="text-sm text-gray-500">
              <Link href={`/customers/${invoice.customerId}`} className="text-brand-600 hover:underline">
                {invoice.customer.name}
              </Link>{" "}
              · Issued {new Date(invoice.issuedAt).toLocaleDateString()}
              {invoice.dueDate && ` · Due ${new Date(invoice.dueDate).toLocaleDateString()}`}
            </p>
          </div>
          <span className="text-sm font-medium rounded-full px-3 py-1 bg-gray-100 text-gray-700">
            {invoice.status}
            {balance > 0 && invoice.dueDate && ` · ${overdueLevel(days)} ${days}d`}
          </span>
        </div>

        <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Customer</h2>
            <p className="mt-2 text-sm font-medium text-gray-900">{invoice.customer.name}</p>
            {invoice.customer.address && <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{invoice.customer.address}</p>}
            {invoice.customer.phone && <p className="mt-1 text-sm text-gray-600">{invoice.customer.phone}</p>}
            {invoice.customer.email && <p className="mt-1 break-all text-sm text-gray-600">{invoice.customer.email}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Issued</dt>
              <dd className="mt-1 text-gray-900">{new Date(invoice.issuedAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Due date</dt>
              <dd className="mt-1 text-gray-900">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "Not set"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Currency</dt>
              <dd className="mt-1 text-gray-900">{invoice.currency}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Exchange rate</dt>
              <dd className="mt-1 text-gray-900">{Number(invoice.exchangeRate).toLocaleString()}</dd>
            </div>
          </dl>
        </section>

        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {invoice.items.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-gray-900">{item.product.name}</p>
                <p className="text-gray-500">
                  {Number(item.quantity)} × {moneyInCurrency(Number(item.unitPrice), invoice.currency)}
                </p>
              </div>
              <p className="font-medium text-gray-900">{moneyInCurrency(Number(item.lineTotal), invoice.currency)}</p>
            </div>
          ))}
          <div className="p-4 flex items-center justify-between text-sm bg-gray-50">
            <span className="text-gray-600">Total ({invoice.currency})</span>
            <span className="font-semibold text-gray-900">{moneyInCurrency(Number(invoice.totalAmount), invoice.currency)}</span>
          </div>
          {invoice.currency !== invoice.business.baseCurrency && (
            <div className="p-4 flex items-center justify-between text-sm">
              <span className="text-gray-600">Base total ({invoice.business.baseCurrency})</span>
              <span className="font-medium text-gray-900">{moneyInCurrency(Number(invoice.totalBaseAmount), invoice.business.baseCurrency)}</span>
            </div>
          )}
          <div className="p-4 flex items-center justify-between text-sm">
            <span className="text-gray-600">Paid ({invoice.business.baseCurrency})</span>
            <span className="text-gray-900">{moneyInCurrency(Number(invoice.amountPaidBase), invoice.business.baseCurrency)}</span>
          </div>
          <div className="p-4 flex items-center justify-between text-sm">
            <span className="text-gray-600">Balance ({invoice.business.baseCurrency})</span>
            <span className={`font-semibold ${balance > 0 ? "text-danger" : "text-gray-900"}`}>
              {moneyInCurrency(balance, invoice.business.baseCurrency)}
            </span>
          </div>
        </div>

        {balance > 0 && (
          <p className="text-sm text-gray-500">
            To record a payment against this invoice, go to{" "}
            <Link href={`/customers/${invoice.customerId}`} className="text-brand-600 hover:underline">
              {invoice.customer.name}&apos;s customer page
            </Link>{" "}
            and select this invoice in the payment form.
          </p>
        )}

        {invoice.payments.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
              Payments against this invoice
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {invoice.payments.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{p.receipt?.reference ?? "Payment"}</p>
                    <p className="text-gray-500">
                      {new Date(p.paidAt).toLocaleDateString()} · {p.method.replace(/_/g, " ")} · {p.currency} at {Number(p.exchangeRate).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{moneyInCurrency(Number(p.amount), p.currency)}</p>
                    {p.currency !== invoice.business.baseCurrency && (
                      <p className="text-xs text-gray-500">{moneyInCurrency(Number(p.baseAmount), invoice.business.baseCurrency)} base</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {invoice.quotation && (
          <p className="text-sm text-gray-500">
            Created from quotation{" "}
            <Link href={`/sales/quotations/${invoice.quotation.id}`} className="text-brand-600 hover:underline">
              {invoice.quotation.reference}
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
