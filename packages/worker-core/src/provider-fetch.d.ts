export interface ProviderFetchOptions {
  fetchTarget?: typeof fetch;
}

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  options?: ProviderFetchOptions
): Promise<Response>;
