import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { checkNativeConsumers } from './check-native-consumers.mjs';

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
test('a coordinated cohort rejects pin, lockfile, and modified-source drift', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-cohort-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const platform = path.join(root, 'dust-wave-platform');
  fs.mkdirSync(path.join(platform, 'native'), { recursive: true });
  fs.writeFileSync(path.join(platform, 'native/Package.swift'), '// synthetic shared source\n');
  fs.writeFileSync(path.join(platform, 'native/consumers.json'), JSON.stringify({
    app: { fluidAudio: '0.15.5', fluidAudioRevision: 'b'.repeat(40), speechPackage: '.', packages: ['.'] }
  }));
  git(platform, 'init'); git(platform, 'add', '.');
  git(platform, '-c', 'user.name=Synthetic Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Fixture');
  const revision = git(platform, 'rev-parse', 'HEAD');
  const app = path.join(root, 'app'); fs.mkdirSync(app); git(app, 'init');
  fs.mkdirSync(path.join(app, 'shared'));
  git(app, 'clone', platform, 'shared/dust-wave-platform');
  git(app, 'update-index', '--add', '--cacheinfo', `160000,${revision},shared/dust-wave-platform`);
  fs.writeFileSync(path.join(app, 'Package.swift'), '.package(path: "shared/dust-wave-platform/native"), .package(url: "https://github.com/FluidInference/FluidAudio.git", exact: "0.15.5")');
  const lock = (version, revision = 'b'.repeat(40)) => JSON.stringify({ pins: [{ identity: 'fluidaudio', state: { version, revision } }] });
  fs.writeFileSync(path.join(app, 'Package.resolved'), lock('0.15.5'));
  assert.equal(checkNativeConsumers(root, platform).passed, true);
  fs.writeFileSync(path.join(app, 'Package.resolved'), lock('0.15.7'));
  assert.match(checkNativeConsumers(root, platform).consumers[0].failures.join(), /lockfile/);
  fs.writeFileSync(path.join(app, 'Package.resolved'), lock('0.15.5', 'c'.repeat(40)));
  assert.match(checkNativeConsumers(root, platform).consumers[0].failures.join(), /lockfile/);
  fs.writeFileSync(path.join(app, 'Package.resolved'), lock('0.15.5'));
  fs.appendFileSync(path.join(app, 'shared/dust-wave-platform/native/Package.swift'), '// changed\n');
  assert.match(checkNativeConsumers(root, platform).consumers[0].failures.join(), /modified/);
  git(app, 'update-index', '--cacheinfo', `160000,${'a'.repeat(40)},shared/dust-wave-platform`);
  assert.match(checkNativeConsumers(root, platform).consumers[0].failures.join(), /mismatch/);
});
