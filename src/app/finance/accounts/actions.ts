"use server";

import { FinancialAccountType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { readFormDate, readFormNumber, readFormText } from "@/lib/form-data";

async function getFinanceActor() {
  const { businessId, userId } = await requirePermission("finance");
  return {
    businessId,
    userId,
  };
}

export async function createFinancialAccount(formData: FormData) {
  const actor = await getFinanceActor();

  const name = readFormText(formData, "name", "Account name", { required: true, maxLength: 80 });
  const typeValue = readFormText(formData, "type", "Account type", { required: true });
  if (!Object.values(FinancialAccountType).includes(typeValue as FinancialAccountType)) {
    throw new Error("Choose Cash or Bank");
  }
  const type = typeValue as FinancialAccountType;
  const openingBalance = readFormNumber(formData, "openingBalance", "Opening balance", {
    min: 0,
    max: 9_000_000_000_000_000,
    decimalPlaces: 2,
  });
  const openingDate = readFormDate(formData, "openingDate", "opening date", true) ?? new Date();

  const existingAccount = await prisma.financialAccount.findUnique({
    where: { businessId_name: { businessId: actor.businessId, name } },
    select: { id: true },
  });
  if (existingAccount) redirect("/finance/accounts?error=duplicate-account-name");

  let account;
  try {
    account = await prisma.financialAccount.create({
      data: {
        businessId: actor.businessId,
        name,
        type,
        openingBalance,
        openingDate,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/finance/accounts?error=duplicate-account-name");
    }
    throw error;
  }

  await logAction({
    businessId: actor.businessId,
    userId: actor.userId,
    action: "financial_account.created",
    entityType: "FinancialAccount",
    entityId: account.id,
    metadata: { name, type, openingBalance },
  });

  revalidatePath("/finance/accounts");
}

export async function assignFinancialEntry(formData: FormData) {
  const actor = await getFinanceActor();

  const accountId = readFormText(formData, "accountId", "Account", { required: true, maxLength: 64 });
  const entryType = readFormText(formData, "entryType", "Transaction type", { required: true });
  const entryId = readFormText(formData, "entryId", "Transaction", { required: true, maxLength: 64 });
  if (!accountId || !entryId || !["PAYMENT", "EXPENSE"].includes(entryType)) {
    throw new Error("Choose an account and valid transaction");
  }

  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, businessId: actor.businessId, active: true },
  });
  if (!account) throw new Error("Account not found");

  let transactionDate: Date;
  if (entryType === "PAYMENT") {
    const payment = await prisma.payment.findFirst({
      where: { id: entryId, businessId: actor.businessId, accountId: null, reconciliationId: null },
      select: { id: true, paidAt: true, baseAmount: true, customer: { select: { name: true } } },
    });
    if (!payment) throw new Error("Payment is already assigned or does not exist");
    transactionDate = payment.paidAt;
    if (transactionDate < account.openingDate) throw new Error("Set the account opening date before this payment to assign it");
    const updated = await prisma.payment.updateMany({
      where: { id: payment.id, businessId: actor.businessId, accountId: null, reconciliationId: null },
      data: { accountId },
    });
    if (updated.count !== 1) throw new Error("Payment was assigned elsewhere. Refresh and try again.");
    await logAction({
      businessId: actor.businessId,
      userId: actor.userId,
      action: "financial_entry.assigned",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { accountId, accountName: account.name, customerName: payment.customer.name, amount: Number(payment.baseAmount) },
    });
  } else {
    const expense = await prisma.expense.findFirst({
      where: { id: entryId, businessId: actor.businessId, accountId: null, reconciliationId: null },
      select: { id: true, incurredAt: true, baseAmount: true, description: true },
    });
    if (!expense) throw new Error("Expense is already assigned or does not exist");
    transactionDate = expense.incurredAt;
    if (transactionDate < account.openingDate) throw new Error("Set the account opening date before this expense to assign it");
    const updated = await prisma.expense.updateMany({
      where: { id: expense.id, businessId: actor.businessId, accountId: null, reconciliationId: null },
      data: { accountId },
    });
    if (updated.count !== 1) throw new Error("Expense was assigned elsewhere. Refresh and try again.");
    await logAction({
      businessId: actor.businessId,
      userId: actor.userId,
      action: "financial_entry.assigned",
      entityType: "Expense",
      entityId: expense.id,
      metadata: { accountId, accountName: account.name, description: expense.description, amount: Number(expense.baseAmount) },
    });
  }

  revalidatePath("/finance/accounts");
  revalidatePath(`/finance/accounts/${accountId}`);
  revalidatePath("/settings/audit-log");
}

