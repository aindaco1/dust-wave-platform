import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createGitHubIssueArtifactWriter } from '../src/github-issue-artifacts.js';

const document = { owner: 'example', repository: 'app', issueNumber: 7,
  key: 'fingerprint', name: 'Reviewed diagnostics', body: 'Only reviewed content.' };
const marker = '<!-- dustwave-issue-artifact:fingerprint -->';
const content = `${marker}\n\n${document.body}`;
const storedArtifact = (overrides = {}) => ({ number: 3, type: 'generic',
  name: document.name, body: content, ...overrides });
const failure = status => Object.assign(new Error('provider text must stay private'), { status });

function record() {
  let saved;
  return { get: async () => structuredClone(saved), put: async value => { saved = structuredClone(value); } };
}

function fixture(options = {}) {
  const calls = [];
  const artifacts = [];
  const state = record();
  const request = async (env, path, init) => {
    assert.equal(env.test, true);
    assert.equal(init.headers['X-GitHub-Api-Version'], '2026-03-10');
    assert.ok(init.signal instanceof AbortSignal);
    calls.push({ path, ...init });
    if (init.method === 'GET' && path.includes('?')) return structuredClone(artifacts);
    if (init.method === 'GET') return { artifact: structuredClone(artifacts.find(a => path.endsWith(`/${a.number}`))), versions: [] };
    const body = JSON.parse(init.body);
    if (init.method === 'POST') {
      assert.equal((await state.get()).pending, true, 'intent must be durable before POST');
      const artifact = { number: 3, ...body };
      artifacts.push(artifact);
      return structuredClone(artifact);
    }
    assert.equal(init.method, 'PATCH');
    Object.assign(artifacts[0], body);
    return structuredClone(artifacts[0]);
  };
  const write = createGitHubIssueArtifactWriter({ request, ...options });
  return { calls, artifacts, state, request, write: (doc = document) => write({ test: true }, doc, state) };
}

test('creates one Markdown artifact, skips identical writes, updates it without changing identity', async () => {
  const f = fixture();
  assert.deepEqual(await f.write(), { action: 'created', artifactNumber: 3 });
  assert.deepEqual(JSON.parse(f.calls[1].body), { type: 'generic', name: document.name, body: content });
  assert.deepEqual(await f.write(), { action: 'unchanged', artifactNumber: 3 });
  assert.deepEqual(await f.write({ ...document, body: 'A new reviewed snapshot.' }), { action: 'updated', artifactNumber: 3 });
  assert.deepEqual(f.calls.map(c => c.method), ['GET', 'POST', 'GET', 'GET', 'PATCH']);
  assert.equal(f.artifacts.length, 1);
  assert.equal(f.artifacts[0].body, `${marker}\n\nA new reviewed snapshot.`);
});

test('reconciles a lost create response after restart without a second POST', async () => {
  const f = fixture();
  const write = createGitHubIssueArtifactWriter({ request: async (...args) => {
    const result = await f.request(...args);
    if (args[2].method === 'POST') throw new Error('connection lost');
    return result;
  } });
  await assert.rejects(write({ test: true }, document, f.state), /connection lost/);
  assert.equal((await f.state.get()).pending, true);
  assert.equal((await f.write()).action, 'unchanged');
  assert.equal(f.calls.filter(c => c.method === 'POST').length, 1);
});

test('unresolved create stays pending even when a later complete listing is empty', async () => {
  const state = record();
  let posts = 0;
  const write = createGitHubIssueArtifactWriter({ request: async (_env, _path, init) => {
    if (init.method === 'GET') return [];
    posts++;
    throw new Error('connection lost');
  } });
  await assert.rejects(write({}, document, state), /connection lost/);
  await assert.rejects(write({}, document, state), /unconfirmed/);
  assert.equal(posts, 1);
});

for (const status of [400, 401, 403, 404, 410, 422, 429, 408, 500, 502, 503, 504]) {
  test(`create HTTP ${status} retains the appropriate retry intent`, async () => {
    const state = record();
    let posts = 0;
    const write = createGitHubIssueArtifactWriter({ request: async (_env, _path, init) => {
      if (init.method === 'GET') return [];
      posts++;
      throw failure(status);
    } });
    await assert.rejects(write({}, document, state));
    await assert.rejects(write({}, document, state));
    assert.equal(posts, [400, 401, 403, 404, 410, 422, 429].includes(status) ? 2 : 1);
  });
}

test('searches all pages by marker, ignoring matching names and recovering a renamed artifact', async () => {
  const paths = [];
  const write = createGitHubIssueArtifactWriter({ request: async (_env, path, init) => {
    paths.push(path);
    if (init.method === 'PATCH') return storedArtifact();
    if (path.endsWith('page=1')) return Array.from({ length: 100 }, (_, i) =>
      storedArtifact({ number: i + 10, body: 'Maintainer notes' }));
    return [storedArtifact({ name: 'Renamed by maintainer' })];
  } });
  assert.equal((await write({}, document, record())).action, 'updated');
  assert.deepEqual(paths, ['/repos/example/app/issues/7/artifacts?per_page=100&page=1',
    '/repos/example/app/issues/7/artifacts?per_page=100&page=2', '/repos/example/app/issues/7/artifacts/3']);
});

test('never creates on truncated, failed or malformed listings, or ambiguous identity', async () => {
  for (const response of [Array.from({ length: 100 }, () => storedArtifact({ body: 'unrelated' })),
    { items: [] }, [{ number: 3 }], [storedArtifact(), storedArtifact({ number: 4 })], [storedArtifact({ type: 'embedded_html' })]]) {
    let calls = 0;
    const write = createGitHubIssueArtifactWriter({ maxPages: 1, request: async (_env, _path, init) => {
      calls++;
      assert.equal(init.method, 'GET');
      return response;
    } });
    await assert.rejects(write({}, document, record()));
    assert.equal(calls, 1);
  }
  const state = record();
  const write = createGitHubIssueArtifactWriter({ request: async () => { throw failure(404); } });
  await assert.rejects(write({}, document, state));
  assert.equal(await state.get(), undefined);
});

