const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePurchaseTotals } = require('./purchase-tax');

test('purchase totals calculate tax correctly', () => {
  assert.deepEqual(calculatePurchaseTotals(100, 15), {
    subtotal: 100,
    taxRate: 15,
    taxAmount: 15,
    total: 115,
  });

  assert.deepEqual(calculatePurchaseTotals(200, 0), {
    subtotal: 200,
    taxRate: 0,
    taxAmount: 0,
    total: 200,
  });
});
