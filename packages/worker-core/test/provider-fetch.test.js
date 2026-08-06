import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchWithTimeout } from '../src/provider-fetch.js';

test('passes a managed abort signal to an injected fetch target', async () => {
  const expected = new Response(null, { status: 204 });
  let observed;
  const response = await fetchWithTimeout(
    'https://provider.example',
    { method: 'POST' },
    1_000,
    {
      fetchTarget: async (input, init) => {
        observed = { input, init };
        return expected;
      }
    }
  );
  assert.equal(response, expected);
  assert.equal(observed.input, 'https://provider.example');
  assert.equal(observed.init.method, 'POST');
  assert.ok(observed.init.signal instanceof AbortSignal);
});

test('aborts provider work at its configured deadline', async () => {
  await assert.rejects(
    fetchWithTimeout('https://provider.example', {}, 1, {
      fetchTarget: (_input, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        }, { once: true });
      })
    }),
    { name: 'AbortError' }
  );
});

test('validates timeout ownership and injected transport before provider work', async () => {
  await assert.rejects(
    fetchWithTimeout('https://provider.example', {}, 0),
    /timeoutMs must be a positive integer/
  );
  await assert.rejects(
    fetchWithTimeout(
      'https://provider.example',
      { signal: new AbortController().signal },
      1_000
    ),
    /manages its own abort signal/
  );
  await assert.rejects(
    fetchWithTimeout('https://provider.example', {}, 1_000, { fetchTarget: null }),
    /fetchTarget must be a function/
  );
});

test('propagates provider failures unchanged', async () => {
  const providerFailure = new Error('provider failed');
  await assert.rejects(
    fetchWithTimeout('https://provider.example', {}, 1_000, {
      fetchTarget: async () => {
        throw providerFailure;
      }
    }),
    (error) => error === providerFailure
  );
});
