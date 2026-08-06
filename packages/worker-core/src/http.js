// These headers preserve the independently characterized Pool and Store
// response contract. Consumers retain CSP, HSTS, cache, authentication, and
// route-specific header policy.
export const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
});

const ALLOWED_METHODS = 'GET, POST, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization, x-admin-key';

export function normalizeOrigin(value) {
  const configured = String(value || '').trim();
  if (!configured || configured === '*') return '';
  try {
    return new URL(configured).origin;
  } catch {
    return '';
  }
}

export function createWorkerHttpHelpers({ defaultPrivateOrigin } = {}) {
  const normalizedDefaultOrigin = normalizeOrigin(defaultPrivateOrigin);
  if (!normalizedDefaultOrigin) {
    throw new TypeError('A valid non-wildcard defaultPrivateOrigin is required');
  }

  function getAllowedOrigin(env, isPublic = false) {
    if (isPublic) return '*';
    return normalizeOrigin(env?.CORS_ALLOWED_ORIGIN)
      || normalizeOrigin(env?.SITE_BASE)
      || normalizedDefaultOrigin;
  }

  function jsonResponse(data, status = 200, env = null, isPublic = false) {
    const origin = getAllowedOrigin(env, isPublic);
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': ALLOWED_METHODS,
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        ...SECURITY_HEADERS
      }
    });
  }

  return Object.freeze({
    defaultPrivateOrigin: normalizedDefaultOrigin,
    getAllowedOrigin,
    jsonResponse
  });
}
