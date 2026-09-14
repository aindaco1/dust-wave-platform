import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewWorker } from '../src/worker.js';
import { createPreviewClient } from '../src/admin.js';
test('admin client and Worker compose with application authorization and bounded input', async () => {
  const worker = createPreviewWorker({ authorize: async request => request.headers.get('x-dustwave-csrf') === 'fixture-token' });
  const preview = createPreviewClient({ baseUrl: 'https://example.test', csrfToken: 'fixture-token', fetchImpl: (url, init) => worker.fetch(new Request(url, init)) });
  assert.deepEqual(await preview('Example'), { preview: 'Example' });
  await assert.rejects(preview('x'.repeat(5000)), error => error.status === 413);
  assert.equal((await createPreviewWorker().fetch(new Request('https://example.test/admin/preview', { method: 'POST' }))).status, 401);
  assert.equal((await worker.fetch(new Request('https://example.test/admin/preview'))).status, 405);
});
