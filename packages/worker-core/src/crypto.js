const encoder = new TextEncoder();

export function base64urlEncode(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomToken(byteLength = 32) {
  if (!Number.isSafeInteger(byteLength) || byteLength < 16 || byteLength > 128) {
    throw new RangeError('Token byte length must be between 16 and 128');
  }
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value ?? '')));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function hmacSha256(value, secret, encoding = 'base64url') {
  if (!secret) throw new Error('HMAC secret is required');
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(String(value ?? '')))
  );
  if (encoding === 'hex') {
    return Array.from(signature)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  if (encoding !== 'base64url') throw new Error('Unsupported HMAC encoding');
  return base64urlEncode(signature);
}

export function timingSafeEqual(leftValue, rightValue) {
  const left = String(leftValue ?? '');
  const right = String(rightValue ?? '');
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function getCookie(request, name) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (rawName === name) return decodeURIComponent(rawValue.join('='));
  }
  return '';
}
