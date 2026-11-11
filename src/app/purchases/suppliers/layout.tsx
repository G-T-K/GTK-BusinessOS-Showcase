import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permissions";

export default async function SuppliersLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("purchasing");
  return children;
}
