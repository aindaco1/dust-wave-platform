import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('workspace and package manifests match their lockfile entries', () => {
  const root = process.cwd();
  const workspace = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  assert.equal(lock.version, workspace.version);
  assert.equal(lock.packages[''].version, workspace.version);

  const packageDirectories = fs.readdirSync(path.join(root, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const directory of packageDirectories) {
    const manifestPath = path.join(root, 'packages', directory, 'package.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const locked = lock.packages[`packages/${directory}`];
    assert.ok(locked, `missing lockfile workspace entry for ${directory}`);
    assert.equal(locked.name, manifest.name, `${directory} package name`);
    assert.equal(locked.version, manifest.version, `${directory} package version`);
  }
});
