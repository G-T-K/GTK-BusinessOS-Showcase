"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { nextDocumentReference } from "@/lib/document-reference";
import { ensureMaxFormLines, readFormDate, readFormNumber, readFormText } from "@/lib/form-data";

async function requireBusinessId() {
  return (await requirePermission("sales")).businessId;
}

const MAX_LINES = 8;

export async function createQuotation(formData: FormData) {
  const businessId = await requireBusinessId();
  ensureMaxFormLines(formData, MAX_LINES, "A quotation");

  const customerId = readFormText(formData, "customerId", "Customer", { required: true, maxLength: 64 });
  const validUntil = readFormDate(formData, "validUntil", "valid-until date", true);

  const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId } });
  if (!customer) throw new Error("Customer not found");

  const lines: { productId: string; quantity: number }[] = [];
  for (let i = 0; i < MAX_LINES; i++) {
    const productId = readFormText(formData, `product_${i}`, "Product", { maxLength: 64 });
    if (!productId) continue;

    const quantity = readFormNumber(formData, `quantity_${i}`, "Quantity", {
      min: 0.001,
      max: 1_000_000_000_000,
      decimalPlaces: 3,
    });
    lines.push({ productId, quantity });
  }
  if (lines.length === 0) throw new Error("At least one line item is required");

  const products = await prisma.product.findMany({
    where: { businessId, active: true, id: { in: lines.map((l) => l.productId) } },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  let totalAmount = 0;
  const itemsData = lines.map((line) => {
    const product = productById.get(line.productId);
    if (!product) throw new Error("Product not found");
    const unitPrice = Number(product.sellingPrice);
    const lineTotal = Number((unitPrice * line.quantity).toFixed(2));
    totalAmount += lineTotal;
    return { productId: product.id, quantity: line.quantity, unitPrice, lineTotal };
  });
  totalAmount = Number(totalAmount.toFixed(2));
  if (!Number.isFinite(totalAmount) || totalAmount > 10_000_000_000_000_000) {
    throw new Error("Quotation total is outside the supported range");
  }

  const quotation = await prisma.$transaction(async (tx) => {
    const reference = await nextDocumentReference(tx, businessId, "QUO");
    return tx.quotation.create({
      data: {
        businessId,
        customerId,
        reference,
        status: "SENT",
        currency: "USD",
        exchangeRate: 1,
        totalAmount,
        totalBaseAmount: totalAmount,
        validUntil,
        items: { create: itemsData },
      },
    });
  });

  revalidatePath("/sales/quotations");
  redirect(`/sales/quotations/${quotation.id}`);
}

export async function markQuotationStatus(formData: FormData) {
  const businessId = await requireBusinessId();
  const quotationId = readFormText(formData, "quotationId", "Quotation", { required: true, maxLength: 64 });
  const statusValue = readFormText(formData, "status", "Status", { required: true });
  if (statusValue !== "ACCEPTED" && statusValue !== "DECLINED") {
    throw new Error("Choose a valid quotation status");
  }
  const status = statusValue;

  const quotation = await prisma.quotation.findFirst({ where: { id: quotationId, businessId } });
  if (!quotation) throw new Error("Quotation not found");
  if (quotation.status === "CONVERTED" || quotation.status === "EXPIRED") {
    throw new Error("This quotation can no longer be updated");
  }

  const update = await prisma.quotation.updateMany({
    where: { id: quotationId, businessId, status: quotation.status },
    data: { status },
  });
  if (update.count !== 1) throw new Error("Quotation changed. Refresh and try again.");
  revalidatePath(`/sales/quotations/${quotationId}`);
}

// Converts an accepted quotation into a real invoice: copies line items at their
// quoted prices, decrements stock, and marks the quotation as CONVERTED.
export async function convertToInvoice(formData: FormData) {
  const { businessId, userId } = await requirePermission("sales");
  const quotationId = readFormText(formData, "quotationId", "Quotation", { required: true, maxLength: 64 });

  const quotation = await prisma.quotation.findFirst({
    where: { id: quotationId, businessId },
    include: { items: true },
  });
  if (!quotation) throw new Error("Quotation not found");
  if (quotation.status !== "ACCEPTED") throw new Error("Only accepted quotations can be converted");

  const invoice = await prisma.$transaction(async (tx) => {
    const quotationUpdate = await tx.quotation.updateMany({
      where: { id: quotation.id, businessId, status: "ACCEPTED" },
      data: { status: "CONVERTED" },
    });
    if (quotationUpdate.count !== 1) throw new Error("Quotation changed or has already been converted");

    const reference = await nextDocumentReference(tx, businessId, "INV");
    const created = await tx.invoice.create({
      data: {
        businessId,
        customerId: quotation.customerId,
        quotationId: quotation.id,
        reference,
        status: "ISSUED",
        currency: quotation.currency,
        exchangeRate: quotation.exchangeRate,
        totalAmount: quotation.totalAmount,
        totalBaseAmount: quotation.totalBaseAmount,
        items: {
          create: quotation.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          })),
        },
      },
    });

    for (const item of quotation.items) {
      const stockUpdate = await tx.product.updateMany({
        where: {
          id: item.productId,
          businessId,
          active: true,
          quantityOnHand: { gte: item.quantity },
        },
        data: { quantityOnHand: { decrement: item.quantity } },
      });
      if (stockUpdate.count !== 1) {
        throw new Error("Insufficient stock for one or more invoice items");
      }

      await tx.stockMovement.create({
        data: {
          businessId,
          productId: item.productId,
          type: "SALE_OUT",
          quantity: item.quantity,
          reference: created.reference,
        },
      });
    }

    return created;
  });

  await logAction({
    businessId,
    userId,
    action: "quotation.converted_to_invoice",
    entityType: "Invoice",
    entityId: invoice.id,
    metadata: { quotationReference: quotation.reference, invoiceReference: invoice.reference },
  });

  revalidatePath("/sales/quotations");
  revalidatePath("/sales/invoices");
  revalidatePath("/inventory");
  redirect(`/sales/invoices/${invoice.id}`);
}
