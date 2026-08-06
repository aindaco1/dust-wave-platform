import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildChecksumManifest,
  enforcePrivatePermissions,
  verifyChecksumManifest
} from '../src/file-integrity.js';

function fixtureDirectory() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-core-integrity-'));
  fs.mkdirSync(path.join(root, 'nested'));
  fs.writeFileSync(path.join(root, 'manifest.json'), '{"ok":true}\n');
  fs.writeFileSync(path.join(root, 'nested', 'artifact.txt'), 'artifact\n');
  return root;
}

test('builds and verifies a complete deterministic checksum manifest', (context) => {
  const root = fixtureDirectory();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifest = buildChecksumManifest(root);
  assert.deepEqual(manifest.map((entry) => entry.path), ['manifest.json', 'nested/artifact.txt']);
  assert.deepEqual(
    verifyChecksumManifest(root, manifest, { requireComplete: true }),
    { ok: true, checked: 2, failures: [] }
  );
});

test('fails changed, missing, duplicate, escaping, and unlisted artifacts closed', (context) => {
  const root = fixtureDirectory();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const manifest = buildChecksumManifest(root);
  fs.appendFileSync(path.join(root, 'manifest.json'), 'changed');
  fs.rmSync(path.join(root, 'nested', 'artifact.txt'));
  fs.writeFileSync(path.join(root, 'unlisted.txt'), 'unlisted');
  const result = verifyChecksumManifest(root, [
    ...manifest,
    manifest[0],
    { path: '../escape', sha256: 'fixture' }
  ], { requireComplete: true });
  assert.equal(result.ok, false);
  assert.deepEqual(new Set(result.failures.map(({ reason }) => reason)), new Set([
    'checksum_mismatch',
    'missing',
    'duplicate',
    'path_escape',
    'unlisted'
  ]));
});

test('rejects symlinks from complete manifests and applies private permissions', (context) => {
  const root = fixtureDirectory();
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.symlinkSync(path.join(root, 'manifest.json'), path.join(root, 'linked-manifest'));
  const manifest = buildChecksumManifest(root);
  const result = verifyChecksumManifest(root, manifest, { requireComplete: true });
  assert.equal(result.ok, false);
  assert.deepEqual(result.failures, [{ path: 'linked-manifest', reason: 'unsupported_type' }]);

  enforcePrivatePermissions(root);
  assert.equal(fs.statSync(root).mode & 0o777, 0o700);
  assert.equal(fs.statSync(path.join(root, 'manifest.json')).mode & 0o777, 0o600);
});
