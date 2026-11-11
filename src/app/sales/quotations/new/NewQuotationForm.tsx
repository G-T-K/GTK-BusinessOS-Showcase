"use client";

import { useState } from "react";
import { createQuotation } from "../actions";
import { money } from "@/lib/format";

type Product = {
  id: string;
  name: string;
  sellingPrice: number;
  quantityOnHand: number;
  unit: string;
};

type Line = { productId: string; quantity: string };
const MAX_LINES = 8;

export function NewQuotationForm({
  customers,
  products,
}: {
  customers: { id: string; name: string }[];
  products: Product[];
}) {
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: "1" }]);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function addLine() {
    if (lines.length >= MAX_LINES) return;
    setLines((prev) => [...prev, { productId: "", quantity: "1" }]);
  }
  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const total = lines.reduce((sum, line) => {
    const product = products.find((p) => p.id === line.productId);
    const qty = Number(line.quantity) || 0;
    return sum + (product ? product.sellingPrice * qty : 0);
  }, 0);

  return (
    <form action={createQuotation} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700">Customer</label>
        <select name="customerId" required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">Select a customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Valid until (optional)</label>
        <input name="validUntil" type="date" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
        <div className="space-y-2">
          {lines.map((line, i) => {
            const product = products.find((p) => p.id === line.productId);
            return (
              <div key={i} className="flex gap-2 items-center">
                <select
                  name={`product_${i}`}
                  value={line.productId}
                  onChange={(e) => updateLine(i, { productId: e.target.value })}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {money(p.sellingPrice)} ({p.quantityOnHand} {p.unit} in stock)
                    </option>
                  ))}
                </select>
                <input
                  name={`quantity_${i}`}
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: e.target.value })}
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <span className="w-20 text-sm text-gray-500 text-right">
                  {product ? money(product.sellingPrice * (Number(line.quantity) || 0)) : "—"}
                </span>
                <button type="button" onClick={() => removeLine(i)} className="text-gray-400 hover:text-danger text-sm px-1">
                  ✕
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addLine}
          disabled={lines.length >= MAX_LINES}
          className="mt-2 text-sm text-brand-600 hover:underline"
        >
          {lines.length >= MAX_LINES ? "Maximum of 8 items" : "+ Add another item"}
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <span className="text-sm text-gray-500">Total</span>
        <span className="text-lg font-semibold text-gray-900">{money(total)}</span>
      </div>

      <button type="submit" className="w-full rounded-lg bg-brand-600 text-white text-sm font-medium py-2 hover:bg-brand-700">
        Create quotation
      </button>
    </form>
  );
}
