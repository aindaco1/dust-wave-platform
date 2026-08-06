import { timingSafeEqual } from './crypto.js';

const encoder = new TextEncoder();
const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
const DEFAULT_MAX_EVENT_ID_LENGTH = 160;
const MAX_SIGNATURE_HEADER_LENGTH = 4096;
const MAX_WEBHOOK_SECRET_LENGTH = 2048;
const DEFAULT_MAX_RETRY_AFTER_SECONDS = 24 * 60 * 60;

export class ResendApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ResendApiError';
    this.type = String(details.type || 'resend_api_error');
    this.statusCode = Number(details.statusCode || 0) || 0;
    this.retryAfterSeconds = Number(details.retryAfterSeconds || 0) || 0;
    this.retryable = details.retryable === true;
    this.ambiguous = details.ambiguous === true;
  }
}

function webhookHeader(headers, fullName, shortName) {
  if (typeof headers?.get === 'function') {
    return String(headers.get(fullName) ?? '');
  }
  const normalized = Object.fromEntries(
    Object.entries(headers ?? {}).map(([name, value]) => [name.toLowerCase(), value])
  );
  return String(normalized[fullName] ?? normalized[shortName] ?? '');
}

function decodeWebhookSecret(secret) {
  const raw = String(secret);
  if (raw.length > MAX_WEBHOOK_SECRET_LENGTH) {
    throw new Error('oversized_webhook_secret');
  }
  const encoded = raw.startsWith('whsec_') ? raw.slice(6) : raw;
  const binary = atob(encoded);
  if (!binary) throw new Error('empty_webhook_secret');
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function verifyResendWebhook(
  rawBody,
  headers,
  secret,
  {
    now = new Date(),
    toleranceSeconds = DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
    maxEventIdLength = DEFAULT_MAX_EVENT_ID_LENGTH
  } = {}
) {
  if (!Number.isSafeInteger(toleranceSeconds) || toleranceSeconds < 0) {
    throw new RangeError('Webhook tolerance must be a non-negative integer');
  }
  if (!Number.isSafeInteger(maxEventIdLength) || maxEventIdLength < 1) {
    throw new RangeError('Webhook event ID length must be a positive integer');
  }

  const id = webhookHeader(headers, 'svix-id', 'id');
  const timestampText = webhookHeader(headers, 'svix-timestamp', 'timestamp');
  const signatureHeader = webhookHeader(headers, 'svix-signature', 'signature');
  if (!id || !timestampText || !signatureHeader || !secret) {
    return { valid: false, id, error: 'missing_signature' };
  }
  if (id.length > maxEventIdLength) {
    return { valid: false, id, error: 'invalid_event_id' };
  }
  if (!/^\d+$/.test(timestampText)) {
    return { valid: false, id, error: 'invalid_timestamp' };
  }
  const timestamp = Number(timestampText);
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isSafeInteger(timestamp) || !Number.isFinite(nowMs)) {
    return { valid: false, id, error: 'invalid_timestamp' };
  }
  if (Math.abs(nowMs / 1000 - timestamp) > toleranceSeconds) {
    return { valid: false, id, error: 'timestamp_outside_tolerance' };
  }
  if (signatureHeader.length > MAX_SIGNATURE_HEADER_LENGTH) {
    return { valid: false, id, error: 'invalid_signature' };
  }

  let secretBytes;
  try {
    secretBytes = decodeWebhookSecret(secret);
  } catch {
    return { valid: false, id, error: 'invalid_secret' };
  }

  let expected;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const digest = new Uint8Array(await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(`${id}.${timestampText}.${String(rawBody ?? '')}`)
    ));
    let binary = '';
    for (const byte of digest) binary += String.fromCharCode(byte);
    expected = btoa(binary);
  } catch {
    return { valid: false, id, error: 'invalid_secret' };
  }

  const candidates = signatureHeader
    .split(/\s+/)
    .map((value) => value.startsWith('v1,') ? value.slice(3) : '')
    .filter(Boolean);
  if (!candidates.some((candidate) => timingSafeEqual(candidate, expected))) {
    return { valid: false, id, error: 'invalid_signature' };
  }
  return { valid: true, id, timestamp };
}

export function parseResendRetryAfter(
  value,
  {
    nowMs = Date.now(),
    maxSeconds = DEFAULT_MAX_RETRY_AFTER_SECONDS
  } = {}
) {
  if (!Number.isSafeInteger(maxSeconds) || maxSeconds < 0) {
    throw new RangeError('Maximum Retry-After must be a non-negative integer');
  }
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  let seconds;
  if (/^\d+$/.test(raw)) {
    seconds = Number(raw);
  } else {
    const retryAt = Date.parse(raw);
    if (!Number.isFinite(retryAt) || !Number.isFinite(nowMs)) return 0;
    seconds = Math.max(0, Math.ceil((retryAt - nowMs) / 1000));
  }
  if (!Number.isSafeInteger(seconds) || seconds < 0) return 0;
  return Math.min(seconds, maxSeconds);
}

export function classifyResendFailure(
  statusCode,
  { retryAfter = '', nowMs = Date.now(), maxRetryAfterSeconds } = {}
) {
  const status = Number(statusCode || 0) || 0;
  const networkFailure = status === 0;
  return {
    statusCode: status,
    retryAfterSeconds: parseResendRetryAfter(retryAfter, {
      nowMs,
      ...(maxRetryAfterSeconds === undefined
        ? {}
        : { maxSeconds: maxRetryAfterSeconds })
    }),
    retryable: networkFailure || status === 409 || status === 429 || status >= 500,
    ambiguous: networkFailure || status >= 500
  };
}
