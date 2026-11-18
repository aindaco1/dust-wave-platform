import test from 'node:test';
import assert from 'node:assert/strict';
import { ReviewedReportGroup } from '../src/reviewed-report-group.js';
import { createGitHubIssueReporter } from '../src/github-issues.js';
import { createGitHubIssueArtifactWriter } from '../src/github-issue-artifacts.js';

function memoryStorage() {
  const values = new Map();
  return { get: async key => structuredClone(values.get(key)),
    put: async (key, value) => values.set(key, structuredClone(value)) };
}

const reporter = options => createGitHubIssueReporter({
  owner: 'example', repository: 'app', defaultLabels: 'diagnostic',
  issueTitle: () => 'Reviewed diagnostic', issueBody: () => 'reviewed projection',
  groupingSummary: () => ({ basis: 'fixture' }), checkDailyIssueLimit: async () => ({ ok: true }),
  shouldUpdateIssue: async () => true, ...options
});

test('serialized reviewed reports retain count across failure and duplicate retries', async () => {
  const ctx = { storage: memoryStorage() };
  const counts = [];
  let failing = true;
  const dependencies = { owner: 'example', updateAggregateState: reporter({}).updateAggregateState,
    submit: async (env, report, fingerprint, state) => {
      assert.equal(env.GITHUB_OWNER, 'example');
      assert.equal(env.GITHUB_REPO, 'app');
      counts.push(state.count);
      if (failing) { failing = false; return { action: 'pending', status: 503 }; }
      return { action: 'updated', issueNumber: 7 };
    } };
  const adapter = { validate: x => x, fingerprint: async () => 'same', repository: 'app',
    relayReport: report => ({ app: { version: '1.0', os: 'test', arch: 'test' }, report }), failureCode: 'failed' };
  const request = id => new Request('https://example.invalid/reports', { method: 'POST', body: JSON.stringify({ id }) });
  const first = new ReviewedReportGroup(ctx, {}, adapter, dependencies);
  assert.equal((await first.fetch(request('one'))).status, 503);
  const recovered = new ReviewedReportGroup(ctx, {}, adapter, dependencies);
  const receipts = await Promise.all(['one', 'one', 'two'].map(id => recovered.fetch(request(id)).then(r => r.json())));
  assert.deepEqual(receipts.map(r => r.action), ['updated', 'duplicate', 'updated']);
  assert.deepEqual(counts, [1, 1, 2]);
});

test('uncertain issue creation cannot blindly issue another POST', async () => {
  const guard = memoryStorage();
  let posts = 0;
  const api = reporter({ request: async () => { posts++; throw new Error('connection lost'); } });
  const env = { CRASH_CREATION_GUARD: guard };
  await assert.rejects(api.createIssue(env, {}, 'fingerprint', {}), /connection lost/);
  assert.equal((await api.createIssue(env, {}, 'fingerprint', {})).action, 'pending');
  assert.equal(posts, 1);
});

test('definite invalid labels allow one retry without labels', async () => {
  const bodies = [];
  const api = reporter({ request: async (env, path, options) => {
    bodies.push(JSON.parse(options.body));
    if (bodies.length === 1) throw Object.assign(new Error('invalid labels'), { status: 422, errors: [{ field: 'labels' }] });
    return { number: 9, html_url: 'https://example.invalid/9' };
  } });
  assert.equal((await api.createIssue({}, {}, 'fp', {})).issueNumber, 9);
  assert.deepEqual(bodies.map(b => b.labels), [['diagnostic'], undefined]);
});

test('injected markers preserve existing issue identity and aggregate history', () => {
  const api = reporter({ markers: { state: 'legacy-report-state', fingerprint: 'legacy-fingerprint' } });
  const state = { count: 19, versions: { '1.0': 19 }, firstSeen: '2026-01-01T00:00:00Z' };
  assert.equal(api.fingerprintMarker('abc'), '<!-- legacy-fingerprint:abc -->');
  assert.equal(api.parseState(api.stateMarker(state), 'abc').count, 19);
  assert.equal(reporter({}).fingerprintMarker('abc'), '<!-- crash-fingerprint:abc -->');
  assert.throws(() => reporter({ markers: { state: '(unsafe)', fingerprint: 'safe' } }), /marker/);
});

