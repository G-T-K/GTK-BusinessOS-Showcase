function toCents(amount: number) {
  return Math.round(amount * 100);
}

export function getInvoiceOutstandingBalance(total: number, allocatedPayments: readonly number[]) {
  const paidCents = allocatedPayments.reduce((sum, amount) => sum + toCents(amount), 0);
  return Math.max(0, toCents(total) - paidCents) / 100;
}

export function paymentExceedsInvoiceBalance(amount: number, balance: number) {
  return toCents(amount) > toCents(balance);
}
