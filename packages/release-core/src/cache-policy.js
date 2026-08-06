function normalizedOrigin(value, label) {
  const url = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) {
    throw new Error(`${label} must be an HTTP(S) origin.`);
  }
  return url.origin;
}

function maxAge(cacheControl) {
  const match = String(cacheControl || '').match(/(?:^|,)\s*(?:s-maxage|max-age)=(\d+)/i);
  return match ? Number(match[1]) : 0;
}

export function evaluateCachePolicyTarget(target = {}, response = {}) {
  const cacheControl = String(response.cacheControl || '').toLowerCase();
  const failures = [];
  if (Number(response.status) !== Number(target.status)) failures.push('unexpected_status');
  if (target.type === 'private') {
    if (!cacheControl.includes('private')) failures.push('missing_private');
    if (!cacheControl.includes('no-store')) failures.push('missing_no_store');
  } else {
    if (cacheControl.includes('private') || cacheControl.includes('no-store')) failures.push('unexpected_private');
    if (maxAge(cacheControl) < Number(target.minimumMaxAge || 0)) failures.push('max_age_below_budget');
  }
  return {
    id: String(target.id || ''),
    status: Number(response.status || 0),
    cacheControl,
    cfCacheStatus: String(response.cfCacheStatus || ''),
    ok: failures.length === 0,
    failures
  };
}

export async function collectCachePolicyEvidence(options = {}) {
  const config = options.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('Cache policy evidence requires a parsed configuration object.');
  }
  const bases = {
    site: normalizedOrigin(options.siteBase, 'siteBase'),
    worker: normalizedOrigin(options.workerBase, 'workerBase')
  };
  const fetchImpl = options.fetchImpl || fetch;
  const now = options.now || (() => new Date());
  const checks = [];
  const targets = Array.isArray(config.cachePolicy) ? config.cachePolicy : [];
  if (targets.length > 100) throw new RangeError('Cache policy evidence accepts at most 100 targets.');
  for (const target of targets) {
    const base = bases[target.base];
    if (!base) throw new Error(`Unknown cache policy base: ${target.base}`);
    const targetPath = String(target.path || '');
    if (!targetPath.startsWith('/') || targetPath.startsWith('//') || targetPath.length > 2048) {
      throw new Error(`Invalid cache policy path for ${String(target.id || 'target')}.`);
    }
    const response = await fetchImpl(`${base}${targetPath}`, {
      method: 'GET',
      headers: { Accept: targetPath.endsWith('.json') ? 'application/json' : '*/*' },
      redirect: 'error'
    });
    checks.push(evaluateCachePolicyTarget(target, {
      status: response.status,
      cacheControl: response.headers.get('Cache-Control'),
      cfCacheStatus: response.headers.get('Cf-Cache-Status')
    }));
    await response.body?.cancel().catch(() => undefined);
  }
  return {
    schemaVersion: 1,
    generatedAt: now().toISOString(),
    ok: checks.every((check) => check.ok),
    checks,
    containsCredentials: false,
    containsCustomerData: false
  };
}
