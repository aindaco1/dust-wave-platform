export type TokenClaims = Record<string, unknown> & { exp?: number };

export function signExpiringToken(
  claims: TokenClaims,
  secret: string,
  options: {
    now?: Date | number;
    ttlSeconds: number;
    maxTtlSeconds?: number;
    maxPayloadLength?: number;
    maxSecretLength?: number;
  }
): Promise<string>;

export function verifyExpiringToken<T extends TokenClaims = TokenClaims>(
  token: unknown,
  secret: string,
  options?: {
    now?: Date | number;
    maxTokenLength?: number;
    maxPayloadLength?: number;
    maxSecretLength?: number;
    requiredClaims?: string[];
  }
): Promise<T | null>;

export type SessionCookieOptions = {
  requestUrl?: string | URL;
  path?: string;
  maxAgeSeconds: number;
  sameSite?: "Strict" | "Lax" | "None";
  httpOnly?: boolean;
  secure?: boolean;
};

export function createSessionCookie(
  name: string,
  value: unknown,
  options: SessionCookieOptions
): string;

export function clearSessionCookie(
  name: string,
  options: Omit<SessionCookieOptions, "maxAgeSeconds">
): string;

export function isTrustedSameOriginRequest(
  request: Request,
  expectedOrigin: unknown,
  options?: {
    allowMissingSource?: boolean;
    allowUnconfigured?: boolean;
  }
): boolean;
