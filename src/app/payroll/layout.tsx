import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permissions";

export default async function PayrollLayout({ children }: { children: ReactNode }) {
  await requirePagePermission(["payroll", "payrollSelf"]);
  return children;
}
