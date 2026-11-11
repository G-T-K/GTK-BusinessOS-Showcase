"use client";

import { useState } from "react";
import { createPurchase } from "../actions";
import { money } from "@/lib/format";

type Product = { id: string; name: string; costPrice: number };
type TaxRate = { id: string; code: string; name: string; rate: number };
type Line = { productId: string; quantity: string; unitCost: string };

export function NewPurchaseForm({
  suppliers,
  products,
  taxRates,
  action = createPurchase,
  submitLabel = "Record purchase",
}: {
  suppliers: { id: string; name: string }[];
  products: Product[];
  taxRates?: TaxRate[];
  action?: (formData: FormData) => Promise<void>;
  submitLabel?: string;
}) {
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: "1", unitCost: "" }]);

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { productId: "", quantity: "1", unitCost: "" }]);
  }
  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }
  function onProductChange(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateLine(index, { productId, unitCost: product ? String(product.costPrice) : "" });
  }

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);

  return (
    <form action={action} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700">Supplier (optional)</label>
        <select name="supplierId" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">No supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Tax/VAT</label>
        <select name="taxRateId" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="">No tax</option>
          {(taxRates ?? []).map((rate) => (
            <option key={rate.id} value={rate.id}>
              {rate.name} ({rate.rate}%)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Items received</label>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                name={`product_${i}`}
                value={line.productId}
                onChange={(e) => onProductChange(i, e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
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
                placeholder="Qty"
                className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                name={`unitCost_${i}`}
                type="number"
                step="0.01"
                min="0"
                value={line.unitCost}
                onChange={(e) => updateLine(i, { unitCost: e.target.value })}
                placeholder="Unit cost"
                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => removeLine(i)} className="text-gray-400 hover:text-danger text-sm px-1">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addLine} className="mt-2 text-sm text-brand-600 hover:underline">
          + Add another item
        </button>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <span className="text-sm text-gray-500">Total</span>
        <span className="text-lg font-semibold text-gray-900">{money(total)}</span>
      </div>

      <p className="text-xs text-gray-400">
        Receiving this purchase will increase stock immediately and update each product&apos;s cost price.
      </p>

      <button type="submit" className="w-full rounded-lg bg-brand-600 text-white text-sm font-medium py-2 hover:bg-brand-700">
        {submitLabel}
      </button>
    </form>
  );
}
