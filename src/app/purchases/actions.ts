"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { requirePermission, type Permission } from "@/lib/permissions";
import { PaymentMethod } from "@prisma/client";
import { ensureMaxFormLines, readFormDate, readFormNumber, readFormText } from "@/lib/form-data";

const { calculatePurchaseTotals } = require("@/lib/purchase-tax");
const MAX_AMOUNT = 9_000_000_000_000_000;

function getPurchaseTotals(subtotal: number, taxRate: number) {
  const totals = calculatePurchaseTotals(subtotal, taxRate);
  if (
    !Number.isFinite(totals.subtotal) ||
    !Number.isFinite(totals.taxAmount) ||
    !Number.isFinite(totals.total) ||
    totals.subtotal < 0 ||
    totals.taxAmount < 0 ||
    totals.total > MAX_AMOUNT
  ) {
    throw new Error("Purchase total is outside the supported range");
  }
  return totals;
}

async function requireBusinessContext(permission: Permission) {
  const { businessId, userId } = await requirePermission(permission);
  return {
    businessId,
    userId,
  };
}

function getPurchaseLines(formData: FormData) {
  ensureMaxFormLines(formData, MAX_LINES, "A purchase");
  const lines: { productId: string; quantity: number; unitCost: number }[] = [];
  for (let i = 0; i < MAX_LINES; i++) {
    const productId = readFormText(formData, `product_${i}`, "Product", { maxLength: 64 });
    if (!productId) continue;

    const quantity = readFormNumber(formData, `quantity_${i}`, "Quantity", {
      min: 0.001,
      max: 1_000_000_000_000,
      decimalPlaces: 3,
    });
    const unitCost = readFormNumber(formData, `unitCost_${i}`, "Unit cost", {
      min: 0,
      max: 9_000_000_000_000_000,
      decimalPlaces: 2,
    });
    lines.push({ productId, quantity, unitCost });
  }
  return lines;
}

const MAX_LINES = 8;

async function validatePurchaseReferences(businessId: string, supplierId: string | null, taxRateId: string | null) {
  const [supplier, taxRate] = await Promise.all([
    supplierId
      ? prisma.supplier.findFirst({ where: { id: supplierId, businessId }, select: { id: true } })
      : null,
    taxRateId
      ? prisma.taxRate.findFirst({ where: { id: taxRateId, businessId, active: true }, select: { id: true, rate: true } })
      : null,
  ]);
  if (supplierId && !supplier) throw new Error("Supplier not found");
  if (taxRateId && !taxRate) throw new Error("Tax rate not found");
  return taxRate;
}

async function validatePurchaseProducts(
  businessId: string,
  lines: { productId: string; quantity: number; unitCost: number }[],
) {
  const products = await prisma.product.findMany({
    where: { businessId, active: true, id: { in: lines.map((line) => line.productId) } },
    select: { id: true },
  });
  if (products.length !== new Set(lines.map((line) => line.productId)).size) {
    throw new Error("One or more products are unavailable");
  }
}

export async function createSupplier(formData: FormData) {
  const { businessId } = await requireBusinessContext("purchasing");

  const name = readFormText(formData, "name", "Supplier name", { required: true, maxLength: 120 });
  const phone = readFormText(formData, "phone", "Phone number", { maxLength: 40 }) || null;
  const email = readFormText(formData, "email", "Email", { maxLength: 254 }).toLowerCase() || null;
  const address = readFormText(formData, "address", "Address", { maxLength: 500 }) || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid supplier email address");

  await prisma.supplier.create({ data: { businessId, name, phone, email, address } });

  revalidatePath("/purchases/suppliers");
  redirect("/purchases/suppliers");
}

