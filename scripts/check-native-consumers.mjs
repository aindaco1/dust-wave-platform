#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const defaultPlatform = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
export function checkNativeConsumers(root, platform = defaultPlatform) {
const expected = git(platform, 'rev-parse', 'HEAD');
const consumers = JSON.parse(fs.readFileSync(path.join(platform, 'native/consumers.json')));
const results = [];
for (const [name, contract] of Object.entries(consumers)) {
  const failures = [];
  try {
    const repo = path.join(root, name);
    const dependency = path.join(repo, 'shared/dust-wave-platform');
    const staged = git(repo, 'ls-files', '--stage', 'shared/dust-wave-platform').split(/\s+/);
    if (staged[0] !== '160000' || staged[1] !== expected || git(dependency, 'rev-parse', 'HEAD') !== expected) failures.push('Platform gitlink/checkout mismatch');
    if (git(dependency, 'status', '--porcelain', '--untracked-files=normal', '--', 'native')) failures.push('Native dependency is modified');
    for (const pkg of contract.packages) {
      const manifest = fs.readFileSync(path.join(repo, pkg, 'Package.swift'), 'utf8');
      if (!manifest.includes('shared/dust-wave-platform/native')) failures.push(`${pkg}: shared SwiftPM dependency missing`);
    }
    const manifest = fs.readFileSync(path.join(repo, contract.speechPackage, 'Package.swift'), 'utf8');
    if (!manifest.includes(`FluidAudio.git", exact: "${contract.fluidAudio}"`)) failures.push('Exact FluidAudio declaration differs');
    const lock = JSON.parse(fs.readFileSync(path.join(repo, contract.speechPackage, 'Package.resolved')));
    const pin = lock.pins.find(pin => pin.identity === 'fluidaudio')?.state;
    if (pin?.version !== contract.fluidAudio || pin?.revision !== contract.fluidAudioRevision) failures.push('FluidAudio lockfile differs');
  } catch { failures.push('Required checkout, manifest, or lockfile unavailable'); }
  results.push({ consumer: name, passed: failures.length === 0, failures });
}
return { platformRevision: expected, passed: results.every(r => r.passed), consumers: results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({ options: { root: { type: 'string' } } });
  const report = checkNativeConsumers(path.resolve(values.root || path.dirname(defaultPlatform)));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.passed ? 0 : 1;
}
