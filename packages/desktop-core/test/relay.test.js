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
