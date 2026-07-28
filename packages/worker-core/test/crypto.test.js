import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCookie,
  hmacSha256,
  normalizeEmail,
  randomToken,
  sha256BytesHex,
  sha256Hex,
  timingSafeEqual
} from '../src/crypto.js';

test('normalizes identities and hashes without retaining raw values', async () => {
  assert.equal(normalizeEmail('  PERSON@Example.COM '), 'person@example.com');
  assert.equal(
    await sha256Hex('fixture'),
    'f16d05ec6b29248d2c61adb1e9263f78e4f7bace1b955014a2d17872cfe4064d'
  );
  assert.equal(
    await sha256BytesHex(new TextEncoder().encode('fixture')),
    'f16d05ec6b29248d2c61adb1e9263f78e4f7bace1b955014a2d17872cfe4064d'
  );
  assert.equal(
    await sha256BytesHex(new Uint8Array([0, 255, 128]).buffer),
    'f742b965f156c10374bc23aea96e3a8aff8facd6fc079defeaa30219ad86f211'
  );
  assert.equal((await hmacSha256('fixture', 'secret', 'hex')).length, 64);
});

test('creates high-entropy URL-safe tokens and compares values safely', () => {
  const token = randomToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(timingSafeEqual('same', 'same'), true);
  assert.equal(timingSafeEqual('same', 'different'), false);
});

test('reads an encoded cookie without product-specific policy', () => {
  const request = new Request('https://example.test', {
    headers: { cookie: 'first=value; podcast_session=token%2Evalue' }
  });
  assert.equal(getCookie(request, 'podcast_session'), 'token.value');
  assert.equal(getCookie(request, 'missing'), '');
});
