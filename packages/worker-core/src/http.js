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

// Dynamic allow lists remain consumer-owned because they commonly come from
// Worker environment bindings. This helper deliberately performs exact origin
// matching and never reflects an unlisted request Origin.
export function trustedAllowedOrigin(request, allowedOrigins) {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const allowed = new Set(
    String(allowedOrigins || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
  return allowed.has(origin) ? origin : null;
}

export function createCorsJsonHelpers({
  allowedMethods,
  allowedHeaders,
  accessControlMaxAge = '86400',
  jsonHeaders = {},
  privateHeaders = {}
} = {}) {
  const methods = requiredHeaderValue(allowedMethods, 'allowedMethods');
  const headers = requiredHeaderValue(allowedHeaders, 'allowedHeaders');
  const maxAge = requiredHeaderValue(accessControlMaxAge, 'accessControlMaxAge');
  const baseJsonHeaders = new Headers(jsonHeaders);
  const basePrivateHeaders = new Headers(privateHeaders);

  function corsHeaders(
    request,
    allowedOrigins,
    { credentials = false } = {}
  ) {
    const origin = trustedAllowedOrigin(request, allowedOrigins);
    if (!origin) return {};
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': methods,
      'access-control-allow-headers': headers,
      'access-control-max-age': maxAge,
      ...(credentials ? { 'access-control-allow-credentials': 'true' } : {}),
      vary: 'Origin'
    };
  }

  function json(request, allowedOrigins, body, init = {}) {
    const responseHeaders = new Headers(baseJsonHeaders);
    applyHeaders(responseHeaders, corsHeaders(request, allowedOrigins));
    applyHeaders(responseHeaders, init.headers);
    return new Response(JSON.stringify(body), { ...init, headers: responseHeaders });
  }

  function privateJson(request, allowedOrigins, body, init = {}) {
    const responseHeaders = new Headers(baseJsonHeaders);
    applyHeaders(responseHeaders, corsHeaders(request, allowedOrigins, {
      credentials: true
    }));
    applyHeaders(responseHeaders, init.headers);
    applyHeaders(responseHeaders, basePrivateHeaders);
    return new Response(JSON.stringify(body), { ...init, headers: responseHeaders });
  }

  function options(
    request,
    allowedOrigins,
    { credentials = true } = {}
  ) {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request, allowedOrigins, { credentials })
    });
  }

  return Object.freeze({
    corsHeaders,
    json,
    options,
    privateJson,
    trustedAllowedOrigin
  });
}

function requiredHeaderValue(value, name) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  // Let the Web Platform parser enforce its complete header grammar while
  // rejecting injection before any response can be constructed.
  new Headers({ 'x-platform-policy': normalized });
  return normalized;
}

function applyHeaders(target, source) {
  if (!source) return;
  for (const [name, value] of new Headers(source)) target.set(name, value);
}
