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
  env: object,
  bypassEnvName: string
): boolean;
export function getTurnstileSecret(
  env: object,
  secretEnvNames?: string[]
): string;
export function isTurnstileRequired(
  env: object,
  options?: TurnstileOptions
): boolean;
export function verifyTurnstile(
  request: Request,
  env: object,
  token: string,
  options?: TurnstileOptions
): Promise<{ ok: true } | TurnstileFailure>;
