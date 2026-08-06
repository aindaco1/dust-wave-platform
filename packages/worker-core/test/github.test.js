import assert from 'node:assert/strict';
import test from 'node:test';

import { createGitHubClient } from '../src/github.js';

function client(fetchTarget, overrides = {}) {
  return createGitHubClient({
    token: 'github-test-token',
    owner: 'aindaco1',
    repo: 'example',
    ref: 'main',
    userAgent: 'platform-test',
    fetchTarget,
    ...overrides
  });
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers }
  });
}

test('dispatches a bounded workflow request without exposing credentials', async () => {
  let observed;
  const result = await client(async (url, init) => {
    observed = { url, init };
    return new Response(null, { status: 204 });
  }).dispatchWorkflow('deploy.yml', { reason: 'manual' });

  assert.deepEqual(result, { ok: true, status: 204, workflow: 'deploy.yml' });
  assert.equal(observed.url, 'https://api.github.com/repos/aindaco1/example/actions/workflows/deploy.yml/dispatches');
  assert.equal(observed.init.redirect, 'error');
  assert.equal(observed.init.headers.authorization, 'Bearer github-test-token');
  assert.deepEqual(JSON.parse(observed.init.body), { ref: 'main', inputs: { reason: 'manual' } });
});

test('reads and writes UTF-8 content with optimistic SHA evidence', async () => {
  const calls = [];
  const github = client(async (url, init) => {
    calls.push({ url, init });
    if (init.method === 'GET') {
      return json({ path: 'docs/caf%C3%A9.md', sha: 'old-sha', encoding: 'base64', content: btoa(unescape(encodeURIComponent('café'))) });
    }
    return json({ content: { path: 'docs/café.md', sha: 'new-sha' }, commit: { sha: 'commit-sha', html_url: 'https://example.test/commit' } }, 201);
  });
  const read = await github.getTextFile('docs/café.md');
  assert.equal(read.ok, true);
  assert.equal(read.content, 'café');
  const write = await github.putTextFile('docs/café.md', 'updated café', 'Update', read.sha);
  assert.equal(write.ok, true);
  assert.equal(write.commitSha, 'commit-sha');
  assert.match(calls[0].url, /contents\/docs\/caf%C3%A9\.md\?ref=main$/u);
  assert.equal(JSON.parse(calls[1].init.body).sha, 'old-sha');
});

test('rejects traversal, unsafe refs, and oversized workflow input sets before transport', async () => {
  let calls = 0;
  const github = client(async () => {
    calls += 1;
    return json({});
  });
  await assert.rejects(github.getTextFile('../secret'), /invalid segment/u);
  assert.throws(() => client(async () => json({}), { ref: 'main..prod' }), /ref is invalid/u);
  await assert.rejects(
    github.dispatchWorkflow('deploy.yml', Object.fromEntries(Array.from({ length: 26 }, (_, index) => [`key_${index}`, 'x']))),
    /inputs exceeds/u
  );
  assert.equal(calls, 0);
});

test('bounds declared and streamed provider responses', async () => {
  const declared = await client(
    async () => new Response('{}', { headers: { 'content-length': '99' } }),
    { maxResponseBytes: 10 }
  ).getTextFile('data.json');
  assert.equal(declared.code, 'github_response_too_large');

  const streamed = await client(
    async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"value":"too large"}'));
        controller.close();
      }
    })),
    { maxResponseBytes: 5 }
  ).getTextFile('data.json');
  assert.equal(streamed.code, 'github_response_too_large');
});

test('maps timeouts and network failures to secret-safe errors', async () => {
  const timeout = await client(
    (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('token=secret', 'AbortError')), { once: true });
    }),
    { timeoutMs: 1 }
  ).getTextFile('data.json');
  assert.deepEqual(timeout, {
    ok: false,
    status: 502,
    code: 'github_timeout',
    error: 'GitHub request timed out',
    path: 'data.json'
  });

  const network = await client(async () => {
    throw new Error('github-test-token leaked');
  }).getTextFile('data.json');
  assert.equal(network.error, 'Unable to reach GitHub');
  assert.doesNotMatch(JSON.stringify(network), /github-test-token/u);
});

test('allows public reads but does not send mutations without a configured token', async () => {
  let calls = 0;
  const github = client(async () => {
    calls += 1;
    return json({ encoding: 'base64', content: btoa('public'), sha: 'public-sha' });
  }, { token: '' });
  assert.equal((await github.getTextFile('data.json')).content, 'public');
  assert.equal((await github.dispatchWorkflow('deploy.yml')).code, 'github_not_configured');
  assert.equal((await github.putTextFile('data.json', 'private')).code, 'github_not_configured');
  assert.equal(calls, 1);
});

test('rejects duplicate batch paths and stale optimistic-concurrency evidence', async () => {
  const duplicate = await client(async () => json({})).putTextFiles([
    { path: 'one.md', content: 'first' },
    { path: 'one.md', content: 'second' }
  ]);
  assert.equal(duplicate.code, 'github_duplicate_path');

  const responses = [
    json({ object: { sha: 'base-commit' } }),
    json({ tree: { sha: 'base-tree' } }),
    json({ sha: 'different-sha' })
  ];
  const stale = await client(async () => responses.shift()).putTextFiles([
    { path: 'one.md', content: 'new', expectedSha: 'expected-sha' }
  ]);
  assert.equal(stale.status, 409);
  assert.equal(stale.code, 'github_file_changed');
});

test('creates one non-force commit for a characterized multi-file update', async () => {
  const calls = [];
  const responses = [
    json({ object: { sha: 'base-commit' } }),
    json({ tree: { sha: 'base-tree' } }),
    json({ sha: 'blob-one' }, 201),
    json({ sha: 'blob-two' }, 201),
    json({ sha: 'new-tree' }, 201),
    json({ sha: 'new-commit', html_url: 'https://example.test/new-commit' }, 201),
    json({ object: { sha: 'new-commit' } })
  ];
  const result = await client(async (url, init) => {
    calls.push({ url, init });
    return responses.shift();
  }).putTextFiles([
    { path: 'one.md', content: 'one' },
    { path: 'two.md', content: 'two' }
  ], 'Update both');

  assert.equal(result.ok, true);
  assert.equal(result.updated, 2);
  assert.equal(result.commitSha, 'new-commit');
  const patch = calls.at(-1);
  assert.equal(patch.init.method, 'PATCH');
  assert.deepEqual(JSON.parse(patch.init.body), { sha: 'new-commit', force: false });
});

test('lists normalized entries and treats an absent delete target as idempotent', async () => {
  const responses = [
    json([{ name: 'one.md', path: 'docs/one.md', type: 'file', sha: 'sha-one' }, { name: '', path: '', type: 'file' }]),
    json({ message: 'Not Found' }, 404)
  ];
  const github = client(async () => responses.shift());
  const list = await github.listDirectory('docs');
  assert.deepEqual(list, { ok: true, entries: [{ name: 'one.md', path: 'docs/one.md', type: 'file', sha: 'sha-one' }] });
  assert.deepEqual(await github.deleteFile('missing.md'), {
    ok: true,
    path: 'missing.md',
    deleted: false,
    skipped: true,
    reason: 'not_found'
  });
});
