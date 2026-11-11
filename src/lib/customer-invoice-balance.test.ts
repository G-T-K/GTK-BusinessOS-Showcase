import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getInvoiceOutstandingBalance,
  paymentExceedsInvoiceBalance,
} from "./customer-invoice-balance";

test("an unpaid invoice has its full total outstanding", () => {
  assert.equal(getInvoiceOutstandingBalance(125, []), 125);
});

test("a partially paid invoice subtracts its allocated payment records", () => {
  assert.equal(getInvoiceOutstandingBalance(125, [25, 30]), 70);
});

test("a fully paid invoice has no outstanding balance", () => {
  assert.equal(getInvoiceOutstandingBalance(125, [75, 50]), 0);
});

test("a customer with no invoices has no invoice balances to select", () => {
  const invoices: Array<{ total: number; payments: number[] }> = [];
  assert.deepEqual(
    invoices.filter((invoice) => getInvoiceOutstandingBalance(invoice.total, invoice.payments) > 0),
    [],
  );
});

test("partial payments are allowed but payments over the remaining balance are rejected", () => {
  const balance = getInvoiceOutstandingBalance(100, [35]);
  assert.equal(paymentExceedsInvoiceBalance(20, balance), false);
  assert.equal(getInvoiceOutstandingBalance(100, [35, 20]), 45);
  assert.equal(paymentExceedsInvoiceBalance(65.01, balance), true);
});
