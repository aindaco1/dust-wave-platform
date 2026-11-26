import test from 'node:test';
import assert from 'node:assert/strict';
import { discountCents, normalizeCouponCode, validCouponCode } from '../src/index.js';

test('Store and Stream coupon spelling, cent rounding, and subtotal cap', () => {
  assert.equal(normalizeCouponCode(' film -25 '),'FILM-25');
  assert.equal(validCouponCode('a!'),false);
  assert.equal(validCouponCode('film_2'),true);
  assert.equal(discountCents(99,'percent',5000),50);
  assert.equal(discountCents(99,'amount',150),99);
  assert.equal(discountCents(99,'percent',10000),99);
  assert.throws(()=>discountCents(100,'percent',10001));
});
