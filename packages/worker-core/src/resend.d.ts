export type ResendWebhookHeaders = Headers | Record<string, unknown>;

export type ResendWebhookVerification = {
  valid: boolean;
  id: string;
  timestamp?: number;
  error?:
    | "missing_signature"
    | "invalid_event_id"
    | "invalid_timestamp"
    | "timestamp_outside_tolerance"
    | "invalid_secret"
    | "invalid_signature";
};

export class ResendApiError extends Error {
  type: string;
  statusCode: number;
  retryAfterSeconds: number;
  retryable: boolean;
  ambiguous: boolean;
  constructor(message: string, details?: Partial<{
    type: string;
    statusCode: number;
    retryAfterSeconds: number;
    retryable: boolean;
    ambiguous: boolean;
  }>);
}

export function verifyResendWebhook(
  rawBody: unknown,
  headers: ResendWebhookHeaders,
  secret: string,
  options?: {
    now?: Date | number;
    toleranceSeconds?: number;
    maxEventIdLength?: number;
  }
): Promise<ResendWebhookVerification>;

export function parseResendRetryAfter(
  value: unknown,
  options?: { nowMs?: number; maxSeconds?: number }
): number;

export function classifyResendFailure(
  statusCode: unknown,
  options?: {
    retryAfter?: unknown;
    nowMs?: number;
    maxRetryAfterSeconds?: number;
  }
): {
  statusCode: number;
  retryAfterSeconds: number;
  retryable: boolean;
  ambiguous: boolean;
};
