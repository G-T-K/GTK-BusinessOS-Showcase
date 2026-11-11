import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permissions";

export default async function ExpensesLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("finance");
  return children;
}
