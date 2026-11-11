export const permissions = {
  dashboard: [
    "OWNER",
    "ADMINISTRATOR",
    "MANAGER",
    "SALESPERSON",
    "CASHIER",
    "INVENTORY_OFFICER",
    "FINANCE",
    "PAYROLL_ADMIN",
  ],
  sales: ["OWNER", "ADMINISTRATOR", "MANAGER", "SALESPERSON", "CASHIER"],
  inventory: ["OWNER", "ADMINISTRATOR", "MANAGER", "INVENTORY_OFFICER"],
  purchasing: ["OWNER", "ADMINISTRATOR", "MANAGER", "INVENTORY_OFFICER"],
  finance: ["OWNER", "ADMINISTRATOR", "MANAGER", "FINANCE", "PAYROLL_ADMIN"],
  reports: ["OWNER", "ADMINISTRATOR", "MANAGER", "FINANCE", "PAYROLL_ADMIN"],
  payroll: ["OWNER", "ADMINISTRATOR", "MANAGER", "FINANCE", "PAYROLL_ADMIN"],
  payrollSensitive: ["OWNER", "ADMINISTRATOR", "FINANCE", "PAYROLL_ADMIN"],
  payrollManage: ["OWNER", "ADMINISTRATOR", "PAYROLL_ADMIN"],
  payrollSelf: [
    "OWNER",
    "ADMINISTRATOR",
    "MANAGER",
    "SALESPERSON",
    "CASHIER",
    "INVENTORY_OFFICER",
    "FINANCE",
    "PAYROLL_ADMIN",
    "EMPLOYEE",
  ],
  settings: ["OWNER", "ADMINISTRATOR"],
} as const;

export type Permission = keyof typeof permissions;
export type BusinessRole = (typeof permissions)[Permission][number];

export function hasPermission(role: unknown, permission: Permission): role is BusinessRole {
  return typeof role === "string" && (permissions[permission] as readonly string[]).includes(role);
}
