import {
  base64urlEncode,
  hmacSha256,
  timingSafeEqual
} from './crypto.js';
import { normalizeOrigin } from './http.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const DEFAULT_MAX_TOKEN_LENGTH = 4096;
const DEFAULT_MAX_PAYLOAD_LENGTH = 2048;
const DEFAULT_MAX_SECRET_LENGTH = 4096;
const DEFAULT_MAX_TTL_SECONDS = 24 * 60 * 60;
const MAX_COOKIE_VALUE_LENGTH = 4096;
const COOKIE_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const COOKIE_PATH_PATTERN = /^\/[^;\u0000-\u001f\u007f]*$/;
const SAME_SITE_VALUES = new Map([
  ['strict', 'Strict'],
  ['lax', 'Lax'],
  ['none', 'None']
]);

function positiveBound(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer`);
  }
  return value;
}

function resolveNowSeconds(value) {
  const milliseconds = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(milliseconds)) throw new RangeError('Token time must be finite');
  return Math.floor(milliseconds / 1000);
}

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function decodeBase64urlJson(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(decoder.decode(bytes));
  } catch {
    return null;
  }
}

export async function signExpiringToken(
  claims,
  secret,
  {
    now = Date.now(),
    ttlSeconds,
    maxTtlSeconds = DEFAULT_MAX_TTL_SECONDS,
    maxPayloadLength = DEFAULT_MAX_PAYLOAD_LENGTH,
    maxSecretLength = DEFAULT_MAX_SECRET_LENGTH
  } = {}
) {
  if (!isPlainRecord(claims)) throw new TypeError('Token claims must be a plain object');
  if (!secret) throw new Error('Token secret is required');
  positiveBound(maxTtlSeconds, 'Maximum token TTL');
  positiveBound(maxPayloadLength, 'Maximum token payload length');
  positiveBound(maxSecretLength, 'Maximum token secret length');
  if (String(secret).length > maxSecretLength) throw new RangeError('Token secret is too large');
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > maxTtlSeconds) {
    throw new RangeError(`Token TTL must be between 1 and ${maxTtlSeconds} seconds`);
  }

  const payload = {
    ...claims,
    exp: resolveNowSeconds(now) + ttlSeconds
  };
  const encoded = base64urlEncode(encoder.encode(JSON.stringify(payload)));
  if (encoded.length > maxPayloadLength) throw new RangeError('Token payload is too large');
  return `${encoded}.${await hmacSha256(encoded, secret)}`;
}

export async function verifyExpiringToken(
  token,
  secret,
  {
    now = Date.now(),
    maxTokenLength = DEFAULT_MAX_TOKEN_LENGTH,
    maxPayloadLength = DEFAULT_MAX_PAYLOAD_LENGTH,
    maxSecretLength = DEFAULT_MAX_SECRET_LENGTH,
    requiredClaims = []
  } = {}
) {
  positiveBound(maxTokenLength, 'Maximum token length');
  positiveBound(maxPayloadLength, 'Maximum token payload length');
  positiveBound(maxSecretLength, 'Maximum token secret length');
  if (!Array.isArray(requiredClaims) || requiredClaims.length > 64
    || requiredClaims.some((claim) => typeof claim !== 'string' || !claim)) {
    throw new TypeError('Required token claims must be non-empty strings');
  }
  if (!secret) return null;
  if (String(secret).length > maxSecretLength) return null;

  const serialized = String(token ?? '');
  if (!serialized || serialized.length > maxTokenLength) return null;
  const parts = serialized.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || encoded.length > maxPayloadLength || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return null;

  const expected = await hmacSha256(encoded, secret);
  if (!timingSafeEqual(signature, expected)) return null;
  const payload = decodeBase64urlJson(encoded);
  if (!isPlainRecord(payload) || !Number.isSafeInteger(payload.exp)) return null;
  if (payload.exp < resolveNowSeconds(now)) return null;
  if (requiredClaims.some((claim) => payload[claim] === undefined || payload[claim] === null || payload[claim] === '')) {
    return null;
  }
  return payload;
}

function normalizeSameSite(value) {
  const normalized = SAME_SITE_VALUES.get(String(value || '').trim().toLowerCase());
  if (!normalized) throw new TypeError('SameSite must be Strict, Lax, or None');
  return normalized;
}

export function createSessionCookie(
  name,
  value,
  {
    requestUrl,
    path = '/',
    maxAgeSeconds,
    sameSite = 'Lax',
    httpOnly = true,
    secure
  } = {}
) {
  const normalizedName = String(name || '');
  const normalizedPath = String(path || '');
  if (!COOKIE_NAME_PATTERN.test(normalizedName)) throw new TypeError('Invalid cookie name');
  if (!COOKIE_PATH_PATTERN.test(normalizedPath) || normalizedPath.length > 1024) {
    throw new TypeError('Invalid cookie path');
  }
  if (!Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds < 0) {
    throw new RangeError('Cookie Max-Age must be a non-negative integer');
  }
  const normalizedSameSite = normalizeSameSite(sameSite);
  let isSecure = secure;
  if (isSecure === undefined) {
    let parsed;
    try {
      parsed = new URL(String(requestUrl || ''));
    } catch {
      throw new TypeError('A valid request URL is required');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new TypeError('Cookie request URL must use HTTP or HTTPS');
    }
    isSecure = parsed.protocol === 'https:';
  }
  if (typeof isSecure !== 'boolean') throw new TypeError('Cookie secure policy must be boolean');
  if (normalizedSameSite === 'None' && !isSecure) {
    throw new TypeError('SameSite=None cookies must be Secure');
  }

  const encodedValue = encodeURIComponent(String(value ?? ''));
  if (encodedValue.length > MAX_COOKIE_VALUE_LENGTH) throw new RangeError('Cookie value is too large');
  const parts = [
    `${normalizedName}=${encodedValue}`,
    `Path=${normalizedPath}`
  ];
  if (httpOnly === true) parts.push('HttpOnly');
  else if (httpOnly !== false) throw new TypeError('Cookie HttpOnly policy must be boolean');
  parts.push(`SameSite=${normalizedSameSite}`, `Max-Age=${maxAgeSeconds}`);
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(name, options = {}) {
  return createSessionCookie(name, '', { ...options, maxAgeSeconds: 0 });
}

export function isTrustedSameOriginRequest(
  request,
  expectedOrigin,
  {
    allowMissingSource = true,
    allowUnconfigured = false
  } = {}
) {
  if (!(request instanceof Request)) throw new TypeError('A Request is required');
  const normalizedExpectedOrigin = normalizeOrigin(expectedOrigin);
  if (!normalizedExpectedOrigin) return allowUnconfigured === true;

  const fetchSite = String(request.headers.get('Sec-Fetch-Site') || '').trim().toLowerCase();
  if (fetchSite === 'cross-site') return false;

  const origin = String(request.headers.get('Origin') || '').trim();
  if (origin) return timingSafeEqual(origin, normalizedExpectedOrigin);

  const referer = String(request.headers.get('Referer') || '').trim();
  if (!referer) return allowMissingSource === true;
  try {
    return timingSafeEqual(new URL(referer).origin, normalizedExpectedOrigin);
  } catch {
    return false;
  }
}
