import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permissions";

export default async function InventoryLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("inventory");
  return children;
}
