// Same customer-facing alphabet and whitespace normalization as Dust Wave Store.
export function normalizeCouponCode(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g,'').toUpperCase() : '';
}

export function validCouponCode(value) {
  return /^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(normalizeCouponCode(value));
}

// Percentage values are basis points (10000 = 100%). Fixed values are minor currency units.
export function discountCents(subtotal, type, value) {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0 || !Number.isSafeInteger(value) || value <= 0) throw RangeError('Invalid coupon amount.');
  if (type === 'amount') return Math.min(subtotal,value);
  if (type !== 'percent' || value > 10000 || !Number.isSafeInteger(subtotal * value)) throw RangeError('Invalid coupon percentage.');
  return Math.round(subtotal * value / 10000);
}
