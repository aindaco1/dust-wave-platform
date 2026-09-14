import assert from 'node:assert/strict';
import test from 'node:test';
import { auditDependencies, classifyAuditResult } from '../src/dependency-audit.js';
import { auditPlatform } from '../../../scripts/audit-dependencies.mjs';

function result(severity, status = severity ? 1 : 0) {
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: severity ? 1 : 0 };
  if (severity) counts[severity] = 1;
  return { status, stdout: JSON.stringify({ auditReportVersion: 2, vulnerabilities: severity ? { example: { severity } } : {}, metadata: { vulnerabilities: counts } }) };
}
const failure = code => ({ status: 1, stdout: JSON.stringify({ error: { code } }) });

test('audit classifier requires consistent evidence and preserves injected severity thresholds', () => {
  assert.equal(classifyAuditResult(result()).state, 'passed');
  for (const severity of ['info', 'low', 'moderate', 'high', 'critical']) {
    assert.equal(classifyAuditResult(result(severity, 0), 'info').state, 'findings');
  }
  assert.equal(classifyAuditResult(result('moderate', 0), 'high').state, 'passed');
  assert.equal(classifyAuditResult(result('moderate', 0)).state, 'findings');
  for (const stdout of ['', 'null', '{}', '{"auditReportVersion":2}', '{"error":{}}']) {
    assert.equal(classifyAuditResult({ status: 0, stdout }).state, 'incomplete');
  }
  for (const patch of [{ status: 2 }, { status: 1 }, { signal: 'SIGTERM' }, { error: 'failure' }, { timedOut: true }]) {
    assert.equal(classifyAuditResult({ ...result(), ...patch }).state, 'incomplete');
  }
  const inconsistent = JSON.parse(result('low').stdout);
  inconsistent.vulnerabilities = {};
  assert.equal(classifyAuditResult({ status: 0, stdout: JSON.stringify(inconsistent) }).state, 'incomplete');
  assert.throws(() => classifyAuditResult(result(), 'unknown'), TypeError);
});

test('only known transport failures are retried, with bounded execution and no raw error logging', async () => {
  for (const code of ['E503', 'E429', 'E408', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'EPIPE']) assert.equal(classifyAuditResult(failure(code)).retryable, true);
  for (const code of ['E401', 'E403', 'ENOLOCK', 'ENOENT', 'ENOTFOUND', 'CERT_HAS_EXPIRED']) assert.equal(classifyAuditResult({ ...failure(code), stderr: 'previous E503' }).retryable, false);
  const calls = [], delays = [], logs = [];
  const value = await auditDependencies({ cwd: '/synthetic', scope: 'production', label: 'fixture',
    runCommandFn: (...args) => { calls.push(args); return { ...failure('E503'), stderr: 'private diagnostic' }; },
    sleepFn: delay => delays.push(delay), log: line => logs.push(line) });
  assert.equal(value.state, 'incomplete');
  assert.equal(calls.length, 3);
  assert.deepEqual(delays, [5000, 10000]);
  assert.deepEqual(calls[0][2], { cwd: '/synthetic', timeoutMs: 45000, killSignal: 'SIGKILL' });
  assert.ok(calls[0][1].includes('--omit=dev'));
  assert.ok(!logs.join('\n').includes('private diagnostic'));
  await assert.rejects(auditDependencies({ cwd: '/synthetic', scope: 'unknown', runCommandFn() {} }), TypeError);
});

test('Platform retains high threshold, all dependencies, and incomplete evidence fails closed', async () => {
  const calls = [];
  const options = { runCommandFn: (...args) => { calls.push(args); return result('moderate', 0); }, log() {} };
  assert.equal((await auditPlatform(options)).state, 'passed');
  assert.ok(calls[0][1].includes('--audit-level=high'));
  assert.ok(calls[0][1].includes('--include=dev'));
  assert.equal((await auditPlatform({ ...options, runCommandFn: () => result('high', 0) })).state, 'findings');
  assert.equal((await auditPlatform({ ...options, runCommandFn: () => ({ status: 0, stdout: '' }) })).state, 'incomplete');
});
