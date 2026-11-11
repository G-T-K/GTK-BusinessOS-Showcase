import assert from "node:assert/strict";
import { test } from "node:test";
import { hasPermission, type Permission } from "./role-permissions";

const allPermissions: Permission[] = [
  "dashboard",
  "sales",
  "inventory",
  "purchasing",
  "finance",
  "reports",
  "payroll",
  "payrollSensitive",
  "payrollManage",
  "payrollSelf",
  "settings",
];

test("owners and administrators can access every permission", () => {
  for (const role of ["OWNER", "ADMINISTRATOR"]) {
    for (const permission of allPermissions) {
      assert.equal(hasPermission(role, permission), true, `${role} should have ${permission}`);
    }
  }
});

test("managers can access operational areas but not settings", () => {
  for (const permission of allPermissions.filter(
    (item) => !["settings", "payrollSensitive", "payrollManage", "payrollSelf"].includes(item),
  )) {
    assert.equal(hasPermission("MANAGER", permission), true, `MANAGER should have ${permission}`);
  }
  assert.equal(hasPermission("MANAGER", "settings"), false);
  assert.equal(hasPermission("MANAGER", "payrollSelf"), true);
  assert.equal(hasPermission("MANAGER", "payrollSensitive"), false);
  assert.equal(hasPermission("MANAGER", "payrollManage"), false);
});

test("sales roles are limited to sales and dashboard", () => {
  for (const role of ["SALESPERSON", "CASHIER"]) {
    assert.equal(hasPermission(role, "dashboard"), true);
    assert.equal(hasPermission(role, "sales"), true);
    for (const permission of allPermissions.filter((item) => !["dashboard", "sales", "payrollSelf"].includes(item))) {
      assert.equal(hasPermission(role, permission), false, `${role} should not have ${permission}`);
    }
    assert.equal(hasPermission(role, "payrollSelf"), true);
  }
});

test("inventory officers are limited to inventory, purchasing, and dashboard", () => {
  assert.equal(hasPermission("INVENTORY_OFFICER", "dashboard"), true);
  assert.equal(hasPermission("INVENTORY_OFFICER", "inventory"), true);
  assert.equal(hasPermission("INVENTORY_OFFICER", "purchasing"), true);
  for (const permission of allPermissions.filter(
    (item) => !["dashboard", "inventory", "purchasing", "payrollSelf"].includes(item)
  )) {
    assert.equal(hasPermission("INVENTORY_OFFICER", permission), false);
  }
  assert.equal(hasPermission("INVENTORY_OFFICER", "payrollSelf"), true);
});

test("finance users are limited to finance, reports, and dashboard", () => {
  assert.equal(hasPermission("FINANCE", "dashboard"), true);
  assert.equal(hasPermission("FINANCE", "finance"), true);
  assert.equal(hasPermission("FINANCE", "reports"), true);
  for (const permission of allPermissions.filter(
    (item) => !["dashboard", "finance", "reports", "payroll", "payrollSensitive", "payrollSelf"].includes(item),
  )) {
    assert.equal(hasPermission("FINANCE", permission), false);
  }
  assert.equal(hasPermission("FINANCE", "payroll"), true);
  assert.equal(hasPermission("FINANCE", "payrollSensitive"), true);
  assert.equal(hasPermission("FINANCE", "payrollSelf"), true);
});

test("payroll roles receive only their intended payroll permissions", () => {
  assert.equal(hasPermission("PAYROLL_ADMIN", "payrollManage"), true);
  assert.equal(hasPermission("PAYROLL_ADMIN", "payrollSensitive"), true);
  assert.equal(hasPermission("PAYROLL_ADMIN", "payroll"), true);
  assert.equal(hasPermission("EMPLOYEE", "payrollSelf"), true);
  assert.equal(hasPermission("EMPLOYEE", "payroll"), false);
  assert.equal(hasPermission("EMPLOYEE", "payrollSensitive"), false);
  assert.equal(hasPermission("EMPLOYEE", "payrollManage"), false);
});

test("unknown roles do not receive permissions", () => {
  assert.equal(hasPermission("UNKNOWN", "dashboard"), false);
  assert.equal(hasPermission(undefined, "sales"), false);
});
