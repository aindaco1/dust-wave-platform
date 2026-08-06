import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyResendFailure,
  parseResendRetryAfter,
  ResendApiError,
  verifyResendWebhook
} from '../src/resend.js';

async function signedFixture(overrides = {}) {
  const rawBody = overrides.rawBody ?? '{"type":"email.delivered"}';
  const id = overrides.id ?? 'evt_resend_fixture';
  const timestamp = overrides.timestamp ?? 1_700_000_000;
  const secretBytes = new TextEncoder().encode('resend_webhook_fixture_secret');
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = new Uint8Array(await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`)
  ));
  let binary = '';
  for (const byte of digest) binary += String.fromCharCode(byte);
  return {
    rawBody,
    id,
    timestamp,
    secret: `whsec_${btoa(String.fromCharCode(...secretBytes))}`,
    signature: btoa(binary)
  };
}

test('verifies the characterized Resend/Svix signature shapes', async () => {
  const fixture = await signedFixture();
  assert.deepEqual(
    await verifyResendWebhook(
      fixture.rawBody,
      {
        id: fixture.id,
        timestamp: String(fixture.timestamp),
        signature: `v1,invalid v1,${fixture.signature}`
      },
      fixture.secret,
      { now: new Date(fixture.timestamp * 1000) }
    ),
    { valid: true, id: fixture.id, timestamp: fixture.timestamp }
  );

  const headers = new Headers({
    'svix-id': fixture.id,
    'svix-timestamp': String(fixture.timestamp),
    'svix-signature': `v1,${fixture.signature}`
  });
  assert.equal((await verifyResendWebhook(
    fixture.rawBody,
    headers,
    fixture.secret,
    { now: fixture.timestamp * 1000 }
  )).valid, true);
});

test('fails malformed, stale, oversized, and invalid signatures closed', async () => {
  const fixture = await signedFixture();
  const headers = {
    id: fixture.id,
    timestamp: String(fixture.timestamp),
    signature: `v1,${fixture.signature}`
  };
  assert.equal((await verifyResendWebhook(
    fixture.rawBody,
    headers,
    fixture.secret,
    { now: new Date((fixture.timestamp + 301) * 1000) }
  )).error, 'timestamp_outside_tolerance');
  assert.equal((await verifyResendWebhook(
    fixture.rawBody,
    { ...headers, timestamp: `${fixture.timestamp}.5` },
    fixture.secret,
    { now: new Date(fixture.timestamp * 1000) }
  )).error, 'invalid_timestamp');
  assert.equal((await verifyResendWebhook(
    fixture.rawBody,
    { ...headers, id: 'x'.repeat(161) },
    fixture.secret,
    { now: new Date(fixture.timestamp * 1000) }
  )).error, 'invalid_event_id');
  assert.equal((await verifyResendWebhook(
    fixture.rawBody,
    headers,
    'whsec_***',
    { now: new Date(fixture.timestamp * 1000) }
  )).error, 'invalid_secret');
  assert.equal((await verifyResendWebhook(
    `${fixture.rawBody} `,
    headers,
    fixture.secret,
    { now: new Date(fixture.timestamp * 1000) }
  )).error, 'invalid_signature');
  assert.equal((await verifyResendWebhook('', {}, '', {
    now: new Date(fixture.timestamp * 1000)
  })).error, 'missing_signature');
});

test('normalizes bounded Retry-After and retry disposition without retrying', () => {
  const nowMs = Date.parse('2026-08-06T12:00:00Z');
  assert.equal(parseResendRetryAfter('120', { nowMs }), 120);
  assert.equal(parseResendRetryAfter('Thu, 06 Aug 2026 12:02:00 GMT', { nowMs }), 120);
  assert.equal(parseResendRetryAfter('999999', { nowMs }), 86_400);
  assert.equal(parseResendRetryAfter('not-a-date', { nowMs }), 0);
  assert.deepEqual(classifyResendFailure(429, { retryAfter: '120', nowMs }), {
    statusCode: 429,
    retryAfterSeconds: 120,
    retryable: true,
    ambiguous: false
  });
  assert.equal(classifyResendFailure(409).retryable, true);
  assert.equal(classifyResendFailure(500).ambiguous, true);
  assert.equal(classifyResendFailure(422).retryable, false);
  assert.deepEqual(classifyResendFailure(0), {
    statusCode: 0,
    retryAfterSeconds: 0,
    retryable: true,
    ambiguous: true
  });
});

test('retains only bounded Resend failure metadata on the shared error', () => {
  const error = new ResendApiError('Provider rejected the request', {
    type: 'validation_error',
    statusCode: 422,
    retryAfterSeconds: 0,
    retryable: false,
    ambiguous: false,
    credential: 'must-not-be-retained'
  });
  assert.equal(error.name, 'ResendApiError');
  assert.equal(error.type, 'validation_error');
  assert.equal(error.statusCode, 422);
  assert.equal(error.credential, undefined);
});
