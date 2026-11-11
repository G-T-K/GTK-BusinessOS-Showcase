import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permissions";

export default async function ReportsLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("reports");
  return children;
}
