"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { nextDocumentReference } from "@/lib/document-reference";
import { ensureMaxFormLines, readFormDate, readFormNumber, readFormText } from "@/lib/form-data";

// Reads up to MAX_LINES of (productId, quantity) pairs from the form, builds line
// items priced at the product's current selling price, decrements stock for each,
// and creates the invoice with computed totals.
const MAX_LINES = 8;

export async function createInvoice(formData: FormData) {
  const { businessId, userId } = await requirePermission("sales");
  ensureMaxFormLines(formData, MAX_LINES, "An invoice");

  const customerId = readFormText(formData, "customerId", "Customer", { required: true, maxLength: 64 });
  const dueDate = readFormDate(formData, "dueDate", "due date", true);

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
    return {
      productId: product.id,
      quantity: line.quantity,
      unitPrice,
      lineTotal,
    };
  });
  totalAmount = Number(totalAmount.toFixed(2));
  if (!Number.isFinite(totalAmount) || totalAmount > 10_000_000_000_000_000) {
    throw new Error("Invoice total is outside the supported range");
  }

  const invoice = await prisma.$transaction(async (tx) => {
    const reference = await nextDocumentReference(tx, businessId, "INV");
    const created = await tx.invoice.create({
      data: {
        businessId,
        customerId,
        reference,
        status: "ISSUED",
        currency: "USD",
        exchangeRate: 1,
        totalAmount,
        totalBaseAmount: totalAmount,
        dueDate,
        items: { create: itemsData },
      },
    });

    for (const line of itemsData) {
      const stockUpdate = await tx.product.updateMany({
        where: {
          id: line.productId,
          businessId,
          active: true,
          quantityOnHand: { gte: line.quantity },
        },
        data: { quantityOnHand: { decrement: line.quantity } },
      });
      if (stockUpdate.count !== 1) {
        throw new Error("Insufficient stock for one or more invoice items");
      }

      await tx.stockMovement.create({
        data: {
          businessId,
          productId: line.productId,
          type: "SALE_OUT",
          quantity: line.quantity,
          reference: created.reference,
        },
      });
    }

    return created;
  });

  revalidatePath("/sales/invoices");
  revalidatePath("/inventory");
  revalidatePath("/customers");

  await logAction({
    businessId,
    userId,
    action: "invoice.created",
    entityType: "Invoice",
    entityId: invoice.id,
    metadata: { reference: invoice.reference, totalAmount },
  });

  redirect(`/sales/invoices/${invoice.id}`);
}
