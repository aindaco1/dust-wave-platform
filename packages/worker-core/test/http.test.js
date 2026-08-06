import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SECURITY_HEADERS,
  createCorsJsonHelpers,
  createWorkerHttpHelpers,
  normalizeOrigin,
  trustedAllowedOrigin
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

const podcastPolicy = {
  allowedMethods: 'GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS',
  allowedHeaders: 'content-type,if-none-match,if-range,range,x-podcast-csrf,x-podcast-upload-bytes,x-turnstile-token',
  jsonHeaders: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  },
  privateHeaders: {
    'cache-control': 'private, no-store, max-age=0',
    'x-robots-tag': 'noindex, nofollow, noarchive'
  }
};

test('matches only exact origins from a dynamic comma-separated allow list', () => {
  const request = new Request('https://worker.example', {
    headers: { origin: 'https://site.example' }
  });
  assert.equal(
    trustedAllowedOrigin(
      request,
      ' https://admin.example, https://site.example '
    ),
    'https://site.example'
  );
  assert.equal(trustedAllowedOrigin(request, 'https://evil.example'), null);
  assert.equal(
    trustedAllowedOrigin(new Request('https://worker.example'), 'https://site.example'),
    null
  );
});

test('requires valid explicit CORS response policy', () => {
  assert.throws(() => createCorsJsonHelpers(), /allowedMethods/);
  assert.throws(
    () => createCorsJsonHelpers({ allowedMethods: 'GET', allowedHeaders: '' }),
    /allowedHeaders/
  );
  assert.throws(
    () => createCorsJsonHelpers({
      allowedMethods: 'GET\r\nx-injected: yes',
      allowedHeaders: 'content-type'
    }),
    TypeError
  );
});

test('builds exact public and private JSON/CORS response contracts', async () => {
  const helpers = createCorsJsonHelpers(podcastPolicy);
  const request = new Request('https://worker.example', {
    headers: { origin: 'https://site.example' }
  });
  const response = helpers.json(
    request,
    'https://site.example',
    { ok: true },
    { status: 201, headers: { 'cache-control': 'public, max-age=60' } }
  );
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://site.example');
  assert.equal(response.headers.get('access-control-allow-credentials'), null);

  const privateResponse = helpers.privateJson(
    request,
    'https://site.example',
    { ok: true },
    { headers: { 'cache-control': 'public', 'x-robots-tag': 'index' } }
  );
  assert.equal(
    privateResponse.headers.get('cache-control'),
    'private, no-store, max-age=0'
  );
  assert.equal(
    privateResponse.headers.get('x-robots-tag'),
    'noindex, nofollow, noarchive'
  );
  assert.equal(
    privateResponse.headers.get('access-control-allow-credentials'),
    'true'
  );
});

test('builds credentialed or public empty preflight responses', async () => {
  const helpers = createCorsJsonHelpers(podcastPolicy);
  const request = new Request('https://worker.example', {
    headers: { origin: 'https://site.example' }
  });
  const credentialed = helpers.options(request, 'https://site.example');
  const publicResponse = helpers.options(request, 'https://site.example', {
    credentials: false
  });
  assert.equal(credentialed.status, 204);
  assert.equal(await credentialed.text(), '');
  assert.equal(
    credentialed.headers.get('access-control-allow-credentials'),
    'true'
  );
  assert.equal(publicResponse.headers.get('access-control-allow-credentials'), null);
});
