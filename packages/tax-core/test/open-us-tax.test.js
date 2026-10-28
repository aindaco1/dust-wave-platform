import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOpenUsTax, buildOpenUsTaxQuote } from '../src/open-us-tax.js';
import { checkAddressConsistency, normalizeUsState } from '../src/address-consistency.js';
import { buildOpenTaxSnapshot, updateOpenTax } from '../src/open-us-tax-updater.js';
const now = Date.parse('2026-10-27T12:00:00Z');
test('ZIP/state consistency supports ZIP+4, state names, city suggestions and unknown data', () => {
  const result = checkAddressConsistency({ country: 'US', postalCode: '90012-1234', state: 'New Mexico', city: 'Corrales' });
  assert.equal(result.stateMismatch, true); assert.deepEqual(result.states, ['CA']); assert.equal(result.suggestedCity, 'Los Angeles');
  assert.equal(normalizeUsState('New York'), 'NY');
  assert.equal(checkAddressConsistency({ country: 'US', postalCode: '90012', state: 'CA', city: 'Alternate mailing name' }).stateMismatch, false);
  assert.equal(checkAddressConsistency({ country: 'CA', postalCode: 'H2X 1Y4' }).checked, false);
  assert.equal(checkAddressConsistency({ country: 'US', postalCode: '00000' }).checked, false);
});
test('local snapshots return components and decline uncertain or stale coverage', () => {
  assert.equal(resolveOpenUsTax('10467', { now }).ratePartsPerMillion, 88750);
  assert.equal(resolveOpenUsTax('10467-1234', { now }).components.length, 3);
  for (const zip of ['1046', '80205', '87048', '00000']) assert.equal(resolveOpenUsTax(zip, { now }), null);
  assert.equal(resolveOpenUsTax('10467', { now: Date.parse('2030-01-01') }), null);
});
test('refresh requires a consumer-selected output and rejects incomplete source data', async () => {
  await assert.rejects(updateOpenTax(), /explicit output/);
  await assert.rejects(buildOpenTaxSnapshot(['DROP TABLE customers;'], {}), /Incomplete tax dump/);
});


test('quotes allocate cents exactly and preserve caller taxability policy', () => {
  for (const subtotalCents of [1, 13, 1000, 2000, 99999999]) {
    const quote = buildOpenUsTaxQuote({ destination: { country: 'US', postalCode: '10467', state: 'NY' }, subtotalCents, shippingCents: 300, now });
    assert.equal(quote.taxCents, Math.round(subtotalCents * 0.08875));
    assert.equal(quote.breakdown.reduce((sum, row) => sum + row.taxCents, 0), quote.taxCents);
    assert.equal(quote.taxableShippingCents, 0);
    assert.equal(quote.estimated, true);
  }
  const quote = buildOpenUsTaxQuote({ destination: { country: 'US', postalCode: '10467' }, subtotalCents: 1000, directCharge: false, now });
  assert.equal(quote.taxCents, 0);
  assert.equal(quote.effectiveRate, 0);
  assert.equal(buildOpenUsTaxQuote({ destination: { country: 'US', postalCode: '10467', state: 'NM' }, subtotalCents: 1000, now }), null);
});
