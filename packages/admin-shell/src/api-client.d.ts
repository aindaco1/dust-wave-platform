export interface AdminApiClientOptions {
  baseUrl: string;
  credentials?: RequestCredentials;
  csrfHeader?: string;
  fetchImpl?: typeof fetch;
}
export interface AdminApiRequestOptions {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  csrf?: boolean;
}
export class AdminApiError extends Error {
  constructor(message: string, options?: { status?: number; code?: string; details?: unknown });
  status: number;
  code: string;
  details: unknown;
}
export class AdminApiClient {
  #private;
  constructor(options: AdminApiClientOptions);
  setCsrfToken(value: unknown): void;
  clearCsrfToken(): void;
  request(path: string, options?: AdminApiRequestOptions): Promise<unknown>;
}
