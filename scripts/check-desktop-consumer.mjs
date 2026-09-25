#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertConsumerPin } from '../packages/test-core/src/consumer-pin.js';

const root = resolve(process.argv[2] || '.');
const contract = JSON.parse(readFileSync(resolve(root, 'platform-desktop.json'), 'utf8'));
assertConsumerPin({ root, expectedCommit: contract.commit, packages: contract.packages });
if (contract.desktopVersion) {
  assert.equal(readFileSync(resolve(root, 'shared/dust-wave-platform/desktop/VERSION'), 'utf8').trim(), contract.desktopVersion);
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
console.log('Desktop Platform gitlink, package versions and retained Sparkle pin verified.');