test('initial aggregate adoption runs once and survives subsequent retries', async () => {
  const ctx = { storage: memoryStorage() };
  const counts = [];
  let initializations = 0;
  const adapter = { validate: x => x, fingerprint: async () => 'old', repository: 'app',
    relayReport: report => ({ app: { version: '2.0', os: 'test', arch: 'test' }, report }),
    initialState: async (report, fingerprint, index) => {
      initializations++;
      await index.put('fp:old', JSON.stringify({ number: 4 }));
      return { fingerprint, count: 19, versions: { '1.0': 19 }, platforms: {} };
    } };
  const dependencies = { owner: 'example', updateAggregateState: reporter({}).updateAggregateState,
    submit: async (env, report, fp, state) => {
      assert.equal((await env.CRASH_INDEX.get('fp:old')).number, 4);
      counts.push(state.count); return { action: 'updated', issueNumber: 4 };
    } };
  const request = id => new Request('https://example.invalid/reports', { method: 'POST', body: JSON.stringify({ id }) });
  await new ReviewedReportGroup(ctx, {}, adapter, dependencies).fetch(request('one'));
  await new ReviewedReportGroup(ctx, {}, adapter, dependencies).fetch(request('one'));
  await new ReviewedReportGroup(ctx, {}, adapter, dependencies).fetch(request('two'));
  assert.deepEqual(counts, [20, 21]); assert.equal(initializations, 1);
});

function artifactGroup(options = {}) {
  const ctx = { storage: memoryStorage() };
  const calls = [];
  let artifact;
  const adapter = { validate: x => x, fingerprint: async () => 'same', repository: 'app',
    relayReport: report => ({ app: { version: '1.0', os: 'test', arch: 'test' }, report }),
    issueArtifact: (report, fp, state) => ({ name: 'Reviewed snapshot', body: `${report.id}: ${fp}, count ${state.count}` }) };
  const dependencies = { owner: 'example', updateAggregateState: reporter({}).updateAggregateState,
    submit: async () => ({ action: 'updated', issueNumber: 7 }),
    writeIssueArtifact: createGitHubIssueArtifactWriter({ request: async (_env, path, init) => {
      const saved = await ctx.storage.get('group');
      assert.deepEqual(saved.pending, {}, 'receipt must be committed before artifact publication');
      assert.ok(Object.keys(saved.receipts).length);
      calls.push({ path, method: init.method });
      if (init.method === 'GET') return path.includes('?') ? (artifact ? [artifact] : []) : { artifact };
      artifact = { number: 3, type: 'generic', ...JSON.parse(init.body) };
      return artifact;
    } }), ...options };
  const make = () => new ReviewedReportGroup(ctx, {}, adapter, dependencies);
  const request = id => new Request('https://example.invalid/reports', { method: 'POST', body: JSON.stringify({ id }) });
  return { ctx, calls, adapter, dependencies, make, request, artifact: () => artifact };
}

test('optional artifacts follow durable receipts, serialize versions and skip duplicate IDs across restart', async () => {
  const f = artifactGroup();
  assert.equal((await f.make().fetch(f.request('one'))).status, 200);
  const restarted = f.make();
  const receipts = await Promise.all(['one', 'two', 'three'].map(id => restarted.fetch(f.request(id)).then(r => r.json())));
  assert.deepEqual(receipts.map(r => r.action), ['duplicate', 'updated', 'updated']);
  assert.deepEqual(f.calls.map(c => c.method), ['GET', 'POST', 'GET', 'PATCH', 'GET', 'PATCH']);
  assert.match(f.artifact().body, /three: same, count 3/);
  assert.equal((await f.ctx.storage.get('group')).state.count, 3);
});

test('an artifact failure or formatter failure cannot reject, recount or leak a confirmed report', async t => {
  const errors = [];
  t.mock.method(console, 'error', value => errors.push(value));
  for (const failurePoint of ['writer', 'formatter']) {
    let attempts = 0;
    const fail = () => { attempts++; throw Object.assign(new Error('private payload, provider text and credentials'),
      { status: 403, providerOperation: 'POST', providerReason: 'integration_access' }); };
    const f = artifactGroup(failurePoint === 'writer' ? { writeIssueArtifact: fail } : {});
    if (failurePoint === 'formatter') f.adapter.issueArtifact = fail;
    const response = await f.make().fetch(f.request('one'));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, reportId: 'one', action: 'updated', issueNumber: 7 });
    const duplicate = await f.make().fetch(f.request('one'));
    assert.equal((await duplicate.json()).action, 'duplicate');
    assert.equal((await f.ctx.storage.get('group')).state.count, 1);
    assert.equal(attempts, 1);
  }
  assert.deepEqual(errors, Array.from({ length: 2 }, () => ({ code: 'issue-artifact-failed',
    providerStatus: 403, providerOperation: 'POST', providerReason: 'integration_access' })));
});

