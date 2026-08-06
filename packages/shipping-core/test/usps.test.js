import assert from 'node:assert/strict';
import test from 'node:test';

import { createUspsRateClient } from '../src/usps.js';

const baseConfig = {
  enabled: true,
  apiBase: 'https://apis.usps.test',
  clientId: 'client',
  clientSecret: 'secret',
  originCountry: 'US',
  originZip: '87102',
  timeoutMs: 1_000,
  quoteCacheTtlMs: 600_000,
  failureCooldownMs: 60_000,
  rateLimitCooldownMs: 120_000
};
const shipment = {
  weightOz: 16,
  lengthIn: 8,
  widthIn: 6,
  heightIn: 4,
  tierIds: ['mug'],
  supportItemIds: [],
  addOnIds: []
};

function clientWith(fetchTarget, options = {}) {
  return createUspsRateClient({
    resolveConfig: () => ({ ...baseConfig, ...options.config }),
    domesticMailClasses: ['USPS_GROUND_ADVANTAGE', 'PRIORITY_MAIL'],
    internationalMailClasses: [
      'FIRST-CLASS_PACKAGE_INTERNATIONAL_SERVICE',
      'PRIORITY_MAIL_INTERNATIONAL'
    ],
    fetchTarget,
    ...(options.now ? { now: options.now } : {})
  });
}

test('creates an authenticated domestic quote with normalized USPS payload', async () => {
  const requests = [];
  const client = clientWith(async (input, init) => {
    requests.push({ input: String(input), init });
    if (String(input).endsWith('/oauth2/v3/token')) {
      return Response.json({ access_token: 'token', expires_in: 3600 });
    }
    return Response.json({
      rates: [{ price: 6.25, mailClass: 'USPS_GROUND_ADVANTAGE' }]
    });
  });

  const result = await client.quote({}, { country: 'US', postalCode: '80205-1234' }, shipment);

  assert.deepEqual(result, {
    valid: true,
    quote: {
      shippingCents: 625,
      source: 'usps_live',
      carrier: 'usps',
      service: 'usps_ground_advantage',
      domestic: true
    }
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[1].input, 'https://apis.usps.test/prices/v3/base-rates/search');
  assert.equal(requests[1].init.headers.Authorization, 'Bearer token');
  assert.deepEqual(JSON.parse(requests[1].init.body), {
    originZIPCode: '87102',
    destinationZIPCode: '80205',
    weight: 1,
    length: 8,
    width: 6,
    height: 4,
    mailClass: 'USPS_GROUND_ADVANTAGE',
    processingCategory: 'MACHINABLE',
    destinationEntryFacilityType: 'NONE',
    rateIndicator: 'DR',
    priceType: 'RETAIL',
    mailingDate: new Date().toISOString().slice(0, 10)
  });
});

test('caches identical quotes and clears all runtime state explicitly', async () => {
  let calls = 0;
  const client = clientWith(async (input) => {
    calls += 1;
    return String(input).endsWith('/token')
      ? Response.json({ access_token: 'token', expires_in: 3600 })
      : Response.json({ totalBasePrice: 4.5 });
  });
  const destination = { country: 'US', postalCode: '80205' };
  await client.quote({}, destination, shipment);
  await client.quote({}, destination, shipment);
  assert.equal(calls, 2);
  client.reset();
  await client.quote({}, destination, shipment);
  assert.equal(calls, 4);
});

test('refreshes one unauthorized token and never exposes credentials in failures', async () => {
  let tokenCalls = 0;
  let rateCalls = 0;
  const client = clientWith(async (input) => {
    if (String(input).endsWith('/token')) {
      tokenCalls += 1;
      return Response.json({ access_token: `token-${tokenCalls}`, expires_in: 3600 });
    }
    rateCalls += 1;
    return rateCalls === 1
      ? new Response(null, { status: 401 })
      : Response.json({ totalBasePrice: 5 });
  });
  const result = await client.quote({}, { country: 'US', postalCode: '80205' }, shipment);
  assert.equal(result.valid, true);
  assert.equal(tokenCalls, 2);
  assert.equal(rateCalls, 2);
  assert.doesNotMatch(JSON.stringify(result), /secret|token-/);
});

test('arms bounded rate-limit backoff and avoids repeated provider calls', async () => {
  let timestamp = 1_000;
  let calls = 0;
  const client = clientWith(async (input) => {
    calls += 1;
    return String(input).endsWith('/token')
      ? Response.json({ access_token: 'token', expires_in: 3600 })
      : new Response(null, { status: 429 });
  }, { now: () => timestamp });
  const destination = { country: 'US', postalCode: '80205' };
  assert.deepEqual(await client.quote({}, destination, shipment), {
    valid: false,
    error: 'USPS USPS_GROUND_ADVANTAGE quote failed with 429'
  });
  assert.deepEqual(await client.quote({}, destination, shipment), {
    valid: false,
    error: 'USPS rate limit reached'
  });
  assert.equal(calls, 2);
  timestamp += baseConfig.rateLimitCooldownMs + 1;
  await client.quote({}, destination, shipment);
  assert.equal(calls, 3);
});

test('uses the international endpoint and first-class service mapping', async () => {
  const urls = [];
  const client = clientWith(async (input) => {
    urls.push(String(input));
    return String(input).endsWith('/token')
      ? Response.json({ access_token: 'token', expires_in: 3600 })
      : Response.json({ rates: [{ price: 20, description: 'First-Class Package' }] });
  });
  const result = await client.quote({}, { country: 'CA', postalCode: 'h2b 1a0' }, shipment);
  assert.equal(result.quote.domestic, false);
  assert.equal(result.quote.service, 'usps_first_class_package_international');
  assert.equal(
    urls[1],
    'https://apis.usps.test/international-prices/v3/base-rates/search'
  );
});

test('requires bounded explicit mail-class and policy injection', () => {
  assert.throws(() => createUspsRateClient(), /resolveConfig/);
  assert.throws(() => createUspsRateClient({
    resolveConfig: () => baseConfig,
    domesticMailClasses: [],
    internationalMailClasses: ['PRIORITY_MAIL']
  }), /domesticMailClasses/);
});
