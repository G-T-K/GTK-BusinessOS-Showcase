"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { money } from "@/lib/format";
import { adjustStock } from "@/app/inventory/actions";

type InventoryProduct = {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  costPrice: number | string | { toString(): string };
  sellingPrice: number | string | { toString(): string };
  quantityOnHand: number | string | { toString(): string };
  reorderLevel: number | string | { toString(): string };
};

export function InventorySearch({ products }: { products: InventoryProduct[] }) {
  const [query, setQuery] = useState("");

  const normalizedQuery = query.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (!normalizedQuery) return [];

    return products
      .filter((p) => {
        const haystack = `${p.name} ${p.sku ?? ""}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 6);
  }, [normalizedQuery, products]);

  const filteredProducts = useMemo(() => {
    if (!normalizedQuery) return products;

    return products.filter((p) => {
      const haystack = `${p.name} ${p.sku ?? ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, products]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <label htmlFor="inventory-search" className="sr-only">
          Search inventory
        </label>
        <input
          id="inventory-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products or SKU..."
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />

        {suggestions.length > 0 && (
          <div className="absolute z-20 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            {suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setQuery(p.name)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{p.name}</span>
                <span className="text-xs text-gray-500">{p.sku ?? "—"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium text-right">Cost</th>
                <th className="px-4 py-3 font-medium text-right">Selling</th>
                <th className="px-4 py-3 font-medium text-right">Qty</th>
                <th className="px-4 py-3 font-medium text-right">Value</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No products match your search.
                  </td>
                </tr>
              )}
              {filteredProducts.map((p) => {
                const low = Number(p.quantityOnHand) <= Number(p.reorderLevel);
                const value = Number(p.costPrice) * Number(p.quantityOnHand);
                return (
                  <tr key={p.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-gray-500 text-xs">{p.sku ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-right">{money(Number(p.costPrice))}</td>
                    <td className="px-4 py-3 text-right">{money(Number(p.sellingPrice))}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={low ? "text-warn font-medium" : ""}>
                        {low && "🟡 "}
                        {Number(p.quantityOnHand)} {p.unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{money(value)}</td>
                    <td className="px-4 py-3 text-right">
                      <details className="inline-block text-left">
                        <summary className="text-brand-600 hover:underline cursor-pointer list-none">
                          Adjust stock
                        </summary>
                        <form
                          action={adjustStock}
                          className="absolute mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 space-y-2 z-10 w-56"
                        >
                          <input type="hidden" name="productId" value={p.id} />
                          <select name="direction" className="w-full rounded border border-gray-300 px-2 py-1 text-xs">
                            <option value="IN">Stock in</option>
                            <option value="OUT">Stock out</option>
                          </select>
                          <input
                            name="quantity"
                            type="number"
                            step="0.001"
                            min="0.001"
                            placeholder="Quantity"
                            required
                            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                          <input
                            name="note"
                            placeholder="Note (optional)"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                          <button
                            type="submit"
                            className="w-full rounded bg-brand-600 text-white text-xs font-medium py-1.5 hover:bg-brand-700"
                          >
                            Apply
                          </button>
                        </form>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="block md:hidden p-3 space-y-3">
          {filteredProducts.length === 0 && (
            <div className="px-2 py-8 text-center text-gray-500">No products match your search.</div>
          )}
          {filteredProducts.map((p) => {
            const low = Number(p.quantityOnHand) <= Number(p.reorderLevel);
            return (
              <div key={p.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.sku ?? "—"}</p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      low ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    Qty {Number(p.quantityOnHand)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Cost</p>
                    <p className="font-medium text-gray-900">{money(Number(p.costPrice))}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Selling</p>
                    <p className="font-medium text-gray-900">{money(Number(p.sellingPrice))}</p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <details className="flex-1 text-left">
                    <summary className="block cursor-pointer rounded-lg border border-brand-200 bg-white px-3 py-2 text-center text-sm font-medium text-brand-700 list-none">
                      Adjust stock
                    </summary>
                    <form
                      action={adjustStock}
                      className="mt-2 rounded-lg border border-gray-200 bg-white p-3 shadow-lg space-y-2"
                    >
                      <input type="hidden" name="productId" value={p.id} />
                      <select name="direction" className="w-full rounded border border-gray-300 px-2 py-1 text-xs">
                        <option value="IN">Stock in</option>
                        <option value="OUT">Stock out</option>
                      </select>
                      <input
                        name="quantity"
                        type="number"
                        step="0.001"
                        min="0.001"
                        placeholder="Quantity"
                        required
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                      <input
                        name="note"
                        placeholder="Note (optional)"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                      />
                      <button
                        type="submit"
                        className="w-full rounded bg-brand-600 text-white text-xs font-medium py-1.5 hover:bg-brand-700"
                      >
                        Apply
                      </button>
                    </form>
                  </details>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
