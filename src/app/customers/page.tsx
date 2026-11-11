import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { CustomerSearch } from "@/components/CustomerSearch";
import { money, daysOverdue } from "@/lib/format";

export default async function CustomersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  const customers = await prisma.customer.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
    include: {
      invoices: {
        where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
        select: { totalBaseAmount: true, amountPaidBase: true, dueDate: true },
      },
    },
  });

  const rows = customers.map((c) => {
    const owing = c.invoices.reduce(
      (sum, inv) => sum + (Number(inv.totalBaseAmount) - Number(inv.amountPaidBase)),
      0
    );
    const oldestDue = c.invoices
      .map((inv) => inv.dueDate)
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    const days = daysOverdue(oldestDue);
    return { id: c.id, name: c.name, phone: c.phone, owing, days };
  });

  rows.sort((a, b) => b.owing - a.owing);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
            <p className="text-sm text-gray-500">Who owes you, and how much.</p>
          </div>
          <Link
            href="/customers/new"
            className="rounded-lg bg-brand-600 text-white text-sm font-medium px-4 py-2 hover:bg-brand-700"
          >
            Add customer
          </Link>
        </div>

        <CustomerSearch rows={rows} />
      </div>
    </div>
  );
}
