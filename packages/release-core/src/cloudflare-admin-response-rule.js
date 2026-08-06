const API_BASE = 'https://api.cloudflare.com/client/v4';
export const ADMIN_RESPONSE_RULE_PHASE = 'http_response_cache_settings';

function boundedText(value, label, maximum = 128) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized.length > maximum || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`${label} is missing or invalid.`);
  }
  return normalized;
}

function normalizedPaths(values, label) {
  if (!Array.isArray(values) || !values.length || values.length > 20) throw new Error(`${label} is missing or invalid.`);
  return Object.freeze(values.map((value) => {
    const path = boundedText(value, label, 256);
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('?') || path.includes('#')) throw new Error(`${label} is missing or invalid.`);
    return path.replace(/\/$/, '') || '/';
  }));
}

function normalizedPolicy(policy = {}) {
  return Object.freeze({
    ruleRef: boundedText(policy.ruleRef, 'ruleRef'),
    ruleDescription: boundedText(policy.ruleDescription, 'ruleDescription', 256),
    rulesetName: boundedText(policy.rulesetName, 'rulesetName', 256),
    rulesetDescription: boundedText(policy.rulesetDescription, 'rulesetDescription', 256),
    adminPaths: normalizedPaths(policy.adminPaths, 'adminPaths'),
    publicPaths: normalizedPaths(policy.publicPaths, 'publicPaths')
  });
}

function normalizedSiteBase(value) {
  const url = new URL(String(value || '').trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) {
    throw new Error('Cloudflare admin response rule requires an HTTPS site origin.');
  }
  return url.origin;
}

function normalizedZoneId(value) {
  const zoneId = String(value || '').trim();
  if (!/^[a-f0-9]{32}$/i.test(zoneId)) throw new Error('Cloudflare admin response rule requires CLOUDFLARE_ZONE_ID.');
  return zoneId;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = canonicalJson(value[key]);
    return output;
  }, {});
}

function cacheControlDirectives(value) {
  return new Map(String(value || '').split(',').map((part) => {
    const [name, directiveValue = ''] = part.trim().toLowerCase().split('=', 2);
    return [name, directiveValue.replace(/^"|"$/g, '')];
  }).filter(([name]) => name));
}

function apiErrorDetails(payload) {
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];
  if (!errors.length) return 'no Cloudflare error code';
  return errors.slice(0, 10).map((error) => String(error?.code || 'unknown').slice(0, 32)).join(',');
}

