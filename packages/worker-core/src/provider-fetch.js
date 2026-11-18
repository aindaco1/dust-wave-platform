import { fetchProviderResponse } from './provider-response.js';

export async function fetchWithTimeout(
  input,
  init,
  timeoutMs,
  { fetchTarget = globalThis.fetch } = {}
) {
  return fetchProviderResponse(input, init, timeoutMs, fetchTarget, response => response);
}
