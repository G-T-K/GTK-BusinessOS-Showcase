import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permissions";

export default async function SalesLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("sales");
  return children;
}
