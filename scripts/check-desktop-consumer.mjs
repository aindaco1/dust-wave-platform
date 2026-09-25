#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertConsumerPin } from '../packages/test-core/src/consumer-pin.js';

const root = resolve(process.argv[2] || '.');
const contract = JSON.parse(readFileSync(resolve(root, process.argv[3] || 'platform-desktop.json'), 'utf8'));
assertConsumerPin({ root, expectedCommit: contract.commit, packages: contract.packages });
if (contract.desktopVersion) {
  assert.equal(readFileSync(resolve(root, 'shared/dust-wave-platform/desktop/VERSION'), 'utf8').trim(), contract.desktopVersion);
}
for (const [field, directory] of [['supportVersion', 'support'], ['qtVersion', 'qt']]) {
  if (contract[field]) assert.equal(readFileSync(resolve(root, `shared/dust-wave-platform/${directory}/VERSION`), 'utf8').trim(), contract[field]);
}
if (contract.sparkle) {
  const { packagePath, version, revision } = contract.sparkle;
  const manifest = readFileSync(resolve(root, packagePath, 'Package.swift'), 'utf8');
  assert.ok(manifest.includes(`exact: "${version}"`), 'Retain the exact consumer Sparkle declaration');
  const lock = JSON.parse(readFileSync(resolve(root, packagePath, 'Package.resolved'), 'utf8'));
  const pin = lock.pins.find(entry => entry.identity === 'sparkle');
  assert.equal(pin?.state.version, version, 'Sparkle version changed');
  assert.equal(pin?.state.revision, revision, 'Sparkle revision changed');
}
console.log('Platform gitlink, package versions and retained dependency pins verified.');
