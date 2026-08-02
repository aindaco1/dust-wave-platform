import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_STRIPE_API_VERSION,
  StripeApiError,
  createStripeClient,
  verifyStripeSignature
} from '../src/stripe.js';

test('verifies current webhook signatures and rejects stale ones', async () => {
  const payload = '{"id":"evt_fixture"}';
  const secret = 'whsec_fixture';
  const timestamp = 1_700_000_000;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`)
  ))).map((byte) => byte.toString(16).padStart(2, '0')).join('');

  assert.deepEqual(
    await verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, {
      nowSeconds: timestamp
    }),
    { valid: true, timestamp }
  );
  assert.equal(
    (await verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, {
      nowSeconds: timestamp + 301
    })).valid,
    false
  );
});

test('uses injected product policy and the current API version', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let observed;
  globalThis.fetch = async (url, init) => {
    observed = { url, init };
    return new Response(JSON.stringify({ id: 'prod_fixture', object: 'product' }), {
      headers: { 'content-type': 'application/json', 'request-id': 'req_fixture' }
    });
  };

  const events = [];
  const client = createStripeClient('rk_test_fixture', {
    userAgent: 'podcast-worker/0.1.0',
    onRequest: (event) => events.push(event)
  });
  const product = await client.products.create(
    { name: 'Podcast', metadata: { show_id: 'show_fixture' } },
    { idempotencyKey: 'product:show_fixture' }
  );

  assert.equal(product.id, 'prod_fixture');
  assert.equal(observed.url, 'https://api.stripe.com/v1/products');
  assert.equal(observed.init.headers['Stripe-Version'], DEFAULT_STRIPE_API_VERSION);
  assert.equal(observed.init.headers['User-Agent'], 'podcast-worker/0.1.0');
  assert.equal(observed.init.headers['Idempotency-Key'], 'product:show_fixture');
  assert.match(observed.init.body, /metadata%5Bshow_id%5D=show_fixture/);
  assert.equal(events[0].path, '/products');
});

test('returns bounded structured provider failures', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { type: 'invalid_request_error', code: 'parameter_invalid', message: 'Invalid field' }
  }), {
    status: 400,
    headers: { 'content-type': 'application/json', 'request-id': 'req_failed' }
  });

  const client = createStripeClient('rk_test_fixture');
  await assert.rejects(
    client.prices.create({ currency: 'usd' }),
    (error) => {
      assert(error instanceof StripeApiError);
      assert.equal(error.code, 'parameter_invalid');
      assert.equal(error.requestId, 'req_failed');
      assert.equal(error.retryable, false);
      return true;
    }
  );
});

test('creates and retrieves tax rates through the shared idempotent client', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  const observed = [];
  globalThis.fetch = async (url, init) => {
    observed.push({ url, init });
    return new Response(JSON.stringify({
      id: 'txr_fixture',
      object: 'tax_rate',
      livemode: false,
      percentage: 7.625
    }), {
      headers: { 'content-type': 'application/json' }
    });
  };

  const client = createStripeClient('rk_test_fixture');
  await client.taxRates.create({
    display_name: 'NM GRT',
    percentage: '7.625',
    inclusive: false,
    country: 'US',
    state: 'NM',
    metadata: { policy_id: 'policy_fixture' }
  }, { idempotencyKey: 'tax-policy:policy_fixture' });
  await client.taxRates.retrieve('txr_fixture');

  assert.equal(observed.length, 2);
  assert.equal(observed[0].url, 'https://api.stripe.com/v1/tax_rates');
  assert.equal(observed[0].init.headers['Idempotency-Key'], 'tax-policy:policy_fixture');
  assert.match(observed[0].init.body, /metadata%5Bpolicy_id%5D=policy_fixture/);
  assert.equal(observed[1].url, 'https://api.stripe.com/v1/tax_rates/txr_fixture');
  assert.equal(observed[1].init.method, 'GET');
});

test('encodes resumable subscription simulation operations through one client', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  const observed = [];
  globalThis.fetch = async (url, init) => {
    observed.push({ url, init });
    return new Response(JSON.stringify({
      id: url.split('/').at(-1) || 'fixture',
      object: 'fixture'
    }), { headers: { 'content-type': 'application/json' } });
  };

  const client = createStripeClient('rk_test_fixture');
  await client.testHelpers.testClocks.create(
    { frozen_time: 1_700_000_000, name: 'Launch Lab' },
    { idempotencyKey: 'clock:fixture' }
  );
  await client.customers.update('cus_fixture', {
    invoice_settings: { default_payment_method: 'pm_fixture' }
  });
  await client.paymentMethods.attach('pm_fixture', {
    customer: 'cus_fixture'
  });
  await client.subscriptions.create({
    customer: 'cus_fixture',
    items: [{ price: 'price_fixture' }]
  });
  await client.subscriptions.update('sub_fixture', {
    default_payment_method: 'pm_fixture'
  });
  await client.invoices.list({ subscription: 'sub_fixture', limit: 3 });
  await client.invoices.pay('in_fixture', {
    payment_method: 'pm_fixture'
  });
  await client.invoicePayments.list({
    invoice: 'in_fixture',
    status: 'paid',
    limit: 10
  });
  await client.refunds.create({
    payment_intent: 'pi_fixture',
    reason: 'requested_by_customer'
  }, { idempotencyKey: 'refund:fixture' });
  await client.refunds.retrieve('re_fixture');
  await client.testHelpers.testClocks.advance('clock_fixture', {
    frozen_time: 1_702_678_400
  });
  await client.subscriptions.cancel('sub_fixture', {
    invoice_now: false,
    prorate: false
  });
  await client.testHelpers.testClocks.delete('clock_fixture');

  assert.deepEqual(observed.map(({ url, init }) => ({
    path: new URL(url).pathname,
    search: new URL(url).search,
    method: init.method
  })), [
    { path: '/v1/test_helpers/test_clocks', search: '', method: 'POST' },
    { path: '/v1/customers/cus_fixture', search: '', method: 'POST' },
    { path: '/v1/payment_methods/pm_fixture/attach', search: '', method: 'POST' },
    { path: '/v1/subscriptions', search: '', method: 'POST' },
    { path: '/v1/subscriptions/sub_fixture', search: '', method: 'POST' },
    { path: '/v1/invoices', search: '?subscription=sub_fixture&limit=3', method: 'GET' },
    { path: '/v1/invoices/in_fixture/pay', search: '', method: 'POST' },
    { path: '/v1/invoice_payments', search: '?invoice=in_fixture&status=paid&limit=10', method: 'GET' },
    { path: '/v1/refunds', search: '', method: 'POST' },
    { path: '/v1/refunds/re_fixture', search: '', method: 'GET' },
    { path: '/v1/test_helpers/test_clocks/clock_fixture/advance', search: '', method: 'POST' },
    { path: '/v1/subscriptions/sub_fixture', search: '', method: 'DELETE' },
    { path: '/v1/test_helpers/test_clocks/clock_fixture', search: '', method: 'DELETE' }
  ]);
  assert.equal(
    observed[0].init.headers['Idempotency-Key'],
    'clock:fixture'
  );
  assert.match(
    observed[2].init.body,
    /customer=cus_fixture/
  );
  assert.match(
    observed[3].init.body,
    /items%5B0%5D%5Bprice%5D=price_fixture/
  );
  assert.equal(observed[8].init.headers['Idempotency-Key'], 'refund:fixture');
  assert.match(observed[8].init.body, /payment_intent=pi_fixture/);
});
