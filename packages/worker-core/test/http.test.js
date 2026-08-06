import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SECURITY_HEADERS,
  createWorkerHttpHelpers,
  normalizeOrigin
} from '../src/http.js';

test('normalizes configured origins without accepting wildcard or malformed values', () => {
  assert.equal(normalizeOrigin('https://example.com/path?ignored=1'), 'https://example.com');
  assert.equal(normalizeOrigin('  https://example.com:8443/path  '), 'https://example.com:8443');
  assert.equal(normalizeOrigin('*'), '');
  assert.equal(normalizeOrigin('not an origin'), '');
  assert.equal(normalizeOrigin(null), '');
});

test('requires a valid consumer-owned private fallback origin', () => {
  assert.throws(() => createWorkerHttpHelpers(), /defaultPrivateOrigin/);
  assert.throws(() => createWorkerHttpHelpers({ defaultPrivateOrigin: '*' }), /defaultPrivateOrigin/);
  assert.throws(() => createWorkerHttpHelpers({ defaultPrivateOrigin: 'invalid' }), /defaultPrivateOrigin/);
});

test('preserves Pool and Store private and public CORS resolution', () => {
  const helpers = createWorkerHttpHelpers({ defaultPrivateOrigin: 'https://shop.example/path' });
  assert.equal(helpers.defaultPrivateOrigin, 'https://shop.example');
  assert.equal(helpers.getAllowedOrigin(), 'https://shop.example');
  assert.equal(helpers.getAllowedOrigin({ CORS_ALLOWED_ORIGIN: '*' }), 'https://shop.example');
  assert.equal(helpers.getAllowedOrigin({ SITE_BASE: 'https://site.example/path' }), 'https://site.example');
  assert.equal(helpers.getAllowedOrigin({
    CORS_ALLOWED_ORIGIN: 'https://cors.example/path',
    SITE_BASE: 'https://site.example/path'
  }), 'https://cors.example');
  assert.equal(helpers.getAllowedOrigin({}, true), '*');
});

test('creates bounded-policy JSON responses with the characterized security headers', async () => {
  const helpers = createWorkerHttpHelpers({ defaultPrivateOrigin: 'https://pool.example' });
  const response = helpers.jsonResponse({ ok: true }, 201);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://pool.example');
  assert.equal(response.headers.get('access-control-allow-methods'), 'GET, POST, DELETE, OPTIONS');
  assert.equal(response.headers.get('access-control-allow-headers'), 'Content-Type, Authorization, x-admin-key');
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(response.headers.get(name), value);
  }
});

test('propagates serialization failures instead of returning a misleading success', () => {
  const helpers = createWorkerHttpHelpers({ defaultPrivateOrigin: 'https://pool.example' });
  assert.throws(() => helpers.jsonResponse({ amount: 1n }), TypeError);
});
