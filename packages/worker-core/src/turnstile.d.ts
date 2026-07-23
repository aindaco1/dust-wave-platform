export interface TurnstileOptions {
  action?: string;
  secretEnvNames?: string[];
  requiredEnvName?: string;
  bypassEnvName?: string;
}

export interface TurnstileFailure {
  ok: false;
  code: string;
  status: number;
  error: string;
}

export function shouldBypassTurnstile(
  env: Record<string, unknown>,
  bypassEnvName: string
): boolean;
export function getTurnstileSecret(
  env: Record<string, unknown>,
  secretEnvNames?: string[]
): string;
export function isTurnstileRequired(
  env: Record<string, unknown>,
  options?: TurnstileOptions
): boolean;
export function verifyTurnstile(
  request: Request,
  env: Record<string, unknown>,
  token: string,
  options?: TurnstileOptions
): Promise<{ ok: true } | TurnstileFailure>;
