import assert from 'node:assert/strict';
import test from 'node:test';

import { collectCachePolicyEvidence, evaluateCachePolicyTarget } from '../src/cache-policy.js';

test('cache policy evaluation preserves private and public failure semantics', () => {
  assert.deepEqual(evaluateCachePolicyTarget(
    { id: 'admin', status: 200, type: 'private' },
    { status: 200, cacheControl: 'private, no-store, max-age=0', cfCacheStatus: 'DYNAMIC' }
  ), {
    id: 'admin',
    status: 200,
    cacheControl: 'private, no-store, max-age=0',
    cfCacheStatus: 'DYNAMIC',
    ok: true,
    failures: []
  });
  assert.deepEqual(evaluateCachePolicyTarget(
    { id: 'asset', status: 200, type: 'public', minimumMaxAge: 3600 },
    { status: 404, cacheControl: 'private, max-age=60' }
  ).failures, ['unexpected_status', 'unexpected_private', 'max_age_below_budget']);
});

test('cache policy collection uses exact origins, rejects redirects, and cancels bodies', async () => {
  const calls = [];
  let cancelled = 0;
  const evidence = await collectCachePolicyEvidence({
    config: {
      cachePolicy: [
        { id: 'home', base: 'site', path: '/', status: 200, minimumMaxAge: 60 },
        { id: 'inventory', base: 'worker', path: '/inventory.json', status: 200, minimumMaxAge: 0 }
      ]
    },
    siteBase: 'https://site.example',
    workerBase: 'https://worker.example/',
    now: () => new Date('2026-08-06T00:00:00.000Z'),
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        status: 200,
        headers: new Headers({ 'Cache-Control': 'public, max-age=120', 'Cf-Cache-Status': 'HIT' }),
        body: { cancel: async () => { cancelled += 1; } }
      };
    }
  });

  assert.deepEqual(calls.map((call) => call.url), ['https://site.example/', 'https://worker.example/inventory.json']);
  assert.ok(calls.every((call) => call.init.redirect === 'error'));
  assert.equal(cancelled, 2);
  assert.equal(evidence.generatedAt, '2026-08-06T00:00:00.000Z');
  assert.equal(evidence.ok, true);
  assert.equal(evidence.containsCredentials, false);
  assert.equal(evidence.containsCustomerData, false);
});

test('cache policy collection rejects unsafe origins, paths, and unbounded target lists before fetch', async () => {
  const base = { config: { cachePolicy: [] }, siteBase: 'https://site.example', workerBase: 'https://worker.example' };
  await assert.rejects(() => collectCachePolicyEvidence({ ...base, siteBase: 'https://user:secret@site.example' }), /HTTP\(S\) origin/);
  await assert.rejects(() => collectCachePolicyEvidence({ ...base, config: { cachePolicy: [{ base: 'site', path: '//evil.example', status: 200 }] } }), /Invalid cache policy path/);
  await assert.rejects(() => collectCachePolicyEvidence({ ...base, config: { cachePolicy: Array.from({ length: 101 }, () => ({ base: 'site', path: '/', status: 200 })) } }), /at most 100/);
});
