import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permissions";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("dashboard");
  return children;
}
