"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { money, overdueLevel } from "@/lib/format";

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  owing: number;
  days: number | null;
};

export function CustomerSearch({ rows }: { rows: CustomerRow[] }) {
  const [query, setQuery] = useState("");

  const normalized = query.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (!normalized) return [];

    return rows
      .filter((row) => {
        const haystack = `${row.name} ${row.phone ?? ""}`.toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 6);
  }, [normalized, rows]);

  const filteredRows = useMemo(() => {
    if (!normalized) return rows;

    return rows.filter((row) => {
      const haystack = `${row.name} ${row.phone ?? ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [normalized, rows]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <label htmlFor="customer-search" className="sr-only">
          Search customers
        </label>
        <input
          id="customer-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search customers or phone..."
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />

        {suggestions.length > 0 && (
          <div className="absolute z-20 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            {suggestions.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setQuery(row.name)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{row.name}</span>
                <span className="text-xs text-gray-500">{row.phone ?? "—"}</span>
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
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium text-right">Owing</th>
                <th className="px-4 py-3 font-medium text-right">Days</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No customers match your search.
                  </td>
                </tr>
              )}
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                  <td className="px-4 py-3 text-gray-500">{row.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {row.owing > 0 ? money(row.owing) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.owing > 0 ? (
                      <span>
                        {overdueLevel(row.days ?? 0)} {row.days}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/customers/${row.id}`} className="text-brand-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="block md:hidden p-3 space-y-3">
          {filteredRows.length === 0 && (
            <div className="px-2 py-8 text-center text-gray-500">No customers match your search.</div>
          )}
          {filteredRows.map((row) => (
            <div key={row.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{row.name}</p>
                  <p className="text-xs text-gray-500">{row.phone ?? "—"}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                    row.owing > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {row.owing > 0 ? money(row.owing) : "No balance"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-500">Owing</p>
                  <p className="font-medium text-gray-900">{row.owing > 0 ? money(row.owing) : "—"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Days</p>
                  <p className="font-medium text-gray-900">
                    {row.owing > 0 ? `${overdueLevel(row.days ?? 0)} ${row.days}` : "—"}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <Link
                  href={`/customers/${row.id}`}
                  className="block w-full rounded-lg bg-brand-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-700"
                >
                  View customer
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
