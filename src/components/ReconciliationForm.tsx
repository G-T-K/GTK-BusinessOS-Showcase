"use client";

import { useMemo, useState } from "react";
import { moneyInCurrency } from "@/lib/format";
import { reconcileFinancialAccount } from "@/app/finance/accounts/actions";

type ReconciliationTransaction = {
  id: string;
  type: "PAYMENT" | "EXPENSE" | "TRANSFER_IN" | "TRANSFER_OUT";
  date: string;
  description: string;
  amount: number;
};

export function ReconciliationForm({
  accountId,
  currency,
  startingBalance,
  previousStatementDate,
  includeStartDate,
  transactions,
}: {
  accountId: string;
  currency: string;
  startingBalance: number;
  previousStatementDate: string;
  includeStartDate: boolean;
  transactions: ReconciliationTransaction[];
}) {
  const [statementDate, setStatementDate] = useState(new Date().toISOString().slice(0, 10));
  const [statementBalance, setStatementBalance] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const eligibleTransactions = useMemo(() => transactions.filter((transaction) => (
    transaction.date <= statementDate
  )), [statementDate, transactions]);

  const selectedTransactions = eligibleTransactions.filter((transaction) => selected.has(transaction.id));
  const movement = selectedTransactions.reduce(
    (total, transaction) => total + (["PAYMENT", "TRANSFER_IN"].includes(transaction.type) ? transaction.amount : -transaction.amount),
    0,
  );
  const expectedBalance = startingBalance + movement;
  const statementValue = Number(statementBalance);
  const difference = statementBalance === "" || !Number.isFinite(statementValue)
    ? null
    : statementValue - expectedBalance;
  const dateIsValid = statementDate > previousStatementDate || (includeStartDate && statementDate === previousStatementDate);
  const canComplete = dateIsValid && difference !== null && Math.abs(difference) <= 0.005;

  function toggleTransaction(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={reconcileFinancialAccount} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <input type="hidden" name="accountId" value={accountId} />
      {selectedTransactions.filter((transaction) => transaction.type === "PAYMENT").map((transaction) => (
        <input key={transaction.id} type="hidden" name="paymentIds" value={transaction.id} />
      ))}
      {selectedTransactions.filter((transaction) => transaction.type === "EXPENSE").map((transaction) => (
        <input key={transaction.id} type="hidden" name="expenseIds" value={transaction.id} />
      ))}
      {selectedTransactions.filter((transaction) => transaction.type === "TRANSFER_IN").map((transaction) => (
        <input key={transaction.id} type="hidden" name="transferInIds" value={transaction.id} />
      ))}
      {selectedTransactions.filter((transaction) => transaction.type === "TRANSFER_OUT").map((transaction) => (
        <input key={transaction.id} type="hidden" name="transferOutIds" value={transaction.id} />
      ))}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="statement-date" className="block text-xs font-medium text-gray-600">Statement date</label>
          <input
            id="statement-date"
            name="statementDate"
            type="date"
            value={statementDate}
            min={includeStartDate ? previousStatementDate : undefined}
            required
            onChange={(event) => setStatementDate(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="statement-balance" className="block text-xs font-medium text-gray-600">Ending statement balance ({currency})</label>
          <input
            id="statement-balance"
            name="statementBalance"
            type="number"
            step="0.01"
            required
            value={statementBalance}
            onChange={(event) => setStatementBalance(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
        <span className="text-gray-600">Previous statement balance</span>
        <span className="font-medium text-gray-900">{moneyInCurrency(startingBalance, currency)}</span>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900">Select transactions on this statement</h3>
        {eligibleTransactions.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-gray-300 px-3 py-5 text-center text-sm text-gray-500">
            No unreconciled transactions fall within this date range.
          </p>
        ) : (
          <div className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {eligibleTransactions.map((transaction) => (
              <label key={transaction.id} className="flex cursor-pointer items-start gap-3 p-3 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selected.has(transaction.id)}
                  onChange={() => toggleTransaction(transaction.id)}
                  className="mt-1 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900">{transaction.description}</span>
                  <span className="block text-xs text-gray-500">
                    {transaction.date} · {transaction.type === "PAYMENT" ? "Money in" : transaction.type === "EXPENSE" ? "Money out" : transaction.type === "TRANSFER_IN" ? "Transfer in" : "Transfer out"}
                  </span>
                </span>
                <span className={`shrink-0 text-sm font-medium ${["PAYMENT", "TRANSFER_IN"].includes(transaction.type) ? "text-green-700" : "text-gray-800"}`}>
                  {["PAYMENT", "TRANSFER_IN"].includes(transaction.type) ? "+" : "−"}{moneyInCurrency(transaction.amount, currency)}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-sm">
        <span className="text-gray-600">Calculated balance</span>
        <span className="font-semibold text-gray-900">{moneyInCurrency(expectedBalance, currency)}</span>
      </div>
      {difference !== null && (
        <p className={`text-sm font-medium ${Math.abs(difference) <= 0.005 ? "text-green-700" : "text-amber-700"}`}>
          {Math.abs(difference) <= 0.005
            ? "Statement and selected transactions balance."
            : `Difference: ${moneyInCurrency(difference, currency)}. Select or deselect transactions until it reaches zero.`}
        </p>
      )}
      {!dateIsValid && <p className="text-sm text-amber-700">Choose a date after the previous reconciliation period.</p>}
      <button
        type="submit"
        disabled={!canComplete}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Complete reconciliation
      </button>
    </form>
  );
}