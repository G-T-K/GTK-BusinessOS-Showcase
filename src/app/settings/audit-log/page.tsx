import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";

export default async function AuditLogPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;

  const entries = await prisma.auditLog.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { name: true } } },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Audit log</h1>
            <p className="text-sm text-gray-500">Recent activity in {businessName} — last 100 events.</p>
          </div>
          <Link href="/settings/users" className="text-sm text-brand-600 hover:underline">
            Back to Users
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {entries.length === 0 && (
            <p className="p-4 text-sm text-gray-500">
              No activity recorded yet. As people create invoices, record payments, or manage
              users, it&apos;ll show up here.
            </p>
          )}
          {entries.map((e) => (
            <div key={e.id} className="p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{e.action}</span>
                <span className="text-gray-400 text-xs">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-0.5">
                {e.user?.name ?? "Unknown user"} · {e.entityType} {e.entityId.slice(-8)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
