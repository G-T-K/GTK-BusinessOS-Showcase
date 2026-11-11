import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permissions";

export default async function PurchaseOrdersLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("purchasing");
  return children;
}
