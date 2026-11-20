import assert from 'node:assert/strict';
import test from 'node:test';
import { calculatePlatformTip } from '@dustwave/worker-core/platform-tip';

test('a whole percentage of a cent subtotal rounds to the nearest cent', () => {
  for (const [subtotal, percent, cents] of [[10000,5,500], [555,5,28], [0,5,0], [99,0,0], [50,1,1], [499,15,75],
    [Number.MAX_SAFE_INTEGER,100,Number.MAX_SAFE_INTEGER]]) {
    assert.equal(calculatePlatformTip(subtotal, percent), cents);
  }
});

test('the caller supplies validated nonnegative cents and a whole percentage', () => {
  for (const [subtotal, percent] of [[1.5,5],[-1,5],[Number.MAX_SAFE_INTEGER+1,5],[100,'5'],[100,-1],[100,1.5],[100,101]]) {
    assert.throws(() => calculatePlatformTip(subtotal,percent), RangeError);
  }
});
