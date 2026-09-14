import { readBoundedText } from './response-body.js';

const API = 'https://api.notion.com/v1';

export class NotionResponseError extends Error {
  constructor(status, retryAfter, message = `Notion request failed (${status})`) {
    super(message);
    this.name = 'NotionResponseError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

/** One attempt only. The caller owns retry permission and write reconciliation. */
export async function notionRequest({
  token, version, path, init = {}, timeoutMs = 30_000, maxResponseBytes = 2_000_000,
  fetchTarget = globalThis.fetch, errorMessage
}) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\\#\u0000-\u0020]/.test(path)) {
    throw new TypeError('Notion path must be an API-relative path');
  }
  const url = new URL(`${API}${path}`);
  if (url.origin !== 'https://api.notion.com' || !url.pathname.startsWith('/v1/')) {
    throw new TypeError('Notion path must stay inside /v1/');
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs must be a positive integer');
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0) throw new TypeError('maxResponseBytes must be a positive integer');
  if (typeof token !== 'string' || !token || typeof version !== 'string' || !version) throw new TypeError('Notion token and API version are required');
  if (typeof fetchTarget !== 'function') throw new TypeError('fetchTarget must be a function');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Notion-Version', version);
  headers.set('Content-Type', 'application/json');
  // The signal remains live through body consumption, unlike headers-only timeouts.
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
  signal.throwIfAborted();
  const response = await fetchTarget(url.href, { ...init, headers, redirect: 'manual', signal });
  const text = await readBoundedText(response, maxResponseBytes);
  signal.throwIfAborted();
  if (response.ok) return text ? JSON.parse(text) : {};
  const message = errorMessage?.({ status: response.status, text });
  throw new NotionResponseError(response.status, response.headers.get('retry-after'), message);
}
