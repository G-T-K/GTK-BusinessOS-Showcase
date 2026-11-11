import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/role-permissions";
import { prisma } from "@/lib/prisma";

export async function getPayslipAccess(lineId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { allowed: false as const, status: 401 as const };
  const user = session.user as typeof session.user & { id?: string; businessId?: string };
  if (!user.id || !user.businessId) return { allowed: false as const, status: 403 as const };

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, businessId: user.businessId, active: true },
    select: { role: true },
  });
  if (!membership) return { allowed: false as const, status: 403 as const };

  const line = await prisma.payrollLine.findFirst({
    where: { id: lineId, payrollRun: { businessId: user.businessId } },
    include: {
      employee: { select: { userId: true } },
      payrollRun: {
        include: {
          business: { select: { name: true, address: true, phone: true, email: true, website: true, logo: true, logoMimeType: true } },
        },
      },
      items: { orderBy: [{ kind: "asc" }, { name: "asc" }] },
    },
  });
  if (!line) return { allowed: false as const, status: 404 as const };

  const ownPayslip = line.employee.userId === user.id;
  const hasPayrollDetails = hasPermission(membership.role, "payrollSensitive");
  if (!ownPayslip && !hasPayrollDetails) return { allowed: false as const, status: 403 as const };
  return { allowed: true as const, line, userId: user.id, businessId: user.businessId };
}
