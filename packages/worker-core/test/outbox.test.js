import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyOutboxJob,
  createOutboxJobId,
  createOutboxJobRecord,
  createOutboxQueueState,
  normalizeOutboxEmail,
  outboxDeliveryErrorEvidence,
  outboxRetryDelayMs,
  outboxWebhookDeliveryStatus,
  outboxWebhookShouldSuppress,
  outboxWebhookTags,
  safeOutboxTagValue,
  stableOutboxStringify,
  validOutboxJobId
} from '../src/outbox.js';

test('preserves canonical Pool and Store payload serialization and job IDs', async () => {
  assert.equal(
    stableOutboxStringify({ z: 1, a: [{ y: true, x: null }] }),
    '{"a":[{"x":null,"y":true}],"z":1}'
  );
  const first = await createOutboxJobId({ kind: 'store_order', payload: { b: 2, a: 1 } });
  const second = await createOutboxJobId({ kind: 'store_order', payload: { a: 1, b: 2 } });
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/u);
  assert.equal(validOutboxJobId(first), true);
});

test('creates a bounded durable record with injected consumer metadata', async () => {
  const jobId = await createOutboxJobId({ kind: 'supporter', dedupeKey: 'order-1' });
  const created = createOutboxJobRecord({
    jobId,
    kind: 'supporter',
    payload: { email: 'person@example.com' },
    metadata: { campaignSlug: 'campaign' },
    existing: { createdAt: '2027-01-01T00:00:00.000Z' },
    now: new Date('2027-02-01T00:00:00.000Z')
  });
  assert.equal(created.ok, true);
  assert.deepEqual(created.record, {
    version: 1,
    jobId,
    kind: 'supporter',
    status: 'pending',
    campaignSlug: 'campaign',
    payload: { email: 'person@example.com' },
    contentHash: '',
    providerPayload: null,
    providerId: '',
    attempts: 0,
    createdAt: '2027-01-01T00:00:00.000Z',
    nextAttemptAt: '2027-02-01T00:00:00.000Z',
    firstAttemptAt: '',
    lastAttemptAt: '',
    expiresAt: ''
  });
  assert.equal(JSON.parse(created.serialized).jobId, jobId);
  assert.equal(createOutboxJobRecord({
    jobId,
    kind: 'supporter',
    payload: { body: 'large' },
    now: new Date('2027-02-01T00:00:00.000Z'),
    maxRecordBytes: 10
  }).ok, false);
});

test('classifies terminal, due, expired, leased, and ready work deterministically', () => {
  const now = new Date('2027-02-01T12:00:00.000Z');
  assert.equal(classifyOutboxJob(null, { now }).state, 'missing');
  assert.equal(classifyOutboxJob({ status: 'failed' }, { now }).state, 'terminal');
  assert.deepEqual(classifyOutboxJob({ status: 'retry', nextAttemptAt: '2027-02-01T12:01:00.000Z' }, { now }), {
    state: 'not_due', nextDueAt: '2027-02-01T12:01:00.000Z'
  });
  assert.equal(classifyOutboxJob({ status: 'pending', expiresAt: '2027-02-01T11:59:00.000Z' }, { now }).state, 'expired');
  assert.equal(classifyOutboxJob({ status: 'processing', lastAttemptAt: '2027-02-01T11:59:00.000Z' }, { now }).state, 'leased');
  assert.equal(classifyOutboxJob({ status: 'processing', lastAttemptAt: '2027-02-01T11:40:00.000Z' }, { now }).state, 'ready');
});

test('preserves retry-after, quota, exponential, and redacted error evidence policy', () => {
  assert.equal(outboxRetryDelayMs({ retryAfterSeconds: 120 }, 1), 120_000);
  assert.equal(outboxRetryDelayMs({ type: 'daily_quota_exceeded' }, 1, {
    quotaTypes: ['daily_quota_exceeded']
  }), 86_400_000);
  assert.equal(outboxRetryDelayMs({}, 2), 240_000);
  assert.deepEqual(outboxDeliveryErrorEvidence({
    type: 'rate_limit', statusCode: 429, message: 'secret body'
  }, { stage: 'provider' }), {
    type: 'rate_limit', statusCode: 429, stage: 'provider'
  });
});

test('normalizes queue state, addresses, tags, and webhook mechanics with bounds', () => {
  assert.deepEqual(createOutboxQueueState({
    hasPending: true,
    nextDueAt: '2027-02-01T12:01:00Z',
    now: new Date('2027-02-01T12:00:00Z')
  }), {
    version: 1,
    hasPending: true,
    nextDueAt: '2027-02-01T12:01:00.000Z',
    updatedAt: '2027-02-01T12:00:00.000Z'
  });
  assert.equal(normalizeOutboxEmail(' Person@Example.COM '), 'person@example.com');
  assert.equal(safeOutboxTagValue(' campaign / one '), 'campaign_one');
  assert.deepEqual(outboxWebhookTags({ tags: [{ name: 'pool_job', value: 'abc' }] }), { pool_job: 'abc' });
  assert.equal(outboxWebhookDeliveryStatus('email.bounced'), 'bounced');
  assert.equal(outboxWebhookDeliveryStatus('email.opened'), null);
  assert.equal(outboxWebhookShouldSuppress({ type: 'email.bounced', data: { bounce: { type: 'permanent' } } }), true);
  assert.equal(outboxWebhookShouldSuppress({ type: 'email.bounced', data: { bounce: { type: 'transient' } } }), false);
});

test('rejects malformed policy and unbounded identifiers before durable work', async () => {
  await assert.rejects(createOutboxJobId({ kind: '', payload: {} }), /kind is required/u);
  await assert.rejects(createOutboxJobId({ kind: 'email', dedupeKey: 'x'.repeat(1_000_001) }), /too large/u);
  assert.throws(() => createOutboxJobRecord({ jobId: 'bad', kind: 'email', payload: {} }), /jobId is invalid/u);
  const jobId = await createOutboxJobId({ kind: 'email', dedupeKey: 'reserved' });
  assert.throws(() => createOutboxJobRecord({
    jobId, kind: 'email', payload: {}, metadata: { status: 'sent' }
  }), /reserved outbox fields/u);
  assert.throws(() => outboxRetryDelayMs({}, 1, { minimumMs: 10, maximumMs: 5 }), /must not exceed/u);
});
