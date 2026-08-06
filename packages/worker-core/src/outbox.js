import { sha256Hex } from './crypto.js';

const DEFAULT_MAX_RECORD_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_RETRY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MIN_RETRY_MS = 60 * 1000;
const TERMINAL_STATUSES = new Set(['sent', 'failed', 'ambiguous', 'expired', 'suppressed']);
const RESERVED_RECORD_FIELDS = new Set([
  'version', 'jobId', 'kind', 'status', 'payload', 'contentHash',
  'providerPayload', 'providerId', 'attempts', 'createdAt', 'nextAttemptAt',
  'firstAttemptAt', 'lastAttemptAt', 'expiresAt'
]);

export function stableOutboxStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableOutboxStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${stableOutboxStringify(value[key])}`
  ).join(',')}}`;
}

export async function createOutboxJobId({ kind, dedupeKey = '', payload = null } = {}) {
  const normalizedKind = boundedRequired(kind, 'kind', 128);
  const normalizedDedupeKey = String(dedupeKey || stableOutboxStringify(payload));
  if (byteLength(normalizedDedupeKey) > 1_000_000) throw new RangeError('dedupeKey is too large');
  return sha256Hex(`${normalizedKind}:${normalizedDedupeKey}`);
}

export function createOutboxJobRecord({
  jobId,
  kind,
  payload,
  metadata = {},
  existing = null,
  now = new Date(),
  expiresAt = '',
  maxRecordBytes = DEFAULT_MAX_RECORD_BYTES
} = {}) {
  const nowIso = validDate(now, 'now').toISOString();
  const normalizedJobId = validJobId(jobId);
  const normalizedKind = boundedRequired(kind, 'kind', 128);
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new TypeError('metadata must be an object');
  }
  if (Object.keys(metadata).some((key) => RESERVED_RECORD_FIELDS.has(key))) {
    throw new TypeError('metadata cannot override reserved outbox fields');
  }
  const record = {
    version: 1,
    jobId: normalizedJobId,
    kind: normalizedKind,
    status: 'pending',
    ...metadata,
    payload,
    contentHash: '',
    providerPayload: null,
    providerId: '',
    attempts: 0,
    createdAt: validIsoOr(existing?.createdAt, nowIso),
    nextAttemptAt: nowIso,
    firstAttemptAt: '',
    lastAttemptAt: '',
    expiresAt: validIsoOr(expiresAt, '')
  };
  const serialized = JSON.stringify(record);
  if (byteLength(serialized) > positiveInteger(maxRecordBytes, 'maxRecordBytes')) {
    return { ok: false, jobId: normalizedJobId, reason: 'Email payload exceeds the durable outbox limit' };
  }
  return { ok: true, jobId: normalizedJobId, record, serialized };
}

export function createOutboxQueueState({ hasPending, nextDueAt = '', now = new Date() } = {}) {
  const pending = hasPending === true;
  return {
    version: 1,
    hasPending: pending,
    nextDueAt: pending ? validIsoOr(nextDueAt, '') : '',
    updatedAt: validDate(now, 'now').toISOString()
  };
}

export function classifyOutboxJob(job, {
  now = new Date(),
  leaseMs = 10 * 60 * 1000,
  terminalStatuses = TERMINAL_STATUSES
} = {}) {
  if (!job || typeof job !== 'object') return { state: 'missing' };
  const nowMs = validDate(now, 'now').getTime();
  const status = String(job.status || '');
  const terminals = terminalStatuses instanceof Set
    ? terminalStatuses
    : new Set(Array.isArray(terminalStatuses) ? terminalStatuses.map(String) : []);
  if (terminals.has(status)) return { state: 'terminal', status };
  const dueMs = parseDate(job.nextAttemptAt);
  if (dueMs !== null && dueMs > nowMs) return { state: 'not_due', nextDueAt: new Date(dueMs).toISOString() };
  const expiresMs = parseDate(job.expiresAt);
  if (expiresMs !== null && expiresMs <= nowMs) return { state: 'expired' };
  const processingMs = parseDate(job.lastAttemptAt);
  if (
    status === 'processing'
    && processingMs !== null
    && nowMs - processingMs < positiveInteger(leaseMs, 'leaseMs')
  ) {
    return { state: 'leased' };
  }
  return { state: 'ready' };
}

