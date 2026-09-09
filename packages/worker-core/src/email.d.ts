export function automaticEmailHeaders(headers?: Record<string, string>): Record<string, string>;
export function prepareResendEmail<T extends { headers?: Record<string, string>; reply_to?: unknown }>(
  payload: T,
  options?: { replyTo?: string }
): T & { headers: Record<string, string>; reply_to?: unknown };
