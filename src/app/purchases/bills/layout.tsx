import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permissions";

export default async function SupplierBillsLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("finance");
  return children;
}
