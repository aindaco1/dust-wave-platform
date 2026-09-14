export class NotionResponseError extends Error {
  readonly status: number;
  readonly retryAfter: string | null;
  constructor(status: number, retryAfter: string | null, message?: string);
}
export interface NotionRequestOptions {
  token: string; version: string; path: string; init?: RequestInit;
  timeoutMs?: number; maxResponseBytes?: number; fetchTarget?: typeof fetch;
  /** Optional consumer-owned legacy error policy. Default errors contain status only. */
  errorMessage?: (response: { status: number; text: string }) => string;
}
/** Returns parsed JSON (or {} for an empty success). Never retries an attempt. */
export function notionRequest<T = Record<string, unknown>>(options: NotionRequestOptions): Promise<T>;
