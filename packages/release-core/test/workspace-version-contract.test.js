import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const packageDirectories = fs.readdirSync(path.join(root, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

test('workspace and package manifests match their lockfile entries', () => {
  const workspace = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  assert.equal(lock.version, workspace.version);
  assert.equal(lock.packages[''].version, workspace.version);

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

test('workspace version matches the top changelog release', () => {
  const workspace = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const topRelease = /^## (\d+\.\d+\.\d+) - \d{4}-\d{2}-\d{2}$/mu.exec(changelog);

  assert.ok(topRelease, 'missing versioned changelog release');
  assert.equal(topRelease[1], workspace.version);
});

test('README package versions match package manifests', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  const readmeVersions = new Map();

  for (const line of readme.split(/\r?\n/u)) {
    const row = /^\|\s*`(@dustwave\/[^`]+)`\s*\|.*\|\s*`(\d+\.\d+\.\d+)`(?:;[^|]*)?\|\s*$/u.exec(line);
    if (!row) continue;
    assert.ok(!readmeVersions.has(row[1]), `duplicate README package row for ${row[1]}`);
    readmeVersions.set(row[1], row[2]);
  }

  const manifestNames = new Set();
  for (const directory of packageDirectories) {
    const manifestPath = path.join(root, 'packages', directory, 'package.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifestNames.add(manifest.name);
    assert.equal(
      readmeVersions.get(manifest.name),
      manifest.version,
      `${manifest.name} README package version`
    );
  }

  assert.deepEqual(new Set(readmeVersions.keys()), manifestNames);
});
