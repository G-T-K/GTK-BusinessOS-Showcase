import type { Prisma } from "@prisma/client";

export async function nextDocumentReference(
  tx: Prisma.TransactionClient,
  businessId: string,
  type: "INV" | "QUO",
) {
  const year = new Date().getFullYear();
  const prefix = `${type}-${year}-`;

  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${businessId}), hashtext(${prefix})) IS NULL`;

  const references =
    type === "INV"
      ? await tx.invoice.findMany({
          where: { businessId, reference: { startsWith: prefix } },
          select: { reference: true },
        })
      : await tx.quotation.findMany({
          where: { businessId, reference: { startsWith: prefix } },
          select: { reference: true },
        });

  const latestNumber = references.reduce((latest, { reference }) => {
    const suffix = reference.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) return latest;
    return Math.max(latest, Number(suffix));
  }, 0);

  return `${prefix}${String(latestNumber + 1).padStart(4, "0")}`;
}
