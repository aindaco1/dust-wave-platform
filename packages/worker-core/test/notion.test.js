import test from 'node:test';
import assert from 'node:assert/strict';
import { notionRequest, NotionResponseError } from '../src/notion.js';
const options = { token: 'synthetic-token', version: '2026-03-11', path: '/pages/example' };

test('one bounded attempt sets origin-bound credentials and preserves the caller body', async () => {
  let calls = 0;
  const result = await notionRequest({ ...options, init: { method: 'PATCH', body: '{"x":1}', headers: { 'X-Test': 'yes' } }, fetchTarget: async (url, init) => {
    calls++; assert.equal(url, 'https://api.notion.com/v1/pages/example'); assert.equal(init.redirect, 'manual');
    assert.equal(init.headers.get('Authorization'), 'Bearer synthetic-token'); assert.equal(init.headers.get('Notion-Version'), options.version);
    assert.equal(init.headers.get('X-Test'), 'yes'); assert.equal(init.method, 'PATCH'); assert.equal(init.body, '{"x":1}');
    return Response.json({ id: 'result' });
  }});
  assert.deepEqual(result, { id: 'result' }); assert.equal(calls, 1);
});

test('rejects external, escaped and malformed paths before fetching', async () => {
  for (const path of ['https://example.test/x', '//example.test/x', '/../../private', '/%2e%2e/private', '/x\\y', '/x#secret', '/x\nsecret']) {
    await assert.rejects(notionRequest({ ...options, path, fetchTarget: () => { throw new Error('must not fetch'); } }), TypeError);
  }
});

test('status errors redact payloads by default, including redirects, and never retry writes', async () => {
  for (const status of [301, 302, 400, 429, 503]) {
    let calls = 0;
    await assert.rejects(notionRequest({ ...options, init: { method: 'POST', body: '{}' }, fetchTarget: async () => {
      calls++; return new Response('private-provider-body', { status, headers: { 'Retry-After': '2', Location: 'https://example.test/private' } });
    }}), error => error instanceof NotionResponseError && error.status === status && error.retryAfter === '2' && !String(error).includes('private'));
    assert.equal(calls, 1);
  }
});

test('consumer error mapping, empty JSON, parse errors and oversized streams remain explicit', async () => {
  await assert.rejects(notionRequest({ ...options, errorMessage: ({ status, text }) => `local_${status}_${text.length}`, fetchTarget: async () => new Response('safe', { status: 403 }) }), /local_403_4/);
  assert.deepEqual(await notionRequest({ ...options, fetchTarget: async () => new Response('') }), {});
  await assert.rejects(notionRequest({ ...options, fetchTarget: async () => new Response('{') }), SyntaxError);
  let canceled = false;
  await assert.rejects(notionRequest({ ...options, maxResponseBytes: 2, fetchTarget: async () => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('123')); }, cancel() { canceled = true; } })) }), /exceeded 2 byte cap/);
  assert.equal(canceled, true);
});

test('deadline covers response streaming and caller cancellation prevents/rejects attempts', async () => {
  const controller = new AbortController(); controller.abort(); let called = false;
  await assert.rejects(notionRequest({ ...options, init: { signal: controller.signal }, fetchTarget: async () => { called = true; return Response.json({}); } }), { name: 'AbortError' });
  assert.equal(called, false);
  // Keep the Node test alive while the Web Platform timeout fires (its timer is unrefed).
  const timer = setTimeout(() => {}, 500);
  try {
    await assert.rejects(notionRequest({ ...options, timeoutMs: 15, fetchTarget: async (_url, { signal }) => new Response(new ReadableStream({ start(c) { signal.addEventListener('abort', () => c.error(signal.reason), { once: true }); } })) }), { name: 'TimeoutError' });
    const live = new AbortController();
    const pending = notionRequest({ ...options, init: { signal: live.signal }, fetchTarget: async (_url, { signal }) => new Response(new ReadableStream({ start(c) { signal.addEventListener('abort', () => c.error(signal.reason), { once: true }); } })) });
    live.abort(); await assert.rejects(pending, { name: 'AbortError' });
  } finally { clearTimeout(timer); }
});
