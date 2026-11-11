export function money(n: number | string) {
  const value = typeof n === "string" ? Number(n) : n;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function moneyInCurrency(n: number | string, currency: string) {
  const value = typeof n === "string" ? Number(n) : n;
  const amount = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const marker = currency === "USD" ? "$" : currency === "ZAR" ? "R" : currency === "ZIG" ? "ZiG " : `${currency} `;
  return `${marker}${amount}`;
}

export function daysOverdue(dueDate: Date | null): number {
  if (!dueDate) return 0;
  const diff = Date.now() - new Date(dueDate).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function overdueLevel(days: number): "🔴" | "🟡" | "🟢" {
  if (days > 30) return "🔴";
  if (days > 0) return "🟡";
  return "🟢";
}
