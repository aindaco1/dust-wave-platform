import { execFileSync } from 'node:child_process';
import test from 'node:test';

test('public admin declarations compile without consumer ambient modules', () => {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--skipLibCheck', 'false',
    '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--lib', 'ES2022,DOM,DOM.Iterable',
    'packages/admin-shell/test/types/consumer.ts'], { stdio: 'pipe' });
});