export async function createFinancialTransfer(formData: FormData) {
  const actor = await getFinanceActor();

  const fromAccountId = readFormText(formData, "fromAccountId", "Source account", { required: true, maxLength: 64 });
  const toAccountId = readFormText(formData, "toAccountId", "Destination account", { required: true, maxLength: 64 });
  const amount = readFormNumber(formData, "amount", "Amount", {
    min: 0.01,
    max: 9_000_000_000_000_000,
    decimalPlaces: 2,
  });
  const transferDate = readFormDate(formData, "transferDate", "transfer date", true) ?? new Date();
  const reference = readFormText(formData, "reference", "Reference", { maxLength: 100 }) || null;
  const note = readFormText(formData, "note", "Note", { maxLength: 300 }) || null;

  if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
    throw new Error("Choose two different accounts for the transfer");
  }

  const transfer = await prisma.$transaction(async (tx) => {
    const [fromAccount, toAccount] = await Promise.all([
      tx.financialAccount.findFirst({ where: { id: fromAccountId, businessId: actor.businessId, active: true } }),
      tx.financialAccount.findFirst({ where: { id: toAccountId, businessId: actor.businessId, active: true } }),
    ]);
    if (!fromAccount || !toAccount) throw new Error("Choose active accounts from this business");
    if (transferDate < fromAccount.openingDate || transferDate < toAccount.openingDate) {
      throw new Error("Transfer date must be on or after both account opening dates");
    }

    const [payments, expenses, transfersIn, transfersOut] = await Promise.all([
      tx.payment.aggregate({ where: { businessId: actor.businessId, accountId: fromAccountId, paidAt: { gte: fromAccount.openingDate, lte: transferDate } }, _sum: { baseAmount: true } }),
      tx.expense.aggregate({ where: { businessId: actor.businessId, accountId: fromAccountId, incurredAt: { gte: fromAccount.openingDate, lte: transferDate } }, _sum: { baseAmount: true } }),
      tx.financialTransfer.aggregate({ where: { businessId: actor.businessId, toAccountId: fromAccountId, transferDate: { gte: fromAccount.openingDate, lte: transferDate } }, _sum: { amount: true } }),
      tx.financialTransfer.aggregate({ where: { businessId: actor.businessId, fromAccountId, transferDate: { gte: fromAccount.openingDate, lte: transferDate } }, _sum: { amount: true } }),
    ]);
    const sourceBalance = Number(fromAccount.openingBalance)
      + Number(payments._sum.baseAmount ?? 0)
      - Number(expenses._sum.baseAmount ?? 0)
      + Number(transfersIn._sum.amount ?? 0)
      - Number(transfersOut._sum.amount ?? 0);
    if (amount > sourceBalance + 0.005) throw new Error("Transfer exceeds the source account's available book balance");

    return tx.financialTransfer.create({
      data: {
        businessId: actor.businessId,
        fromAccountId,
        toAccountId,
        amount,
        transferDate,
        reference,
        note,
        userId: actor.userId ?? null,
      },
    });
  });

  await logAction({
    businessId: actor.businessId,
    userId: actor.userId,
    action: "financial_transfer.created",
    entityType: "FinancialTransfer",
    entityId: transfer.id,
    metadata: { fromAccountId, toAccountId, amount, reference },
  });

  revalidatePath("/finance/accounts");
  revalidatePath(`/finance/accounts/${fromAccountId}`);
  revalidatePath(`/finance/accounts/${toAccountId}`);
  revalidatePath("/settings/audit-log");
}

