import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { auditDependencies } from '../packages/release-core/src/dependency-audit.js';

function runCommand(command, args, { cwd, timeoutMs, killSignal }) {
  const result = spawnSync(command, args, { cwd, timeout: timeoutMs, killSignal, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return { ...result, stdout: result.stdout || '', stderr: result.stderr || '', timedOut: result.error?.code === 'ETIMEDOUT' };
}

export function auditPlatform(options = {}) {
  return auditDependencies({ cwd: fileURLToPath(new URL('../', import.meta.url)), scope: 'full',
    label: 'platform/full', minimumSeverity: 'high', runCommandFn: runCommand, ...options });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  auditPlatform().then(result => { process.exitCode = { passed: 0, findings: 1, incomplete: 2 }[result.state]; })
    .catch(() => { console.error('Dependency audit failed before producing a complete result.'); process.exitCode = 2; });
}
