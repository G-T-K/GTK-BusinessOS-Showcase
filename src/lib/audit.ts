import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Records who did what, to which record, and when — scoped to one business.
// Call this from server actions right after a mutation succeeds. Failures here
// are logged but never thrown, so a logging problem can't block a real action.
export async function logAction(params: {
  businessId: string;
  userId?: string | null;
  action: string; // e.g. "invoice.created", "payment.recorded", "user.role_changed"
  entityType: string; // e.g. "Invoice", "Payment", "Membership"
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        businessId: params.businessId,
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: (params.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log entry", err);
  }
}
