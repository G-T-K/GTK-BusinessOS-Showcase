import { prisma } from "@/lib/prisma";
import { createSalesDocumentPdf } from "@/lib/sales-document-pdf";
import { getPermissionContext } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const access = await getPermissionContext("sales");
  if (!access.allowed) return new Response(access.status === 401 ? "Unauthorized" : "Forbidden", { status: access.status });
  const { businessId } = access.context;
  const quotation = await prisma.quotation.findFirst({
    where: { id: params.id, businessId },
    include: {
      business: {
        select: {
          name: true,
          address: true,
          phone: true,
          email: true,
          website: true,
          logo: true,
          logoMimeType: true,
          baseCurrency: true,
        },
      },
      customer: { select: { name: true, address: true, email: true, phone: true } },
      items: { include: { product: { select: { name: true } } } },
    },
  });

  if (!quotation) return new Response("Quotation not found", { status: 404 });

  const bytes = await createSalesDocumentPdf({
    kind: "Quotation",
    reference: quotation.reference,
    status: quotation.status,
    business: quotation.business,
    customer: quotation.customer,
    currency: quotation.currency,
    createdAt: quotation.createdAt,
    validUntil: quotation.validUntil,
    lines: quotation.items.map((item) => ({
      name: item.product.name,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      total: Number(item.lineTotal),
    })),
    total: Number(quotation.totalAmount),
    totalBase: Number(quotation.totalBaseAmount),
  });

  const filename = `${quotation.reference.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}