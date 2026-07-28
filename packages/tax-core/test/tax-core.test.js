import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateManualTax,
  normalizeTaxDestination
} from "../src/index.js";

test("normalizes the Store-compatible US destination contract", () => {
  assert.deepEqual(
    normalizeTaxDestination({
      countryCode: " us ",
      postal_code: "87120-1234",
      region: "nm",
      city: " Albuquerque ",
      address1: " 1 Dust Wave Way "
    }),
    {
      valid: true,
      destination: {
        country: "US",
        postalCode: "87120-1234",
        state: "NM",
        city: "Albuquerque",
        line1: "1 Dust Wave Way",
        line2: ""
      }
    }
  );
});

test("preserves explicit destination validation failures", () => {
  assert.deepEqual(normalizeTaxDestination(null), {
    valid: false,
    destination: null,
    error: "Billing address is incomplete"
  });
  assert.equal(
    normalizeTaxDestination({ country: "US", postalCode: "invalid" }).error,
    "Billing postal code is invalid"
  );
});

test("calculates exclusive and inclusive integer-cent tax deterministically", () => {
  assert.deepEqual(
    calculateManualTax({
      subtotalCents: 5_000,
      ratePartsPerMillion: 78_750
    }),
    {
      subtotalCents: 5_000,
      shippingCents: 0,
      taxableSubtotalCents: 5_000,
      taxableShippingCents: 0,
      shippingTaxed: false,
      ratePartsPerMillion: 78_750,
      effectiveRate: 0.07875,
      taxBehavior: "exclusive",
      taxCents: 394,
      totalCents: 5_394
    }
  );
  assert.equal(
    calculateManualTax({
      subtotalCents: 5_394,
      ratePartsPerMillion: 78_750,
      taxBehavior: "inclusive"
    }).taxCents,
    394
  );
});

test("rejects fractional, negative, and excessive monetary inputs", () => {
  assert.throws(
    () => calculateManualTax({
      subtotalCents: 1.5,
      ratePartsPerMillion: 78_750
    }),
    /bounded non-negative cents/
  );
  assert.throws(
    () => calculateManualTax({
      subtotalCents: 100,
      ratePartsPerMillion: 1_000_001
    }),
    /zero to one million/
  );
});
