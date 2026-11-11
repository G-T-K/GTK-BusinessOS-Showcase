import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import { getPermissionContext } from "@/lib/permissions";

// Builds a compact, current snapshot of the business so Claude can answer
// questions grounded in real data rather than guessing. Kept deliberately
// small (aggregates, not every row) to stay well within a single request.
async function buildBusinessSnapshot(businessId: string) {
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const [customers, products, invoicesThisMonth, expensesThisMonth, business] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId },
      include: {
        invoices: {
          where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
          select: { totalBaseAmount: true, amountPaidBase: true, dueDate: true, reference: true },
        },
      },
    }),
    prisma.product.findMany({ where: { businessId, active: true } }),
    prisma.invoice.findMany({
      where: { businessId, issuedAt: { gte: monthStart, lte: monthEnd }, status: { not: "CANCELLED" } },
      select: { totalBaseAmount: true },
    }),
    prisma.expense.findMany({
      where: { businessId, incurredAt: { gte: monthStart, lte: monthEnd } },
      include: { category: { select: { name: true } } },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
  ]);

  const debtors = customers
    .map((c) => ({
      name: c.name,
      owing: c.invoices.reduce((s, i) => s + (Number(i.totalBaseAmount) - Number(i.amountPaidBase)), 0),
      openInvoices: c.invoices.map((i) => i.reference),
    }))
    .filter((c) => c.owing > 0)
    .sort((a, b) => b.owing - a.owing);

  const lowStock = products
    .filter((p) => Number(p.quantityOnHand) <= Number(p.reorderLevel))
    .map((p) => ({ name: p.name, quantity: Number(p.quantityOnHand), reorderLevel: Number(p.reorderLevel) }));

  const revenueThisMonth = invoicesThisMonth.reduce((s, i) => s + Number(i.totalBaseAmount), 0);
  const expensesTotal = expensesThisMonth.reduce((s, e) => s + Number(e.baseAmount), 0);
  const expensesByCategory: Record<string, number> = {};
  for (const e of expensesThisMonth) {
    const key = e.category?.name ?? "Uncategorized";
    expensesByCategory[key] = (expensesByCategory[key] ?? 0) + Number(e.baseAmount);
  }
  const stockValue = products.reduce((s, p) => s + Number(p.costPrice) * Number(p.quantityOnHand), 0);

  return {
    businessName: business?.name,
    asOf: new Date().toISOString(),
    thisMonth: { revenue: revenueThisMonth, expenses: expensesTotal, expensesByCategory },
    debtors,
    totalOutstanding: debtors.reduce((s, d) => s + d.owing, 0),
    inventory: { stockValue, lowStock },
  };
}

export async function POST(req: NextRequest) {
  const access = await getPermissionContext("reports");
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: access.status }
    );
  }
  const { businessId } = access.context;
  const { question } = await req.json();
  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "A question is required" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add one to .env to enable the copilot." },
      { status: 500 }
    );
  }

  const snapshot = await buildBusinessSnapshot(businessId);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system:
        "You are a business assistant inside GTK BusinessOS, a small-business management app. " +
        "You are given a JSON snapshot of the current business's real data (sales, debtors, " +
        "inventory, expenses). Answer the owner's question using ONLY this data — never invent " +
        "figures. Money is in USD. Be direct, concise, and practical, like a good bookkeeper. " +
        "If the data doesn't cover the question, say so plainly.",
      messages: [
        {
          role: "user",
          content: `Business data snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nQuestion: ${question}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return NextResponse.json({ error: `Claude API error: ${errText}` }, { status: 502 });
  }

  const data = await response.json();
  const answer = data.content?.find((b: any) => b.type === "text")?.text ?? "No answer generated.";

  return NextResponse.json({ answer });
}
