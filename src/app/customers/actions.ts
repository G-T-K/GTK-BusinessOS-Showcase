"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PaymentMethod } from "@prisma/client";
import { logAction } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { readFormNumber, readFormText } from "@/lib/form-data";
import {
  getInvoiceOutstandingBalance,
  paymentExceedsInvoiceBalance,
} from "@/lib/customer-invoice-balance";

async function requireBusinessId() {
  return (await requirePermission("sales")).businessId;
}

export async function createCustomer(formData: FormData) {
  const businessId = await requireBusinessId();

  const name = readFormText(formData, "name", "Customer name", { required: true, maxLength: 120 });
  const phone = readFormText(formData, "phone", "Phone number", { maxLength: 40 }) || null;
  const email = readFormText(formData, "email", "Email", { maxLength: 254 }).toLowerCase() || null;
  const address = readFormText(formData, "address", "Address", { maxLength: 500 }) || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid customer email address");

  const customer = await prisma.customer.create({
    data: { businessId, name, phone, email, address },
  });

  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

// Records a payment against a customer, optionally applied to a specific invoice.
// Updates the invoice's amountPaidBase and status, and creates a matching Receipt.
export async function recordPayment(formData: FormData) {
  const { businessId, userId } = await requirePermission("sales");

  const customerId = readFormText(formData, "customerId", "Customer", { required: true, maxLength: 64 });
  const invoiceId = readFormText(formData, "invoiceId", "Invoice", { maxLength: 64 }) || null;
  const accountId = readFormText(formData, "accountId", "Account", { required: true, maxLength: 64 });
  const amount = readFormNumber(formData, "amount", "Amount", {
    min: 0.01,
    max: 9_000_000_000_000_000,
    decimalPlaces: 2,
  });
  const methodValue = readFormText(formData, "method", "Payment method", { required: true });

  if (!Object.values(PaymentMethod).includes(methodValue as PaymentMethod)) {
    throw new Error("Select a valid payment method");
  }
  const method = methodValue as PaymentMethod;

  const [customer, account, business] = await Promise.all([
    prisma.customer.findFirst({ where: { id: customerId, businessId } }),
    prisma.financialAccount.findFirst({ where: { id: accountId, businessId, active: true } }),
    prisma.business.findUnique({ where: { id: businessId }, select: { baseCurrency: true } }),
  ]);
  if (!customer) throw new Error("Customer not found");
  if (!account) throw new Error("Choose an active cash or bank account");
  if (!business) throw new Error("Business not found");
  if (account.openingDate > new Date()) throw new Error("Account is not open yet");

  const { payment, receiptReference } = await prisma.$transaction(async (tx) => {
    const invoice = invoiceId
      ? await tx.invoice.findFirst({
          where: {
            id: invoiceId,
            businessId,
            customerId,
            status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
          },
        })
      : null;

    if (invoiceId && !invoice) throw new Error("Choose an open invoice for this customer");
    if (invoice) {
      const allocatedPayments = await tx.payment.aggregate({
        where: { invoiceId: invoice.id, businessId },
        _sum: { baseAmount: true },
      });
      const allocatedAmount = Number(allocatedPayments._sum.baseAmount ?? 0);
      const balance = getInvoiceOutstandingBalance(Number(invoice.totalBaseAmount), [allocatedAmount]);
      if (balance <= 0) throw new Error("Choose an open invoice for this customer");
      if (paymentExceedsInvoiceBalance(amount, balance)) {
        throw new Error("Payment cannot exceed the invoice balance");
      }
    }

    const payment = await tx.payment.create({
      data: {
        businessId,
        customerId,
        invoiceId,
        accountId,
        method,
        currency: business.baseCurrency,
        exchangeRate: 1,
        amount,
        baseAmount: amount,
      },
    });

    const reference = `REC-${payment.id.slice(-8).toUpperCase()}`;
    await tx.receipt.create({
      data: {
        businessId,
        customerId,
        invoiceId,
        paymentId: payment.id,
        reference,
      },
    });

    if (invoice) {
      const allocatedPayments = await tx.payment.aggregate({
        where: { invoiceId: invoice.id, businessId },
        _sum: { baseAmount: true },
      });
      const paidAfterPayment = Number(allocatedPayments._sum.baseAmount ?? 0);
      const updateResult = await tx.invoice.updateMany({
        where: {
          id: invoice.id,
          businessId,
          customerId,
          amountPaidBase: invoice.amountPaidBase,
          status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
        },
        data: {
          amountPaidBase: paidAfterPayment,
          status: getInvoiceOutstandingBalance(Number(invoice.totalBaseAmount), [paidAfterPayment]) === 0
            ? "PAID"
            : "PARTIALLY_PAID",
        },
      });
      if (updateResult.count !== 1) throw new Error("Invoice changed while recording payment. Refresh and try again.");
    }

    return { payment, receiptReference: reference };
  });

  await logAction({
    businessId,
    userId,
    action: "payment.recorded",
    entityType: "Payment",
    entityId: payment.id,
    metadata: { amount, method, invoiceId, customerId, accountId, accountName: account.name, receiptReference },
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/finance/accounts");
  revalidatePath(`/finance/accounts/${accountId}`);
}

export async function allocatePaymentToInvoice(formData: FormData) {
  const { businessId, userId } = await requirePermission("sales");

  const customerId = readFormText(formData, "customerId", "Customer", { required: true, maxLength: 64 });
  const paymentId = readFormText(formData, "paymentId", "Payment", { required: true, maxLength: 64 });
  const invoiceId = readFormText(formData, "invoiceId", "Invoice", { required: true, maxLength: 64 });

  const allocation = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, businessId, customerId, invoiceId: null },
      include: { receipt: true },
    });
    if (!payment) throw new Error("This payment is missing or has already been allocated");

    const invoice = await tx.invoice.findFirst({
      where: {
        id: invoiceId,
        businessId,
        customerId,
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      },
    });
    if (!invoice) throw new Error("Choose an open invoice for this customer");

    const amount = Number(payment.baseAmount);
    const allocatedPayments = await tx.payment.aggregate({
      where: { invoiceId: invoice.id, businessId },
      _sum: { baseAmount: true },
    });
    const allocatedAmount = Number(allocatedPayments._sum.baseAmount ?? 0);
    const balance = getInvoiceOutstandingBalance(Number(invoice.totalBaseAmount), [allocatedAmount]);
    if (amount <= 0 || balance <= 0 || paymentExceedsInvoiceBalance(amount, balance)) {
      throw new Error("The invoice balance is too small for this full payment");
    }

    const paidAfterPayment = Math.round((allocatedAmount + amount) * 100) / 100;
    const invoiceUpdate = await tx.invoice.updateMany({
      where: {
        id: invoice.id,
        businessId,
        customerId,
        amountPaidBase: invoice.amountPaidBase,
        status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] },
      },
      data: {
        amountPaidBase: paidAfterPayment,
        status: getInvoiceOutstandingBalance(Number(invoice.totalBaseAmount), [paidAfterPayment]) === 0
          ? "PAID"
          : "PARTIALLY_PAID",
      },
    });
    if (invoiceUpdate.count !== 1) throw new Error("Invoice changed while allocating. Refresh and try again.");

    const paymentUpdate = await tx.payment.updateMany({
      where: { id: payment.id, businessId, customerId, invoiceId: null },
      data: { invoiceId: invoice.id },
    });
    if (paymentUpdate.count !== 1) throw new Error("Payment was allocated elsewhere. Refresh and try again.");

    const receiptReference = payment.receipt?.reference ?? `REC-${payment.id.slice(-8).toUpperCase()}`;
    if (payment.receipt) {
      const receiptUpdate = await tx.receipt.updateMany({
        where: { paymentId: payment.id, businessId, invoiceId: null },
        data: { invoiceId: invoice.id },
      });
      if (receiptUpdate.count !== 1) throw new Error("Receipt changed while allocating. Refresh and try again.");
    } else {
      await tx.receipt.create({
        data: {
          businessId,
          customerId,
          invoiceId: invoice.id,
          paymentId: payment.id,
          reference: receiptReference,
        },
      });
    }

    return { amount, invoiceId: invoice.id, invoiceReference: invoice.reference, receiptReference };
  });

  await logAction({
    businessId,
    userId,
    action: "payment.allocated",
    entityType: "Payment",
    entityId: paymentId,
    metadata: { customerId, invoiceId: allocation.invoiceId, invoiceReference: allocation.invoiceReference, amount: allocation.amount, receiptReference: allocation.receiptReference },
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/sales/invoices");
  revalidatePath("/settings/audit-log");
}