test('indexed deletion, wrong marker, invalid number and wrong type never cause recreation or overwrite', async () => {
  for (const response of [null, storedArtifact({ body: 'Maintainer replacement' }),
    storedArtifact({ number: 4 }), storedArtifact({ type: 'plan' })]) {
    const f = fixture();
    await f.write();
    const methods = [];
    const write = createGitHubIssueArtifactWriter({ request: async (_env, _path, init) => {
      methods.push(init.method);
      if (!response) throw failure(404);
      return { artifact: response };
    } });
    await assert.rejects(write({}, document, f.state));
    assert.deepEqual(methods, ['GET']);
  }
});

test('validates content, UTF-8 budget, destination, identity and record before network access', async () => {
  let calls = 0;
  const write = createGitHubIssueArtifactWriter({ maxBodyBytes: 100, request: async () => { calls++; } });
  for (const changed of [{ owner: '../evil' }, { repository: 'app/other' }, { issueNumber: '7' },
    { issueNumber: 0 }, { key: 'x -->\n' }, { name: '' }, { name: 'x'.repeat(161) }, { body: null },
    { body: '🚀'.repeat(20) }]) {
    await assert.rejects(write({}, { ...document, ...changed }, record()));
  }
  await assert.rejects(write({}, document, null));
  assert.equal(calls, 0);
  for (const options of [{ maxPages: 0 }, { maxPages: Infinity }, { timeoutMS: -1 }, { maxBodyBytes: NaN }]) {
    assert.throws(() => createGitHubIssueArtifactWriter({ request: async () => {}, ...options }));
  }
});

test('a record cannot silently cross repositories, issues or identities', async () => {
  const f = fixture();
  await f.write();
  const before = f.calls.length;
  for (const changed of [{ owner: 'other' }, { repository: 'other' }, { issueNumber: 8 }, { key: 'other' }]) {
    await assert.rejects(f.write({ ...document, ...changed }), /destination/);
  }
  assert.equal(f.calls.length, before);
});

test('malformed successful create stays uncertain and is not repeated', async () => {
  const state = record();
  let posts = 0;
  const write = createGitHubIssueArtifactWriter({ request: async (_env, _path, init) => {
    if (init.method === 'GET') return [];
    posts++;
    return { number: 3 };
  } });
  await assert.rejects(write({}, document, state));
  await assert.rejects(write({}, document, state), /unconfirmed/);
  assert.equal(posts, 1);
});

test('a failed index save recovers the confirmed artifact on the next call', async () => {
  const f = fixture();
  const put = f.state.put;
  let failed = false;
  f.state.put = async value => {
    if (value.number && !failed) { failed = true; throw new Error('storage failed'); }
    return put(value);
  };
  await assert.rejects(f.write(), /storage failed/);
  assert.equal((await f.write()).action, 'unchanged');
  assert.equal(f.calls.filter(c => c.method === 'POST').length, 1);
});

test('lost PATCH response is reconciled by reading content rather than adding a redundant version', async () => {
  const f = fixture();
  await f.write();
  const changed = { ...document, body: 'Next snapshot.' };
  const write = createGitHubIssueArtifactWriter({ request: async (...args) => {
    const result = await f.request(...args);
    if (args[2].method === 'PATCH') throw new Error('connection lost');
    return result;
  } });
  await assert.rejects(write({ test: true }, changed, f.state), /connection lost/);
  assert.equal((await f.write(changed)).action, 'unchanged');
  assert.equal(f.calls.filter(c => c.method === 'PATCH').length, 1);
});

test('failure to persist create intent prevents any POST', async () => {
  const methods = [];
  const write = createGitHubIssueArtifactWriter({ request: async (_env, _path, init) => {
    methods.push(init.method); return [];
  } });
  await assert.rejects(write({}, document, {
    get: async () => null, put: async () => { throw new Error('storage unavailable'); }
  }), /storage unavailable/);
  assert.deepEqual(methods, ['GET']);
});

test('real local HTTP transport recovers a committed POST after socket loss and honors request timeout', async t => {
  const artifacts = [];
  let posts = 0;
  let hang = false;
  const server = createServer(async (req, res) => {
    if (hang) return;
    if (req.headers['x-github-api-version'] !== '2026-03-10') {
      res.writeHead(400).end(); return;
    }
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(req.url.includes('?') ? artifacts : { artifact: artifacts[0], versions: [] }));
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    if (req.method === 'POST') {
      posts++;
      artifacts.push({ number: 3, ...payload });
      req.socket.destroy(); // Provider committed, response never reached caller.
      return;
    }
    Object.assign(artifacts[0], payload);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(artifacts[0]));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = async (_env, path, init) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { ...init, redirect: 'error' });
    if (!response.ok) throw Object.assign(new Error('HTTP failure'), { status: response.status });
    return response.json();
  };
  const state = record();
  const write = createGitHubIssueArtifactWriter({ request });
  await assert.rejects(write({}, document, state), /fetch failed/);
  assert.equal((await state.get()).pending, true);
  assert.equal((await write({}, document, state)).action, 'unchanged');
  assert.equal((await write({}, { ...document, body: 'Next snapshot.' }, state)).action, 'updated');
  assert.equal(posts, 1);
  hang = true;
  const bounded = createGitHubIssueArtifactWriter({ request, timeoutMS: 20 });
  await assert.rejects(bounded({}, document, state), { name: 'TimeoutError' });
  assert.equal(posts, 1);
});
