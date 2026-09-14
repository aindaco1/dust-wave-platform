import test from 'node:test';
import assert from 'node:assert/strict';
import { createScheduledPreview } from '../src/job.js';
test('scheduled preview renders escaped items without delivery', async () => {
  const drafts = [];
  await createScheduledPreview({ loadItems: async () => [{ title: '<Example>', url: 'https://example.test/', eyebrow: 'Fixture', metadata: '', summary: 'A & B' }], savePreview: async html => drafts.push(html) }).scheduled();
  assert.equal(drafts.length, 1); assert.match(drafts[0], /&lt;Example&gt;/); assert.match(drafts[0], /A &amp; B/);
  await assert.rejects(createScheduledPreview({ loadItems: async () => { throw new Error('source unavailable'); }, savePreview: async html => drafts.push(html) }).scheduled(), /source unavailable/);
  assert.equal(drafts.length, 1);
});
