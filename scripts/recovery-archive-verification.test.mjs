import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

test('read-only recovery archive verification contracts for Store and Pool', () => {
  execFileSync('python3', ['scripts/test-recovery-archive-verification.py'], {
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }, stdio: 'pipe', timeout: 30_000
  });
});