export function outboxRetryDelayMs(error, attempts, {
  minimumMs = DEFAULT_MIN_RETRY_MS,
  maximumMs = DEFAULT_MAX_RETRY_MS,
  quotaTypes = []
} = {}) {
  const min = positiveInteger(minimumMs, 'minimumMs');
  const max = positiveInteger(maximumMs, 'maximumMs');
  if (min > max) throw new RangeError('minimumMs must not exceed maximumMs');
  if (Number(error?.retryAfterSeconds) > 0) {
    return Math.min(max, Math.max(min, Math.round(Number(error.retryAfterSeconds) * 1000)));
  }
  if (Array.isArray(quotaTypes) && quotaTypes.map(String).includes(String(error?.type || ''))) {
    return max;
  }
  const normalizedAttempts = Math.max(0, Math.min(8, Number.isSafeInteger(attempts) ? attempts : 0));
  return Math.min(max, Math.max(min, (2 ** normalizedAttempts) * min));
}

export function outboxDeliveryErrorEvidence(error, { stage } = {}) {
  return {
    type: bounded(String(error?.type || error?.name || 'Error'), 128) || 'Error',
    statusCode: boundedStatus(error?.statusCode),
    ...(stage ? { stage: bounded(String(stage), 64) } : {})
  };
}

export function normalizeOutboxEmail(value = '') {
  return bounded(String(value || '').trim().toLowerCase(), 320);
}

export function safeOutboxTagValue(value = '') {
  return bounded(String(value || '').replace(/[^A-Za-z0-9_-]+/gu, '_').replace(/^_+|_+$/gu, ''), 256) || 'none';
}

export function outboxWebhookTags(data = {}) {
  if (Array.isArray(data?.tags)) {
    return Object.fromEntries(data.tags.slice(0, 100).map((tag) => [
      bounded(String(tag?.name || ''), 128),
      bounded(String(tag?.value || ''), 512)
    ]).filter(([name]) => name));
  }
  if (!data?.tags || typeof data.tags !== 'object') return {};
  return Object.fromEntries(Object.entries(data.tags).slice(0, 100).map(([name, value]) => [
    bounded(name, 128), bounded(String(value ?? ''), 512)
  ]).filter(([name]) => name));
}

export function outboxWebhookDeliveryStatus(type) {
  const normalized = String(type || '');
  if (normalized === 'email.delivered') return 'delivered';
  if (['email.bounced', 'email.complained', 'email.failed', 'email.suppressed'].includes(normalized)) {
    return normalized.replace('email.', '');
  }
  return null;
}

export function outboxWebhookShouldSuppress(event) {
  const type = String(event?.type || '');
  return type === 'email.complained'
    || type === 'email.suppressed'
    || (type === 'email.bounced' && String(event?.data?.bounce?.type || '').toLowerCase() === 'permanent');
}

export function validOutboxJobId(value) {
  return /^[a-f0-9]{64}$/iu.test(String(value || ''));
}

function validJobId(value) {
  if (!validOutboxJobId(value)) throw new TypeError('jobId is invalid');
  return String(value).toLowerCase();
}

function validDate(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${name} is invalid`);
  return date;
}

function validIsoOr(value, fallback) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function parseDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? time : null;
}

function boundedRequired(value, name, maximum) {
  const text = String(value || '').trim();
  if (!text) throw new TypeError(`${name} is required`);
  if (text.length > maximum) throw new RangeError(`${name} is too long`);
  return text;
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function bounded(value, maximum) {
  return String(value).slice(0, maximum);
}

function boundedStatus(value) {
  const status = Number(value);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0;
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`);
  return value;
}
