/** Whole-percent optional contribution in minor currency units, rounded half up. */
export function calculatePlatformTip(subtotalCents, percent) {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0 ||
      !Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new RangeError('Expected nonnegative integer cents and a whole percentage from 0 to 100.');
  }
  // Scale the remainder separately so the intermediate product stays exact.
  return Math.floor(subtotalCents / 100) * percent + Math.round((subtotalCents % 100) * percent / 100);
}
