import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTurnstileSecret,
  isTurnstileRequired,
  shouldBypassTurnstile,
  verifyTurnstile
} from '../src/turnstile.js';

test('resolves the first configured secret without exposing it', () => {
  assert.equal(
    getTurnstileSecret(
      { PRIMARY_SECRET: 'first', FALLBACK_SECRET: 'second' },
      ['PRIMARY_SECRET', 'FALLBACK_SECRET']
    ),
    'first'
  );
});

test('allows an explicit bypass only in test or local environments', () => {
  assert.equal(shouldBypassTurnstile({ BYPASS: 'true', APP_MODE: 'test' }, 'BYPASS'), true);
  assert.equal(
    shouldBypassTurnstile({ BYPASS: 'true', SITE_BASE: 'http://localhost:4000' }, 'BYPASS'),
    true
  );
  assert.equal(
    shouldBypassTurnstile({ BYPASS: 'true', SITE_BASE: 'https://dustwave.xyz' }, 'BYPASS'),
    false
  );
});

test('requires a configured secret or an explicit required flag', () => {
  assert.equal(isTurnstileRequired({}), false);
  assert.equal(isTurnstileRequired({ TURNSTILE_SECRET_KEY: 'configured' }), true);
  assert.equal(
    isTurnstileRequired(
      { ADMIN_TURNSTILE_REQUIRED: 'yes' },
      { requiredEnvName: 'ADMIN_TURNSTILE_REQUIRED' }
    ),
    true
  );
});

test('fails closed when Turnstile is required without a secret', async () => {
  const result = await verifyTurnstile(
    new Request('https://example.test/login'),
    { ADMIN_TURNSTILE_REQUIRED: 'true' },
    'token',
    { requiredEnvName: 'ADMIN_TURNSTILE_REQUIRED' }
  );

  assert.deepEqual(result, {
    ok: false,
    code: 'challenge_not_configured',
    status: 503,
    error: 'Challenge is not configured'
  });
});

test('passes the existing request contract to the provider', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  let providerRequest;
  globalThis.fetch = async (url, init) => {
    providerRequest = { url, init };
    return new Response(JSON.stringify({ success: true, action: 'admin_login' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const result = await verifyTurnstile(
    new Request('https://example.test/login', {
      headers: { 'CF-Connecting-IP': '192.0.2.10' }
    }),
    { TURNSTILE_SECRET_KEY: 'secret' },
    'response-token',
    { action: 'admin_login' }
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(providerRequest.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  const body = JSON.parse(providerRequest.init.body);
  assert.equal(body.secret, 'secret');
  assert.equal(body.response, 'response-token');
  assert.equal(body.remoteip, '192.0.2.10');
  assert.match(body.idempotency_key, /^[0-9a-f-]{36}$/i);
});