test('artifacts require both explicit opt-ins and a confirmed issue, and may be declined per report', async () => {
  for (const mode of ['no-writer', 'no-formatter', 'declined', 'unconfirmed', 'limited']) {
    const f = artifactGroup();
    if (mode === 'no-writer') delete f.dependencies.writeIssueArtifact;
    if (mode === 'no-formatter') delete f.adapter.issueArtifact;
    if (mode === 'declined') f.adapter.issueArtifact = () => null;
    if (mode === 'unconfirmed') f.dependencies.submit = async () => ({ action: 'pending', status: 503 });
    if (mode === 'limited') f.dependencies.submit = async () => ({ action: 'limited', status: 429 });
    const response = await f.make().fetch(f.request('one'));
    assert.equal(response.status, mode === 'unconfirmed' ? 503 : mode === 'limited' ? 429 : 200);
    assert.equal(f.calls.length, 0);
    assert.equal(await f.ctx.storage.get('artifact:7:same'), undefined);
  }
});

test('formatter cannot override the fixed destination or mutate durable aggregate state', async () => {
  const f = artifactGroup();
  f.adapter.issueArtifact = (_report, _fp, state) => {
    state.count = 999;
    return { name: 'Selected content', body: 'Reviewed only', owner: 'other', repository: 'other', issueNumber: 999, key: 'other' };
  };
  await f.make().fetch(f.request('one'));
  assert.ok(f.calls.every(call => call.path.startsWith('/repos/example/app/issues/7/artifacts')));
  assert.match(f.artifact().body, /^<!-- dustwave-issue-artifact:same -->/);
  assert.equal((await f.ctx.storage.get('group')).state.count, 1);
});

test('receipt retention and failed receipt persistence keep their original delivery semantics', async t => {
  t.mock.method(console, 'error', () => {});
  const retained = artifactGroup({ writeIssueArtifact: async (_env, _doc, record) => {
    assert.equal((await retained.ctx.storage.get('receipt:one')).number, 7);
    await record.put({ marker: 'fixture' });
  } });
  retained.adapter.receiptRetentionMS = 86400000;
  retained.ctx.storage.getAlarm = async () => 1;
  assert.equal((await retained.make().fetch(retained.request('one'))).status, 200);
  assert.equal((await (await retained.make().fetch(retained.request('one'))).json()).action, 'duplicate');
  assert.equal((await retained.ctx.storage.get('group')).state.count, 1);

  const failed = artifactGroup();
  const put = failed.ctx.storage.put;
  failed.ctx.storage.put = async (key, value) => {
    if (key === 'group' && value.receipts.one) throw new Error('receipt write failed');
    return put(key, value);
  };
  assert.equal((await failed.make().fetch(failed.request('one'))).status, 502);
  assert.equal(failed.calls.length, 0);
  failed.ctx.storage.put = put;
  assert.equal((await failed.make().fetch(failed.request('one'))).status, 200);
  assert.equal((await failed.ctx.storage.get('group')).state.count, 1);
});

test('retained duplicate repairs interrupted alarm and group saves across restart', async t => {
  t.mock.method(console, 'error', () => {});
  for (const boundary of ['alarm', 'group']) {
    let submits = 0, artifacts = 0, fail = true;
    const fixture = artifactGroup({
      submit: async () => { submits++; return { action: 'updated', issueNumber: 7 }; },
      writeIssueArtifact: async () => { artifacts++; }
    });
    fixture.adapter.receiptRetentionMS = 60000;
    const storage = fixture.ctx.storage;
    let alarm = boundary === 'group' ? 123 : null;
    storage.getAlarm = async () => alarm;
    storage.setAlarm = async when => {
      if (boundary === 'alarm' && fail) throw new Error('alarm unavailable');
      alarm = when;
    };
    const put = storage.put;
    storage.put = async (key, value) => {
      if (boundary === 'group' && fail && key === 'group' && !value.pending.one) throw new Error('save interrupted');
      return put(key, value);
    };
    const send = () => fixture.make().fetch(fixture.request('one'));
    assert.equal((await send()).status, 502);
    const receipt = await storage.get('receipt:one');
    assert.equal((await storage.get('group')).pending.one, true);
    fail = false;
    const retry = await (await send()).json();
    assert.equal(retry.action, 'duplicate');
    assert.equal(retry.issueNumber, 7);
    const group = await storage.get('group');
    assert.deepEqual(group.pending, {});
    assert.equal(group.state.count, 1);
    assert.deepEqual(await storage.get('receipt:one'), receipt);
    assert.ok(alarm);
    if (boundary === 'group') assert.equal(alarm, 123);
    assert.equal(submits, 1);
    assert.equal(artifacts, 0);
    await put('receipt:one', { ...receipt, expires: 0 });
    assert.equal((await (await send()).json()).action, 'updated');
    assert.equal(submits, 2);
  }
});