async function cloudflareRequest({ zoneId, token, path, method = 'GET', body, fetchImpl = fetch, allowNotFound = false }) {
  const response = await fetchImpl(`${API_BASE}/zones/${zoneId}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'error'
  });
  const payload = await response.json().catch(() => ({}));
  if (allowNotFound && response.status === 404) return null;
  if (!response.ok || payload?.success === false) {
    throw new Error(`Cloudflare Rulesets API ${method} failed with status ${response.status} (${apiErrorDetails(payload)}).`);
  }
  return payload?.result || null;
}

export function createAdminResponseRuleClient(inputPolicy = {}) {
  const policy = normalizedPolicy(inputPolicy);

  function buildAdminResponseRule(siteBase) {
    const hostname = new URL(normalizedSiteBase(siteBase)).hostname;
    const pathExpression = policy.adminPaths.map((path) => (
      `http.request.uri.path eq "${path}" or starts_with(http.request.uri.path, "${path}/")`
    )).join(' or ');
    return {
      action: 'set_cache_control',
      action_parameters: {
        'max-age': { operation: 'set', value: 0 },
        'must-revalidate': { operation: 'set' },
        'no-store': { operation: 'set' },
        'no-transform': { operation: 'set' },
        private: { operation: 'set' }
      },
      description: policy.ruleDescription,
      enabled: true,
      expression: `(http.host eq "${hostname}" and (${pathExpression}))`,
      ref: policy.ruleRef
    };
  }

  function adminResponseRuleMatches(actual, desired) {
    if (!actual) return false;
    const selected = {
      action: actual.action,
      action_parameters: actual.action_parameters,
      description: actual.description,
      enabled: actual.enabled !== false,
      expression: actual.expression,
      ref: actual.ref
    };
    return JSON.stringify(canonicalJson(selected)) === JSON.stringify(canonicalJson(desired));
  }

  async function verifyAdminResponsePolicy(options = {}) {
    const siteBase = normalizedSiteBase(options.siteBase);
    const fetchImpl = options.fetchImpl || fetch;
    const nonce = options.nonce || (() => `${Date.now()}`);
    const routes = [];
    for (const [index, route] of policy.publicPaths.entries()) {
      const response = await fetchImpl(`${siteBase}${route}/?edge-policy-check=${encodeURIComponent(nonce())}-${index}`, {
        headers: { Accept: 'text/html' },
        redirect: 'error'
      });
      const body = await response.text();
      const cacheControl = response.headers.get('cache-control') || '';
      const reportOnlyCsp = response.headers.get('content-security-policy-report-only') || '';
      const directives = cacheControlDirectives(cacheControl);
      const missing = ['private', 'no-store', 'no-transform', 'must-revalidate'].filter((name) => !directives.has(name));
      if (directives.get('max-age') !== '0') missing.push('max-age=0');
      const injected = /challenge-platform\/scripts\/jsd|__CF\$cv|static\.cloudflareinsights\.com\/beacon\.min|data-cf-beacon/i.test(body);
      if (!response.ok || missing.length || injected || reportOnlyCsp) {
        throw new Error(`Admin response policy verification failed for ${route} (status ${response.status}; missing ${missing.join(',') || 'none'}; edge injection ${injected ? 'present' : 'absent'}; report-only CSP ${reportOnlyCsp ? 'present' : 'absent'}).`);
      }
      routes.push({ route: `${route}/`, status: response.status, cacheControl, edgeInjection: false, reportOnlyCsp: false });
    }
    return {
      schemaVersion: 1,
      mode: 'public_verification',
      state: 'current',
      hostname: new URL(siteBase).hostname,
      routes,
      containsResponseBodies: false,
      containsCredentials: false,
      containsCustomerData: false
    };
  }

  function findManagedRule(ruleset) {
    return (ruleset?.rules || []).find((rule) => rule?.ref === policy.ruleRef || rule?.description === policy.ruleDescription) || null;
  }

  async function configureAdminResponseRule(options = {}) {
    const zoneId = normalizedZoneId(options.zoneId);
    const token = boundedText(options.token, 'Cloudflare admin response rule token', 4096);
    const desired = buildAdminResponseRule(options.siteBase);
    const requestOptions = { zoneId, token, fetchImpl: options.fetchImpl };
    const readEntrypoint = () => cloudflareRequest({
      ...requestOptions,
      path: `/rulesets/phases/${ADMIN_RESPONSE_RULE_PHASE}/entrypoint`,
      allowNotFound: true
    });
    let ruleset = await readEntrypoint();
    let existing = findManagedRule(ruleset);
    let state = existing ? (adminResponseRuleMatches(existing, desired) ? 'current' : 'drifted') : 'missing';
    let operation = 'none';

    if (options.apply === true && state !== 'current') {
      if (!ruleset) {
        operation = 'create_ruleset';
        ruleset = await cloudflareRequest({
          ...requestOptions,
          path: '/rulesets',
          method: 'POST',
          body: { name: policy.rulesetName, description: policy.rulesetDescription, kind: 'zone', phase: ADMIN_RESPONSE_RULE_PHASE, rules: [desired] }
        });
      } else if (!existing) {
        operation = 'add_rule';
        ruleset = await cloudflareRequest({ ...requestOptions, path: `/rulesets/${ruleset.id}/rules`, method: 'POST', body: desired });
      } else {
        operation = 'update_rule';
        ruleset = await cloudflareRequest({ ...requestOptions, path: `/rulesets/${ruleset.id}/rules/${existing.id}`, method: 'PATCH', body: desired });
      }
      existing = findManagedRule(ruleset) || findManagedRule(await readEntrypoint());
      if (!adminResponseRuleMatches(existing, desired)) throw new Error('Cloudflare admin response rule did not verify after apply.');
      state = 'current';
    }

    return {
      schemaVersion: 1,
      mode: options.apply === true ? 'apply' : 'read_only',
      state,
      operation,
      changed: operation !== 'none',
      hostname: new URL(normalizedSiteBase(options.siteBase)).hostname,
      paths: [...policy.adminPaths],
      cacheControl: 'private, no-store, no-transform, max-age=0, must-revalidate',
      containsCredentials: false,
      containsCustomerData: false
    };
  }

  return Object.freeze({
    phase: ADMIN_RESPONSE_RULE_PHASE,
    policy,
    buildAdminResponseRule,
    adminResponseRuleMatches,
    verifyAdminResponsePolicy,
    configureAdminResponseRule
  });
}
