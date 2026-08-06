import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TaxProviderError,
  buildZipTaxAddress,
  lookupNewMexicoGrt,
  lookupZipTax,
  normalizeTaxProviderSource,
  parseNewMexicoStreetAddress
} from '../src/provider.js';

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  });
}

test('performs the characterized Zip-Tax lookup with bounded credentials and address', async () => {
  let observed;
  const payload = { metadata: { response: { code: 100 } }, taxSummaries: [] };
  const result = await lookupZipTax({
    apiKey: 'zip-test-key',
    address: '123 Main St, Denver, CO 80205, US',
    fetchTarget: async (url, init) => {
      observed = { url, init };
      return json(payload);
    }
  });
  assert.deepEqual(result, payload);
  assert.match(observed.url, /^https:\/\/api\.zip-tax\.com\/request\/v60\?/u);
  assert.match(observed.url, /address=123%20Main%20St%2C%20Denver/u);
  assert.equal(observed.init.headers['X-API-KEY'], 'zip-test-key');
  assert.equal(observed.init.redirect, 'error');
  assert.ok(observed.init.signal instanceof AbortSignal);
});

test('performs a normalized New Mexico address lookup', async () => {
  let observed;
  const result = await lookupNewMexicoGrt({
    street: parseNewMexicoStreetAddress('123 N Main Street SE'),
    city: 'Española',
    postalCode: '87532',
    county: 'Rio Arriba',
    fetchTarget: async (url, init) => {
      observed = { url, init };
      return json({ results: [{ success: true, tax_rate: '8.6875' }] });
    }
  });
  assert.equal(result.tax_rate, '8.6875');
  assert.match(observed.url, /street_number=123/u);
  assert.match(observed.url, /pre_direction=N/u);
  assert.match(observed.url, /street_suffix=ST/u);
  assert.match(observed.url, /street_post_directional=SE/u);
  assert.equal(observed.init.method, 'GET');
});

test('preserves the exact shared address and source normalization', () => {
  assert.equal(buildZipTaxAddress({
    line1: '123 Main', city: 'Denver', state: 'CO', postalCode: '80205', country: 'US'
  }), '123 Main, Denver, CO, 80205, US');
  assert.deepEqual(parseNewMexicoStreetAddress('123 W Central Avenue NE'), {
    streetNumber: '123',
    preDirection: 'W',
    streetName: 'Central',
    streetSuffix: 'AVE',
    postDirection: 'NE'
  });
  assert.equal(parseNewMexicoStreetAddress('PO Box 4'), null);
  assert.equal(normalizeTaxProviderSource(' Intuit API '), 'intuit_api');
});

test('bounds responses, times out, rejects unsafe bases, and hides raw failures', async () => {
  await assert.rejects(
    lookupZipTax({ apiKey: 'key', address: 'address', apiBase: 'http://provider.example' }),
    /must use HTTPS/u
  );
  await assert.rejects(
    lookupZipTax({
      apiKey: 'key',
      address: 'address',
      maxResponseBytes: 8,
      fetchTarget: async () => json({ metadata: { response: { code: 100 } } })
    }),
    (error) => error instanceof TaxProviderError && error.code === 'tax_provider_response_too_large'
  );
  await assert.rejects(
    lookupZipTax({
      apiKey: 'secret-key',
      address: 'address',
      fetchTarget: async () => { throw new Error('secret-key leaked'); }
    }),
    (error) => error instanceof TaxProviderError
      && error.code === 'tax_provider_unavailable'
      && !error.message.includes('secret-key')
  );
});

test('returns bounded provider guidance but not response payloads on Zip-Tax failures', async () => {
  await assert.rejects(
    lookupZipTax({
      apiKey: 'key',
      address: 'address',
      fetchTarget: async () => json({
        metadata: { response: { code: 400, message: `Invalid address ${'x'.repeat(1000)}` } }
      }, 400)
    }),
    (error) => error instanceof TaxProviderError
      && error.code === 'zip_tax_lookup_failed'
      && error.status === 400
      && error.message.length === 512
      && !('payload' in error)
  );
});
