const VALID_STATUSES = new Set(['PASS', 'FAIL', 'WARN', 'SKIP']);

function normalizeEntry(entry = {}) {
  const requestedStatus = String(entry?.status || '').trim().toUpperCase();
  return {
    status: VALID_STATUSES.has(requestedStatus) ? requestedStatus : 'FAIL',
    label: String(entry?.label || ''),
    detail: String(entry?.detail || '')
  };
}

export function buildProviderEvidence(entries, options = {}) {
  const normalized = Array.isArray(entries) ? entries.map(normalizeEntry) : [];
  const failCount = normalized.filter((entry) => entry.status === 'FAIL').length;
  const warnCount = normalized.filter((entry) => entry.status === 'WARN').length;
  const skipCount = normalized.filter((entry) => entry.status === 'SKIP').length;
  return {
    schemaVersion: 1,
    generatedAt: String(options.generatedAt || new Date().toISOString()),
    strict: options.strict === true,
    cloudflareDnsOnly: options.cloudflareDnsOnly === true,
    usedDevVars: options.usedDevVars === true,
    status: failCount > 0 ? 'fail' : warnCount > 0 ? 'warning' : skipCount > 0 ? 'incomplete' : 'pass',
    failCount,
    warnCount,
    skipCount,
    results: normalized,
    containsCredentials: false,
    containsCustomerData: false
  };
}

export function providerEvidenceShouldFail(evidence = {}) {
  const failCount = Math.max(0, Number(evidence.failCount || 0) || 0);
  const warnCount = Math.max(0, Number(evidence.warnCount || 0) || 0);
  const skipCount = Math.max(0, Number(evidence.skipCount || 0) || 0);
  return failCount > 0 || (evidence.strict === true && (warnCount > 0 || skipCount > 0));
}
