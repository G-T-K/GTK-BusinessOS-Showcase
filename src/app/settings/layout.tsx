import type { ReactNode } from "react";
import { requirePagePermission } from "@/lib/permissions";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("settings");
  return children;
}
