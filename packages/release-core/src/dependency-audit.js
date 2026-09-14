import { setTimeout as sleep } from 'node:timers/promises';
const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const attempts = 3;

function validReport(report) {
  const counts = report?.metadata?.vulnerabilities;
  const entries = report?.vulnerabilities;
  if (report?.error || report?.auditReportVersion !== 2 || !counts || !entries ||
      typeof entries !== 'object' || Array.isArray(entries)) return false;
  if (![...severities, 'total'].every(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0)) return false;
  if (severities.reduce((sum, key) => sum + counts[key], 0) !== counts.total) return false;
  const findings = Object.values(entries);
  return findings.length === counts.total && severities.every(severity =>
    findings.filter(finding => finding?.severity === severity).length === counts[severity]
  );
}

export function classifyAuditResult(result, minimumSeverity = 'moderate') {
  if (!severities.includes(minimumSeverity)) throw new TypeError('Invalid audit severity');
  let report;
  try { report = JSON.parse(result.stdout); } catch { /* Incomplete output must never pass. */ }
  if (!result.error && !result.signal && !result.timedOut && validReport(report)) {
    const counts = report.metadata.vulnerabilities;
    if (![0, 1].includes(result.status)) return { state: 'incomplete', retryable: false, reason: 'unexpected npm exit status' };
    if (severities.slice(severities.indexOf(minimumSeverity)).some(severity => counts[severity] > 0)) return { state: 'findings', report };
    if (result.status === 0) return { state: 'passed', report };
    return { state: 'incomplete', retryable: false, reason: 'npm exit status contradicts the report' };
  }

  const code = report?.error?.code || report?.code;
  const statusCode = report?.error?.statusCode || report?.statusCode;
  // Only known transport/service failures are retried, never auth/configuration errors.
  const transientCode = /^(?:E(?:408|429|5\d\d)|ETIMEDOUT|ESOCKETTIMEDOUT|ECONNRESET|EAI_AGAIN|EPIPE)$/;
  const transientMessage = /\b(?:ETIMEDOUT|ESOCKETTIMEDOUT|ECONNRESET|EAI_AGAIN|EPIPE|E408|E429|E5\d\d)\b|network timeout at:|request-timeout/i.test(
    `${report?.message || ''}\n${result.stderr || ''}\n${result.error || ''}`
  );
  const retryable = result.timedOut || (code ? transientCode.test(code) || (code === 'FETCH_ERROR' && transientMessage) :
    statusCode ? [408, 429, 500, 502, 503, 504].includes(statusCode) : transientMessage);
  return {
    state: 'incomplete', retryable: Boolean(retryable),
    reason: result.timedOut ? 'process deadline exceeded' : retryable ? 'npm service/network failure' : 'npm did not return a valid, successful audit report'
  };
}

export async function auditDependencies({ cwd, scope, label = 'dependencies', minimumSeverity = 'moderate', runCommandFn, sleepFn = sleep, log = console.log }) {
  if (!cwd || !['production', 'full'].includes(scope) || !severities.includes(minimumSeverity) || typeof runCommandFn !== 'function') throw new TypeError('Invalid audit directory, scope, severity or command adapter.');
  const args = [
    'audit', '--json', '--package-lock-only', '--ignore-scripts', `--audit-level=${minimumSeverity}`,
    '--fetch-retries=0', '--fetch-timeout=30000', '--include=optional', '--include=peer',
    scope === 'production' ? '--omit=dev' : '--include=dev'
  ];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    log(`[${label}] audit attempt ${attempt}/${attempts} (45s process deadline)`);
    const result = classifyAuditResult(await runCommandFn('npm', args, { cwd, timeoutMs: 45_000, killSignal: 'SIGKILL' }), minimumSeverity);
    if (result.report) {
      log(`[${label}] ${result.state.toUpperCase()}: ${JSON.stringify(result.report.metadata.vulnerabilities)} (failure threshold: ${minimumSeverity})`);
      if (result.report.metadata.vulnerabilities.total > 0) log(JSON.stringify(result.report.vulnerabilities, null, 2));
      return result;
    }
    log(`[${label}] INCOMPLETE: ${result.reason}; this is not a clean audit.`);
    if (!result.retryable || attempt === attempts) return result;
    const delayMs = attempt * 5_000;
    log(`[${label}] retrying in ${delayMs / 1000}s`);
    await sleepFn(delayMs);
  }
}