export async function createSupplierBill(formData: FormData) {
  const { businessId, userId } = await requireBusinessContext("finance");

  const supplierId = readFormText(formData, "supplierId", "Supplier", { required: true, maxLength: 64 });
  const reference = readFormText(formData, "reference", "Bill reference", { required: true, maxLength: 100 });
  const billDate = readFormDate(formData, "billDate", "bill date", true) ?? new Date();
  const dueDate = readFormDate(formData, "dueDate", "due date", true);
  const subtotal = readFormNumber(formData, "subtotal", "Subtotal", { min: 0.01, max: 9_000_000_000_000_000, decimalPlaces: 2 });
  const taxRateId = readFormText(formData, "taxRateId", "Tax rate", { maxLength: 64 }) || null;
  if (dueDate && dueDate < billDate) throw new Error("Due date must be on or after the bill date");

  const [supplier, taxRate] = await Promise.all([
    prisma.supplier.findFirst({ where: { id: supplierId, businessId }, select: { id: true } }),
    validatePurchaseReferences(businessId, null, taxRateId),
  ]);
  if (!supplier) throw new Error("Supplier not found");
  const totals = getPurchaseTotals(subtotal, Number(taxRate?.rate ?? 0));

  const bill = await prisma.supplierBill.create({
    data: {
      businessId,
      supplierId,
      reference,
      billDate,
      dueDate,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      totalAmount: totals.total,
      totalBaseAmount: totals.total,
      paidAmount: 0,
      status: "OPEN",
    },
  });

  await logAction({
    businessId,
    userId,
    action: "supplier_bill.created",
    entityType: "SupplierBill",
    entityId: bill.id,
    metadata: { supplierId, subtotal: totals.subtotal, taxAmount: totals.taxAmount, totalAmount: totals.total },
  });

  revalidatePath("/purchases/bills");
  revalidatePath("/purchases/payables");
  redirect("/purchases/payables");
}

export async function recordSupplierPayment(formData: FormData) {
  const { businessId, userId } = await requireBusinessContext("finance");

  const billId = readFormText(formData, "billId", "Bill", { required: true, maxLength: 64 });
  const supplierId = readFormText(formData, "supplierId", "Supplier", { required: true, maxLength: 64 });
  const accountId = readFormText(formData, "accountId", "Account", { required: true, maxLength: 64 });
  const amount = readFormNumber(formData, "amount", "Amount", { min: 0.01, max: 9_000_000_000_000_000, decimalPlaces: 2 });
  const methodValue = readFormText(formData, "method", "Payment method", { required: true });
  if (!Object.values(PaymentMethod).includes(methodValue as PaymentMethod)) {
    throw new Error("Choose a valid payment method");
  }
  const method = methodValue as PaymentMethod;

  const payment = await prisma.$transaction(async (tx) => {
    const [bill, supplier, account] = await Promise.all([
      tx.supplierBill.findFirst({
        where: { id: billId, businessId, supplierId, status: { in: ["OPEN", "PARTIALLY_PAID"] } },
      }),
      tx.supplier.findFirst({ where: { id: supplierId, businessId }, select: { id: true } }),
      tx.financialAccount.findFirst({ where: { id: accountId, businessId, active: true } }),
    ]);
    if (!bill) throw new Error("Supplier bill not found");
    if (!supplier) throw new Error("Supplier not found");
    if (!account) throw new Error("Choose an active account from this business");
    if (account.openingDate > new Date()) throw new Error("Account is not open yet");
    if (amount > Number(bill.totalAmount) - Number(bill.paidAmount) + 0.005) {
      throw new Error("Payment cannot exceed the supplier bill balance");
    }

    const nextPaid = Number(bill.paidAmount) + amount;
    const status = nextPaid >= Number(bill.totalAmount) ? "PAID" : "PARTIALLY_PAID";

    const created = await tx.supplierPayment.create({
      data: {
        businessId,
        supplierId,
        billId,
        accountId,
        method,
        reference: `SUP-${Date.now().toString().slice(-6)}`,
        amount,
      },
    });

    const updatedBill = await tx.supplierBill.updateMany({
      where: {
        id: billId,
        businessId,
        supplierId,
        paidAmount: bill.paidAmount,
        status: { in: ["OPEN", "PARTIALLY_PAID"] },
      },
      data: {
        paidAmount: nextPaid,
        status,
      },
    });
    if (updatedBill.count !== 1) throw new Error("Supplier bill changed during payment. Refresh and try again.");

    return created;
  });

  await logAction({
    businessId,
    userId,
    action: "supplier_payment.recorded",
    entityType: "SupplierPayment",
    entityId: payment.id,
    metadata: { billId, supplierId, amount, accountId },
  });

  revalidatePath("/purchases/payables");
  revalidatePath("/purchases/bills");
  redirect("/purchases/payables");
}

