function calculatePurchaseTotals(subtotal, taxRate) {
  const normalizedSubtotal = Number(subtotal) || 0;
  const normalizedTaxRate = Number(taxRate) || 0;
  const taxAmount = Number((normalizedSubtotal * (normalizedTaxRate / 100)).toFixed(2));
  const total = Number((normalizedSubtotal + taxAmount).toFixed(2));

  return {
    subtotal: normalizedSubtotal,
    taxRate: normalizedTaxRate,
    taxAmount,
    total,
  };
}

module.exports = {
  calculatePurchaseTotals,
};
