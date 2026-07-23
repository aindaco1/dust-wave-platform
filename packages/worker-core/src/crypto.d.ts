export function base64urlEncode(value: Uint8Array | ArrayBuffer): string;
export function randomToken(byteLength?: number): string;
export function sha256Hex(value: unknown): Promise<string>;
export function hmacSha256(
  value: unknown,
  secret: string,
  encoding?: "base64url" | "hex"
): Promise<string>;
export function timingSafeEqual(leftValue: unknown, rightValue: unknown): boolean;
export function normalizeEmail(value: unknown): string;
export function getCookie(request: Request, name: string): string;
