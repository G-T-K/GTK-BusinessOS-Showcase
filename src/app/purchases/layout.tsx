import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permissions";

export default async function PurchasesLayout({ children }: { children: ReactNode }) {
  await requirePagePermission(["purchasing", "finance"]);
  return children;
}