export async function createPurchaseOrder(formData: FormData) {
  const { businessId, userId } = await requireBusinessContext("purchasing");
  const supplierId = readFormText(formData, "supplierId", "Supplier", { maxLength: 64 }) || null;
  const taxRateId = readFormText(formData, "taxRateId", "Tax rate", { maxLength: 64 }) || null;
  const lines = getPurchaseLines(formData);

  if (lines.length === 0) throw new Error("At least one line item is required");
  const [taxRate] = await Promise.all([
    validatePurchaseReferences(businessId, supplierId, taxRateId),
    validatePurchaseProducts(businessId, lines),
  ]);

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  if (!Number.isFinite(subtotal) || subtotal <= 0 || subtotal > 9_000_000_000_000_000) {
    throw new Error("Purchase subtotal is outside the supported range");
  }
  const totals = getPurchaseTotals(subtotal, Number(taxRate?.rate ?? 0));

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.purchaseOrder.create({
      data: {
        businessId,
        supplierId,
        taxRateId,
        reference: `PO-${randomUUID()}`,
        status: "DRAFT",
        currency: "USD",
        exchangeRate: 1,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.total,
        totalBaseAmount: totals.total,
        items: {
          create: lines.map((line) => {
            const lineSubtotal = line.quantity * line.unitCost;
            const lineTax = calculatePurchaseTotals(lineSubtotal, Number(taxRate?.rate ?? 0)).taxAmount;
            return {
              productId: line.productId,
              quantity: line.quantity,
              unitCost: line.unitCost,
              taxRateId,
              taxAmount: lineTax,
              lineTotal: Number((lineSubtotal + lineTax).toFixed(2)),
            };
          }),
        },
      },
    });

    return created;
  });

  await logAction({
    businessId,
    userId,
    action: "purchase_order.created",
    entityType: "PurchaseOrder",
    entityId: order.id,
    metadata: { subtotal: totals.subtotal, taxAmount: totals.taxAmount, totalAmount: totals.total },
  });

  revalidatePath("/purchases");
  redirect("/purchases");
}

// Creates a purchase and immediately marks it RECEIVED, incrementing stock for
// each line item.
export async function createPurchase(formData: FormData) {
  const { businessId, userId } = await requireBusinessContext("purchasing");

  const supplierId = readFormText(formData, "supplierId", "Supplier", { maxLength: 64 }) || null;
  const taxRateId = readFormText(formData, "taxRateId", "Tax rate", { maxLength: 64 }) || null;
  const lines = getPurchaseLines(formData);

  if (lines.length === 0) throw new Error("At least one line item is required");
  const [taxRate] = await Promise.all([
    validatePurchaseReferences(businessId, supplierId, taxRateId),
    validatePurchaseProducts(businessId, lines),
  ]);

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
  if (!Number.isFinite(subtotal) || subtotal <= 0 || subtotal > 9_000_000_000_000_000) {
    throw new Error("Purchase subtotal is outside the supported range");
  }
  const totals = getPurchaseTotals(subtotal, Number(taxRate?.rate ?? 0));

  const purchase = await prisma.$transaction(async (tx) => {
    const created = await tx.purchase.create({
      data: {
        businessId,
        supplierId,
        taxRateId,
        status: "RECEIVED",
        currency: "USD",
        exchangeRate: 1,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.total,
        totalBaseAmount: totals.total,
        receivedAt: new Date(),
        items: {
          create: lines.map((line) => {
            const lineSubtotal = line.quantity * line.unitCost;
            const lineTax = calculatePurchaseTotals(lineSubtotal, Number(taxRate?.rate ?? 0)).taxAmount;
            return {
              productId: line.productId,
              quantity: line.quantity,
              unitCost: line.unitCost,
              taxRateId,
              taxAmount: lineTax,
              lineTotal: Number((lineSubtotal + lineTax).toFixed(2)),
            };
          }),
        },
      },
    });

    for (const line of lines) {
      const productUpdate = await tx.product.updateMany({
        where: { id: line.productId, businessId, active: true },
        data: {
          quantityOnHand: { increment: line.quantity },
          costPrice: line.unitCost,
        },
      });
      if (productUpdate.count !== 1) throw new Error("One or more products are unavailable");

      await tx.stockMovement.create({
        data: {
          businessId,
          productId: line.productId,
          type: "PURCHASE_IN",
          quantity: line.quantity,
          reference: created.id,
        },
      });
    }

    return created;
  });

  await logAction({
    businessId,
    userId,
    action: "purchase.received",
    entityType: "Purchase",
    entityId: purchase.id,
    metadata: { subtotal: totals.subtotal, taxAmount: totals.taxAmount, totalAmount: totals.total, lineCount: lines.length },
  });

  revalidatePath("/purchases");
  revalidatePath("/inventory");
  redirect(`/purchases/${purchase.id}`);
}
