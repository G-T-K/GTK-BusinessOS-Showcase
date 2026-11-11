import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { BusinessDocumentIdentity } from "@/components/BusinessDocumentIdentity";
import { moneyInCurrency } from "@/lib/format";
import { markQuotationStatus, convertToInvoice } from "../actions";

export default async function QuotationDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  const quotation = await prisma.quotation.findFirst({
    where: { id: params.id, businessId },
    include: {
      business: { select: { name: true, address: true, phone: true, email: true, website: true, logo: true, logoMimeType: true, baseCurrency: true } },
      customer: true,
      items: { include: { product: { select: { name: true } } } },
      invoice: { select: { id: true, reference: true } },
    },
  });

  if (!quotation) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <BusinessDocumentIdentity business={quotation.business} />
          <a
            href={`/api/sales/quotations/${quotation.id}/pdf`}
            download={`${quotation.reference}.pdf`}
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Download PDF
          </a>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{quotation.reference}</h1>
            <p className="text-sm text-gray-500">
              <Link href={`/customers/${quotation.customerId}`} className="text-brand-600 hover:underline">
                {quotation.customer.name}
              </Link>
              {quotation.validUntil && ` · Valid until ${new Date(quotation.validUntil).toLocaleDateString()}`}
            </p>
          </div>
          <span className="text-sm font-medium rounded-full px-3 py-1 bg-gray-100 text-gray-700">
            {quotation.status}
          </span>
        </div>

        <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Customer</h2>
            <p className="mt-2 text-sm font-medium text-gray-900">{quotation.customer.name}</p>
            {quotation.customer.address && <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{quotation.customer.address}</p>}
            {quotation.customer.phone && <p className="mt-1 text-sm text-gray-600">{quotation.customer.phone}</p>}
            {quotation.customer.email && <p className="mt-1 break-all text-sm text-gray-600">{quotation.customer.email}</p>}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Created</dt>
              <dd className="mt-1 text-gray-900">{new Date(quotation.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Valid until</dt>
              <dd className="mt-1 text-gray-900">{quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : "Not set"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Currency</dt>
              <dd className="mt-1 text-gray-900">{quotation.currency}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Exchange rate</dt>
              <dd className="mt-1 text-gray-900">{Number(quotation.exchangeRate).toLocaleString()}</dd>
            </div>
          </dl>
        </section>

        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {quotation.items.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-gray-900">{item.product.name}</p>
                <p className="text-gray-500">
                  {Number(item.quantity)} × {moneyInCurrency(Number(item.unitPrice), quotation.currency)}
                </p>
              </div>
              <p className="font-medium text-gray-900">{moneyInCurrency(Number(item.lineTotal), quotation.currency)}</p>
            </div>
          ))}
          <div className="p-4 flex items-center justify-between text-sm bg-gray-50">
            <span className="text-gray-600">Total ({quotation.currency})</span>
            <span className="font-semibold text-gray-900">{moneyInCurrency(Number(quotation.totalAmount), quotation.currency)}</span>
          </div>
          {quotation.currency !== quotation.business.baseCurrency && (
            <div className="p-4 flex items-center justify-between text-sm">
              <span className="text-gray-600">Total ({quotation.business.baseCurrency})</span>
              <span className="font-semibold text-gray-900">{moneyInCurrency(Number(quotation.totalBaseAmount), quotation.business.baseCurrency)}</span>
            </div>
          )}
        </div>

        {quotation.invoice ? (
          <p className="text-sm text-gray-500">
            Converted to invoice{" "}
            <Link href={`/sales/invoices/${quotation.invoice.id}`} className="text-brand-600 hover:underline">
              {quotation.invoice.reference}
            </Link>
            .
          </p>
        ) : (
          <div className="flex gap-3">
            {quotation.status === "SENT" && (
              <>
                <form action={markQuotationStatus}>
                  <input type="hidden" name="quotationId" value={quotation.id} />
                  <input type="hidden" name="status" value="ACCEPTED" />
                  <button className="rounded-lg bg-brand-600 text-white text-sm font-medium px-4 py-2 hover:bg-brand-700">
                    Mark accepted
                  </button>
                </form>
                <form action={markQuotationStatus}>
                  <input type="hidden" name="quotationId" value={quotation.id} />
                  <input type="hidden" name="status" value="DECLINED" />
                  <button className="rounded-lg border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 hover:bg-gray-50">
                    Mark declined
                  </button>
                </form>
              </>
            )}
            {quotation.status === "ACCEPTED" && (
              <form action={convertToInvoice}>
                <input type="hidden" name="quotationId" value={quotation.id} />
                <button className="rounded-lg bg-brand-600 text-white text-sm font-medium px-4 py-2 hover:bg-brand-700">
                  Convert to invoice
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
