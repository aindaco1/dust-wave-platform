export const SECURITY_HEADERS: Readonly<{
  'X-Content-Type-Options': 'nosniff';
  'X-Frame-Options': 'DENY';
  'X-XSS-Protection': '1; mode=block';
  'Referrer-Policy': 'strict-origin-when-cross-origin';
}>;

export interface WorkerHttpEnvironment {
  CORS_ALLOWED_ORIGIN?: unknown;
  SITE_BASE?: unknown;
}

export interface WorkerHttpHelpers {
  readonly defaultPrivateOrigin: string;
  getAllowedOrigin(env?: WorkerHttpEnvironment | null, isPublic?: boolean): string;
  jsonResponse(
    data: unknown,
    status?: number,
    env?: WorkerHttpEnvironment | null,
    isPublic?: boolean
  ): Response;
}

export function normalizeOrigin(value: unknown): string;

export function createWorkerHttpHelpers(options: {
  defaultPrivateOrigin: string;
}): WorkerHttpHelpers;

export interface CorsJsonHelpers {
  corsHeaders(
    request: Request,
    allowedOrigins: string,
    options?: { credentials?: boolean }
  ): HeadersInit;
  json(
    request: Request,
    allowedOrigins: string,
    body: unknown,
    init?: ResponseInit
  ): Response;
  privateJson(
    request: Request,
    allowedOrigins: string,
    body: unknown,
    init?: ResponseInit
  ): Response;
  options(
    request: Request,
    allowedOrigins: string,
    options?: { credentials?: boolean }
  ): Response;
  trustedAllowedOrigin(request: Request, allowedOrigins: string): string | null;
}

export function trustedAllowedOrigin(
  request: Request,
  allowedOrigins: string
): string | null;

export function createCorsJsonHelpers(options: {
  allowedMethods: string;
  allowedHeaders: string;
  accessControlMaxAge?: string;
  jsonHeaders?: HeadersInit;
  privateHeaders?: HeadersInit;
}): CorsJsonHelpers;
