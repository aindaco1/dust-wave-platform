import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const { assertConsumerPin } = await import(pathToFileURL(resolve(root, 'shared/dust-wave-platform/packages/test-core/src/consumer-pin.js')));
const packages = JSON.parse(readFileSync('platform-packages.json', 'utf8'));
assertConsumerPin({ root, expectedCommit: readFileSync('platform-commit.txt', 'utf8').trim(), packages,
  lockfiles: [{ path: 'package-lock.json', packages: Object.fromEntries(Object.entries(packages).map(([name, version]) => [`shared/dust-wave-platform/packages/${name}`, version])) }] });
console.log('Reviewed Platform gitlink, package versions and lockfile match.');
