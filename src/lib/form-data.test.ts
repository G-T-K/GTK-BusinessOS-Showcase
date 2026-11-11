import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureMaxFormLines, readFormDate, readFormNumber, readFormText } from "./form-data";

test("form text rejects missing required values and excessive length", () => {
  const form = new FormData();
  assert.throws(() => readFormText(form, "name", "Name", { required: true }), /Name is required/);

  form.set("name", "x".repeat(4));
  assert.throws(() => readFormText(form, "name", "Name", { maxLength: 3 }), /3 characters or fewer/);
});

test("form numbers enforce numeric shape, range, and decimal precision", () => {
  const form = new FormData();
  form.set("amount", "12.34");
  assert.equal(readFormNumber(form, "amount", "Amount", { min: 0, max: 100, decimalPlaces: 2 }), 12.34);

  form.set("amount", "1.234");
  assert.throws(() => readFormNumber(form, "amount", "Amount", { decimalPlaces: 2 }), /at most 2 decimal places/);
  form.set("amount", "Infinity");
  assert.throws(() => readFormNumber(form, "amount", "Amount"), /valid amount/);
  form.set("amount", "-1");
  assert.throws(() => readFormNumber(form, "amount", "Amount", { min: 0 }), /at least 0/);
});

test("form dates reject impossible dates and allow omitted optional dates", () => {
  const form = new FormData();
  assert.equal(readFormDate(form, "date", "date", true), null);
  form.set("date", "2026-02-31");
  assert.throws(() => readFormDate(form, "date", "date"), /valid date/);
  form.set("date", "2026-02-28");
  assert.equal(readFormDate(form, "date", "date").toISOString(), "2026-02-28T00:00:00.000Z");
});

test("line-item form fields enforce the server-side maximum", () => {
  const form = new FormData();
  form.set("product_7", "product-id");
  assert.doesNotThrow(() => ensureMaxFormLines(form, 8, "An invoice"));
  form.set("quantity_100", "1");
  assert.throws(() => ensureMaxFormLines(form, 8, "An invoice"), /at most 8 line items/);
});
