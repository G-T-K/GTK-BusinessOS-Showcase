import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/AppNav";
import { UserRoleSelect } from "@/components/UserRoleSelect";
import { hasPermission, requirePagePermission } from "@/lib/permissions";
import { addUser, updateUserRole, removeUser } from "./actions";

const ROLES = [
  "OWNER",
  "ADMINISTRATOR",
  "MANAGER",
  "SALESPERSON",
  "CASHIER",
  "INVENTORY_OFFICER",
  "FINANCE",
  "PAYROLL_ADMIN",
  "EMPLOYEE",
] as const;

export default async function UsersSettingsPage() {
  const { role } = await requirePagePermission("settings");
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const businessId = (session.user as any).businessId as string;
  const businessName = (session.user as any).businessName as string;
  const canManage = hasPermission(role, "settings");

  const memberships = await prisma.membership.findMany({
    where: { businessId, active: true },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav businessId={businessId} />
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Users & Permissions</h1>
          <p className="text-sm text-gray-500">Who has access to {businessName}, and what they can do.</p>
        </div>

        <section className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {memberships.map((m) => (
            <div key={m.id} className="p-4 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-gray-900">{m.user.name}</p>
                <p className="text-gray-500">{m.user.email}</p>
              </div>
              {canManage && m.role !== "OWNER" ? (
                <div className="flex items-center gap-2">
                  <form action={updateUserRole} className="flex items-center gap-2">
                    <input type="hidden" name="membershipId" value={m.id} />
                    <UserRoleSelect role={m.role} roles={ROLES} />
                  </form>
                  <form action={removeUser}>
                    <input type="hidden" name="membershipId" value={m.id} />
                    <button className="text-danger text-xs hover:underline">Remove</button>
                  </form>
                </div>
              ) : (
                <span className="text-gray-500 text-xs">{m.role.replace("_", " ")}</span>
              )}
            </div>
          ))}
        </section>

        {canManage && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
              Add a user
            </h2>
            <form action={addUser} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <p className="text-xs text-gray-400">
                If the email doesn&apos;t have an account yet, fill in a name and a starting password too.
                If it&apos;s an existing user (e.g. adding them to a second business), just email + role is enough.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Name (new users only)</label>
                <input name="name" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Starting password (new users only)</label>
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select name="role" required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  {ROLES.filter((r) => r !== "OWNER").map((r) => (
                    <option key={r} value={r}>
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-brand-600 text-white text-sm font-medium py-2 hover:bg-brand-700"
              >
                Add user
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
