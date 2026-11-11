import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permissions";

export default async function CustomersLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("sales");
  return children;
}
