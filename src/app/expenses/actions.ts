"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { requirePermission } from "@/lib/permissions";
import { readFormDate, readFormNumber, readFormText } from "@/lib/form-data";

async function requireBusinessId() {
  const { businessId, userId } = await requirePermission("finance");
  return {
    businessId,
    userId,
  };
}

export async function createExpense(formData: FormData) {
  const { businessId, userId } = await requireBusinessId();

  const description = readFormText(formData, "description", "Description", { required: true, maxLength: 300 });
  const amount = readFormNumber(formData, "amount", "Amount", {
    min: 0.01,
    max: 9_000_000_000_000_000,
    decimalPlaces: 2,
  });
  const incurredAt = readFormDate(formData, "incurredAt", "expense date", true) ?? new Date();
  const accountId = readFormText(formData, "accountId", "Account", { required: true, maxLength: 64 });
  const categoryName = readFormText(formData, "categoryName", "Category", { maxLength: 80 });

  const [account, business] = await Promise.all([
    prisma.financialAccount.findFirst({ where: { id: accountId, businessId, active: true } }),
    prisma.business.findUnique({ where: { id: businessId }, select: { baseCurrency: true } }),
  ]);
  if (!account) throw new Error("Choose an active cash or bank account");
  if (!business) throw new Error("Business not found");

  if (incurredAt < account.openingDate) throw new Error("Expense date must be on or after the account opening date");

  let categoryId: string | null = null;
  if (categoryName) {
    const category = await prisma.expenseCategory.upsert({
      where: { businessId_name: { businessId, name: categoryName } },
      update: {},
      create: { businessId, name: categoryName },
    });
    categoryId = category.id;
  }

  const expense = await prisma.expense.create({
    data: {
      businessId,
      categoryId,
      accountId,
      description,
      currency: business.baseCurrency,
      exchangeRate: 1,
      amount,
      baseAmount: amount,
      incurredAt,
    },
  });

  await logAction({
    businessId,
    userId,
    action: "expense.recorded",
    entityType: "Expense",
    entityId: expense.id,
    metadata: { amount, accountId, accountName: account.name, description },
  });

  revalidatePath("/expenses");
  revalidatePath("/finance/accounts");
  revalidatePath(`/finance/accounts/${accountId}`);
  revalidatePath("/settings/audit-log");
  redirect("/expenses");
}