export async function reconcileFinancialAccount(formData: FormData) {
  const actor = await getFinanceActor();

  const accountId = readFormText(formData, "accountId", "Account", { required: true, maxLength: 64 });
  const statementDate = readFormDate(formData, "statementDate", "statement date");
  const statementBalance = readFormNumber(formData, "statementBalance", "Statement balance", {
    min: -9_000_000_000_000_000,
    max: 9_000_000_000_000_000,
    decimalPlaces: 2,
  });
  const readIds = (key: string) => {
    const values = formData.getAll(key);
    if (values.length > 100 || values.some((value) => typeof value !== "string" || value.length > 64)) {
      throw new Error("Too many or invalid reconciliation items");
    }
    return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
  };
  const paymentIds = readIds("paymentIds");
  const expenseIds = readIds("expenseIds");
  const transferInIds = readIds("transferInIds");
  const transferOutIds = readIds("transferOutIds");
  const statementEnd = new Date(statementDate.getTime() + 24 * 60 * 60 * 1000 - 1);

  const reconciliation = await prisma.$transaction(async (tx) => {
    const account = await tx.financialAccount.findFirst({
      where: { id: accountId, businessId: actor.businessId, active: true },
    });
    if (!account) throw new Error("Account not found");

    const previous = await tx.financialReconciliation.findFirst({
      where: { accountId, businessId: actor.businessId },
      orderBy: { statementDate: "desc" },
    });
    const previousBalance = previous ? Number(previous.statementBalance) : Number(account.openingBalance);
    if (statementDate <= (previous?.statementDate ?? new Date(account.openingDate.getTime() - 24 * 60 * 60 * 1000))) {
      throw new Error("Statement date must be after the previous reconciliation or account opening date");
    }

    const payments = paymentIds.length > 0
      ? await tx.payment.findMany({
          where: {
            id: { in: paymentIds },
            businessId: actor.businessId,
            accountId,
            reconciliationId: null,
            paidAt: { gte: account.openingDate, lte: statementEnd },
          },
          select: { id: true, baseAmount: true },
        })
      : [];
    const expenses = expenseIds.length > 0
      ? await tx.expense.findMany({
          where: {
            id: { in: expenseIds },
            businessId: actor.businessId,
            accountId,
            reconciliationId: null,
            incurredAt: { gte: account.openingDate, lte: statementEnd },
          },
          select: { id: true, baseAmount: true },
        })
      : [];

    const transfersIn = transferInIds.length > 0
      ? await tx.financialTransfer.findMany({
          where: {
            id: { in: transferInIds },
            businessId: actor.businessId,
            toAccountId: accountId,
            toReconciliationId: null,
            transferDate: { gte: account.openingDate, lte: statementEnd },
          },
          select: { id: true, amount: true },
        })
      : [];
    const transfersOut = transferOutIds.length > 0
      ? await tx.financialTransfer.findMany({
          where: {
            id: { in: transferOutIds },
            businessId: actor.businessId,
            fromAccountId: accountId,
            fromReconciliationId: null,
            transferDate: { gte: account.openingDate, lte: statementEnd },
          },
          select: { id: true, amount: true },
        })
      : [];

    if (
      payments.length !== paymentIds.length
      || expenses.length !== expenseIds.length
      || transfersIn.length !== transferInIds.length
      || transfersOut.length !== transferOutIds.length
    ) {
      throw new Error("One or more selected items are outside this statement period or already reconciled");
    }

    const expectedBalance = previousBalance
      + payments.reduce((sum, payment) => sum + Number(payment.baseAmount), 0)
      - expenses.reduce((sum, expense) => sum + Number(expense.baseAmount), 0)
      + transfersIn.reduce((sum, transfer) => sum + Number(transfer.amount), 0)
      - transfersOut.reduce((sum, transfer) => sum + Number(transfer.amount), 0);
    if (Math.abs(expectedBalance - statementBalance) > 0.005) {
      throw new Error(`Selected items do not match the statement balance. Expected ${expectedBalance.toFixed(2)}.`);
    }

    const saved = await tx.financialReconciliation.create({
      data: {
        businessId: actor.businessId,
        accountId,
        statementDate,
        previousStatementDate: previous?.statementDate ?? null,
        previousStatementBalance: previousBalance,
        statementBalance,
        expectedBalance,
        userId: actor.userId ?? null,
      },
    });

    if (paymentIds.length > 0) {
      const updated = await tx.payment.updateMany({
        where: { id: { in: paymentIds }, businessId: actor.businessId, accountId, reconciliationId: null },
        data: { reconciliationId: saved.id },
      });
      if (updated.count !== paymentIds.length) throw new Error("A payment changed during reconciliation. Refresh and try again.");
    }
    if (expenseIds.length > 0) {
      const updated = await tx.expense.updateMany({
        where: { id: { in: expenseIds }, businessId: actor.businessId, accountId, reconciliationId: null },
        data: { reconciliationId: saved.id },
      });
      if (updated.count !== expenseIds.length) throw new Error("An expense changed during reconciliation. Refresh and try again.");
    }
    if (transferInIds.length > 0) {
      const updated = await tx.financialTransfer.updateMany({
        where: { id: { in: transferInIds }, businessId: actor.businessId, toAccountId: accountId, toReconciliationId: null },
        data: { toReconciliationId: saved.id },
      });
      if (updated.count !== transferInIds.length) throw new Error("An incoming transfer changed during reconciliation. Refresh and try again.");
    }
    if (transferOutIds.length > 0) {
      const updated = await tx.financialTransfer.updateMany({
        where: { id: { in: transferOutIds }, businessId: actor.businessId, fromAccountId: accountId, fromReconciliationId: null },
        data: { fromReconciliationId: saved.id },
      });
      if (updated.count !== transferOutIds.length) throw new Error("An outgoing transfer changed during reconciliation. Refresh and try again.");
    }

    return saved;
  });

  await logAction({
    businessId: actor.businessId,
    userId: actor.userId,
    action: "financial_account.reconciled",
    entityType: "FinancialReconciliation",
    entityId: reconciliation.id,
    metadata: {
      accountId,
      statementDate: statementDate.toISOString().slice(0, 10),
      statementBalance,
      paymentIds,
      expenseIds,
      transferInIds,
      transferOutIds,
    },
  });

  revalidatePath("/finance/accounts");
  revalidatePath(`/finance/accounts/${accountId}`);
  revalidatePath("/settings/audit-log");
}