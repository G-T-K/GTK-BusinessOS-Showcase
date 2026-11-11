import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, type Permission } from "@/lib/role-permissions";

export { hasPermission, type BusinessRole, type Permission } from "@/lib/role-permissions";

export async function getPermissionContext(permission: Permission | readonly Permission[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { allowed: false as const, status: 401 as const };

  const user = session.user as typeof session.user & {
    id?: string;
    businessId?: string;
  };
  if (!user.id || !user.businessId) return { allowed: false as const, status: 403 as const };

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, businessId: user.businessId, active: true },
    select: { role: true },
  });
  const allowed =
    typeof permission === "string"
      ? hasPermission(membership?.role, permission)
      : permission.some((required) => hasPermission(membership?.role, required));
  if (!membership || !allowed) {
    return { allowed: false as const, status: 403 as const };
  }

  return {
    allowed: true as const,
    context: { businessId: user.businessId, userId: user.id, role: membership.role },
  };
}

export async function requirePermission(permission: Permission) {
  const result = await getPermissionContext(permission);
  if (!result.allowed) {
    if (result.status === 401) redirect("/login");
    throw new Error("You do not have permission to perform this action, or your business access was removed.");
  }
  return result.context;
}

export async function requirePagePermission(permission: Permission | readonly Permission[]) {
  const result = await getPermissionContext(permission);
  if (!result.allowed) {
    if (result.status === 401) redirect("/login");
    redirect("/dashboard?error=forbidden");
  }
  return result.context;
}
