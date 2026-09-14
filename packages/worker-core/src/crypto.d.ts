export function base64urlEncode(value: Uint8Array | ArrayBuffer): string;
export function randomToken(byteLength?: number): string;
export function sha256Hex(value: unknown): Promise<string>;
export function sha256BytesHex(value: Uint8Array | ArrayBuffer): Promise<string>;
export function hmacSha256(value: unknown, secret: string, encoding?: 'hex' | 'base64url'): Promise<string>;
/** Synchronous comparison: empty tokens never match. */
export function timingSafeEqual(leftValue: unknown, rightValue: unknown): boolean;
/** Asynchronous digest comparison: two empty texts match. */
export function timingSafeEqualText(provided: string, expected: string): Promise<boolean>;
export function normalizeEmail(value: unknown): string;
export function getCookie(request: Pick<Request, 'headers'>, name: string): string;
