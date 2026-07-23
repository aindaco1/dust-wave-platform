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
