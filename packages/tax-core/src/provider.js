import { fetchWithTimeout } from '../../worker-core/src/provider-fetch.js';
import { readBoundedText } from '../../worker-core/src/request-validation.js';

const ZIP_TAX_API_BASE = 'https://api.zip-tax.com';
const NM_GRT_API_BASE = 'https://grt.edacnm.org';
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RESPONSE_BYTES = 256_000;
const STREET_SUFFIX_MAP = new Map([
  ['ALLEY', 'ALY'], ['AVENUE', 'AVE'], ['AVE', 'AVE'],
  ['BOULEVARD', 'BLVD'], ['BLVD', 'BLVD'], ['CIRCLE', 'CIR'],
  ['COURT', 'CT'], ['DRIVE', 'DR'], ['DR', 'DR'], ['HIGHWAY', 'HWY'],
  ['LANE', 'LN'], ['PLACE', 'PL'], ['ROAD', 'RD'], ['RD', 'RD'],
  ['STREET', 'ST'], ['ST', 'ST'], ['TERRACE', 'TER'], ['TRAIL', 'TRL'],
  ['WAY', 'WAY']
]);
const STREET_DIRECTIONS = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']);

export class TaxProviderError extends Error {
  constructor(message, code, status = 502) {
    super(message);
    this.name = 'TaxProviderError';
    this.code = code;
    this.status = status;
  }
}

export async function lookupZipTax({
  apiKey,
  address,
  apiBase = ZIP_TAX_API_BASE,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
  fetchTarget = globalThis.fetch
} = {}) {
  const key = requiredBounded(apiKey, 'apiKey', 16_384);
  const normalizedAddress = requiredBounded(address, 'address', 2_048);
  const base = normalizedApiBase(apiBase);
  const response = await providerFetch(
    `${base}/request/v60?address=${encodeURIComponent(normalizedAddress)}&format=json&addressDetailExtended=true`,
    { method: 'GET', headers: { 'X-API-KEY': key } },
    { timeoutMs, maxResponseBytes, fetchTarget, failureLabel: 'Tax lookup' }
  );
  const responseCode = Number(response.payload?.metadata?.response?.code || 0);
  if (!response.ok || responseCode !== 100) {
    throw new TaxProviderError(
      boundedProviderMessage(response.payload, 'Tax lookup failed'),
      'zip_tax_lookup_failed',
      response.status
    );
  }
  return response.payload;
}

export async function lookupNewMexicoGrt({
  street,
  city,
  postalCode,
  county = '',
  apiBase = NM_GRT_API_BASE,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
  fetchTarget = globalThis.fetch
} = {}) {
  if (!street || typeof street !== 'object') throw new TypeError('street is required');
  const params = new URLSearchParams({
    street_number: requiredBounded(street.streetNumber, 'streetNumber', 32),
    street_name: requiredBounded(street.streetName, 'streetName', 256),
    city: requiredBounded(city, 'city', 256),
    zipcode: requiredBounded(postalCode, 'postalCode', 32)
  });
  optionalParam(params, 'pre_direction', street.preDirection, 4);
  optionalParam(params, 'street_suffix', street.streetSuffix, 16);
  optionalParam(params, 'street_post_directional', street.postDirection, 4);
  optionalParam(params, 'county', county, 256);
  const response = await providerFetch(
    `${normalizedApiBase(apiBase)}/api/by_address?${params.toString()}`,
    { method: 'GET', headers: { accept: 'application/json' } },
    { timeoutMs, maxResponseBytes, fetchTarget, failureLabel: 'New Mexico GRT lookup' }
  );
  const result = Array.isArray(response.payload?.results)
    ? response.payload.results[0]
    : null;
  if (!response.ok || !result || result.success !== true) {
    throw new TaxProviderError(
      'New Mexico GRT lookup failed',
      'nm_grt_lookup_failed',
      response.status
    );
  }
  return result;
}

export function buildZipTaxAddress(destination) {
  if (!destination || typeof destination !== 'object') return '';
  return [
    destination.line1,
    destination.line2,
    destination.city,
    destination.state,
    destination.postalCode,
    destination.country
  ].map((value) => bounded(value, 512)).filter(Boolean).join(', ');
}

export function parseNewMexicoStreetAddress(line1) {
  const trimmed = bounded(line1, 512);
  const match = trimmed.match(/^(\d+)\s+(.+)$/u);
  if (!match) return null;
  const tokens = match[2].trim().split(/\s+/u).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 64) return null;
  let preDirection = '';
  let postDirection = '';
  let streetSuffix = '';
  if (tokens.length > 1 && STREET_DIRECTIONS.has(tokens[0].toUpperCase())) {
    preDirection = tokens.shift().toUpperCase();
  }
  if (tokens.length > 1 && STREET_DIRECTIONS.has(tokens.at(-1).toUpperCase())) {
    postDirection = tokens.pop().toUpperCase();
  }
  if (tokens.length > 1) {
    const suffix = STREET_SUFFIX_MAP.get(tokens.at(-1).toUpperCase().replace(/\./gu, '')) || '';
    if (suffix) {
      streetSuffix = suffix;
      tokens.pop();
    }
  }
  const streetName = tokens.join(' ').trim();
  if (!streetName) return null;
  return { streetNumber: match[1], preDirection, streetName, streetSuffix, postDirection };
}

export function normalizeTaxProviderSource(value) {
  return bounded(value, 256)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '') || 'free_api';
}

async function providerFetch(url, init, options) {
  let response;
  try {
    response = await fetchWithTimeout(url, { ...init, redirect: 'error' }, positive(options.timeoutMs, 'timeoutMs'), {
      fetchTarget: options.fetchTarget
    });
  } catch (error) {
    throw new TaxProviderError(
      error?.name === 'AbortError'
        ? `${options.failureLabel} timed out`
        : `${options.failureLabel} failed`,
      error?.name === 'AbortError' ? 'tax_provider_timeout' : 'tax_provider_unavailable'
    );
  }
  let text;
  try {
    text = await readBoundedText(response, positive(options.maxResponseBytes, 'maxResponseBytes'), 'Tax provider response');
  } catch {
    throw new TaxProviderError('Tax provider response is too large', 'tax_provider_response_too_large');
  }
  let payload = {};
  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new TaxProviderError('Tax provider returned an invalid response', 'tax_provider_invalid_response', response.status);
    }
  }
  return { ok: response.ok, status: response.status, payload };
}

function boundedProviderMessage(payload, fallback) {
  return bounded(
    payload?.metadata?.response?.message || payload?.message || fallback,
    512
  ) || fallback;
}

function normalizedApiBase(value) {
  const url = new URL(String(value || ''));
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new TypeError('apiBase must use HTTPS');
  }
  url.pathname = url.pathname.replace(/\/+$/u, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/u, '');
}

function optionalParam(params, name, value, maximum) {
  const normalized = bounded(value, maximum);
  if (normalized) params.set(name, normalized);
}

function requiredBounded(value, name, maximum) {
  const normalized = bounded(value, maximum);
  if (!normalized) throw new TypeError(`${name} is required`);
  if (String(value ?? '').trim().length > maximum) throw new TypeError(`${name} is too long`);
  return normalized;
}

function bounded(value, maximum) {
  return String(value ?? '').trim().slice(0, maximum);
}

function positive(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`);
  return value;
}
