import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearSessionCookie,
  createSessionCookie,
  isTrustedSameOriginRequest,
  signExpiringToken,
  verifyExpiringToken
} from '../src/session-security.js';

const secret = 'characterized-session-secret';
const now = new Date('2026-08-06T12:00:00Z');

test('signs bounded expiring JSON claims and verifies required claims', async () => {
  const token = await signExpiringToken(
    { nonce: 'nonce-one', email: 'person@example.com', label: 'Español' },
    secret,
    { now, ttlSeconds: 900 }
  );
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(
    await verifyExpiringToken(token, secret, {
      now: new Date(now.getTime() + 900_000),
      requiredClaims: ['nonce', 'email']
    }),
    {
      nonce: 'nonce-one',
      email: 'person@example.com',
      label: 'Español',
      exp: Math.floor(now.getTime() / 1000) + 900
    }
  );
});

test('rejects tampered, expired, malformed, unbounded, and incomplete tokens', async () => {
  const token = await signExpiringToken(
    { nonce: 'nonce-two', email: 'person@example.com' },
    secret,
    { now, ttlSeconds: 300 }
  );
  const [payload, signature] = token.split('.');
  assert.equal(await verifyExpiringToken(`${payload}x.${signature}`, secret, { now }), null);
  assert.equal(await verifyExpiringToken(`${token}.suffix`, secret, { now }), null);
  assert.equal(await verifyExpiringToken(token, 'different-secret', { now }), null);
  assert.equal(await verifyExpiringToken(token, secret, { now: new Date(now.getTime() + 301_000) }), null);
  assert.equal(await verifyExpiringToken('x'.repeat(4097), secret, { now }), null);

  const incomplete = await signExpiringToken({ nonce: 'nonce-three' }, secret, { now, ttlSeconds: 60 });
  assert.equal(await verifyExpiringToken(incomplete, secret, {
    now,
    requiredClaims: ['nonce', 'email']
  }), null);
  await assert.rejects(
    signExpiringToken({ value: 'x'.repeat(4096) }, secret, { now, ttlSeconds: 60 }),
    /too large/
  );
  await assert.rejects(
    signExpiringToken({ nonce: 'bounded-secret' }, 'x'.repeat(4097), { now, ttlSeconds: 60 }),
    /secret is too large/
  );
  assert.equal(await verifyExpiringToken(token, 'x'.repeat(4097), { now }), null);
});

test('serializes the characterized secure admin cookie and clear policy', () => {
  assert.equal(
    createSessionCookie('pool_admin_session', 'token=value', {
      requestUrl: 'https://pool.test/admin/auth/exchange',
      path: '/admin',
      maxAgeSeconds: 28_800
    }),
    'pool_admin_session=token%3Dvalue; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=28800; Secure'
  );
  assert.equal(
    clearSessionCookie('store_admin_session', {
      requestUrl: 'http://127.0.0.1:8989/admin/logout',
      path: '/admin'
    }),
    'store_admin_session=; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=0'
  );
});

test('rejects cookie injection and insecure SameSite=None policy', () => {
  assert.throws(() => createSessionCookie('bad;name', 'token', {
    requestUrl: 'https://example.test',
    maxAgeSeconds: 60
  }), /cookie name/i);
  assert.throws(() => createSessionCookie('session', 'token', {
    requestUrl: 'https://example.test',
    path: '/admin; Secure',
    maxAgeSeconds: 60
  }), /cookie path/i);
  assert.throws(() => createSessionCookie('session', 'token', {
    requestUrl: 'http://127.0.0.1',
    maxAgeSeconds: 60,
    sameSite: 'None'
  }), /must be Secure/);
  assert.throws(() => createSessionCookie('session', 'x'.repeat(4097), {
    requestUrl: 'https://example.test',
    maxAgeSeconds: 60
  }), /value is too large/);
});

test('enforces exact same-origin evidence with explicit legacy allowances', () => {
  assert.equal(isTrustedSameOriginRequest(new Request('https://worker.test/admin', {
    headers: { Origin: 'https://pool.test' }
  }), 'https://pool.test/path'), true);
  assert.equal(isTrustedSameOriginRequest(new Request('https://worker.test/admin', {
    headers: { Origin: 'https://evil.test', 'Sec-Fetch-Site': 'cross-site' }
  }), 'https://pool.test'), false);
  assert.equal(isTrustedSameOriginRequest(new Request('https://worker.test/admin', {
    headers: { Referer: 'https://pool.test/admin/' }
  }), 'https://pool.test'), true);
  assert.equal(isTrustedSameOriginRequest(new Request('https://worker.test/admin', {
    headers: { Referer: 'not a url' }
  }), 'https://pool.test'), false);
  assert.equal(isTrustedSameOriginRequest(
    new Request('https://worker.test/admin'),
    'https://pool.test'
  ), true);
  assert.equal(isTrustedSameOriginRequest(
    new Request('https://worker.test/admin'),
    '',
    { allowUnconfigured: true }
  ), true);
  assert.equal(isTrustedSameOriginRequest(new Request('https://worker.test/admin'), ''), false);
});
