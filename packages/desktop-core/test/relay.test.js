import test from 'node:test';
import assert from 'node:assert/strict';
import { ReviewedReportGroup } from '../src/reviewed-report-group.js';
import { createGitHubIssueReporter } from '../src/github-issues.js';

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
