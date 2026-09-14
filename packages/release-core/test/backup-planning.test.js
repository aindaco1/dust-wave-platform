import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { planSnapshotRetention, evidenceAgeCheck } from '../src/backup-planning.js';
import { readRetentionReceipt, inspectEncryptedSnapshot } from '../src/backup-receipts.js';
import { sha256File } from '../src/file-integrity.js';

test('retention preserves newest and release entries while selecting ISO week and month boundaries', () => {
  const record = (name, date, releaseSnapshot = false) => Object.freeze({ name, createdAt: new Date(date), archiveBytes: 10, releaseSnapshot });
  const snapshots = Object.freeze([
    record('release', '2020-01-01', true), record('latest', '2027-01-04'),
    record('same-day', '2027-01-04'), record('previous-week', '2027-01-03'), record('december', '2026-12-31')
  ]);
  const untouched = Object.freeze([{ name: 'z', reason: 'invalid' }, { name: 'a', reason: 'symlink' }]);
  const plan = planSnapshotRetention({ snapshots, untouched, retention: { daily: 1, weekly: 2, monthly: 2 }, now: new Date('2027-01-05'), rootName: 'snapshots' });
  assert.deepEqual(plan.keep.map(x => [x.name, x.reasons]), [
    ['latest', ['daily', 'monthly', 'newest', 'weekly']], ['previous-week', ['weekly']], ['december', ['monthly']], ['release', ['release']]
  ]);
  assert.deepEqual(plan.prune.map(x => x.name), ['same-day']);
  assert.equal(plan.bytesEligibleForPrune, 10); assert.equal(plan.executeByDefault, false);
  assert.equal(plan.plannedAt, '2027-01-05T00:00:00.000Z');
  assert.deepEqual(untouched.map(x => x.name), ['z', 'a']);
  assert.equal(planSnapshotRetention({ snapshots, retention: { releaseSnapshots: false } }).keep.length, 1);
  assert.deepEqual(planSnapshotRetention().prune, []);
});

test('evidence age uses the first present timestamp, inclusive boundary, and explicit required policy', () => {
  const options = { id: 'receipt', label: 'snapshot', timestampFields: ['completedAt', 'createdAt'], maxAgeHours: 24, required: false, now: new Date('2026-09-14T12:00:00Z') };
  for (const [evidence, required, status, ageHours] of [
    [null, false, 'WARN', null], [null, true, 'FAIL', null],
    [{ completedAt: 'bad', createdAt: '2026-09-14' }, false, 'FAIL', null],
    [{ createdAt: '2026-09-13T12:00:00Z' }, true, 'PASS', 24],
    [{ createdAt: '2026-09-13T11:00:00Z' }, true, 'FAIL', 25],
    [{ createdAt: '2026-09-13T11:00:00Z' }, false, 'WARN', 25],
    [{ createdAt: '2026-09-15' }, true, 'PASS', 0],
  ]) {
    const result = evidenceAgeCheck({ ...options, evidence, required });
    assert.equal(result.status, status); assert.equal(result.ageHours, ageHours);
  }
});

test('read-only receipt profiles preserve their distinct date and filename requirements', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'release-receipts-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const archive = 'backup.tar.gz.age', file = path.join(root, archive), manifest = path.join(root, 'manifest.json');
  fs.writeFileSync(file, 'synthetic-encrypted-fixture');
  const receipt = { encrypted: true, archive, archiveSha256: sha256File(file), outputName: 'synthetic', completedAt: '2026-09-14' };
  fs.writeFileSync(manifest, JSON.stringify(receipt));
  assert.equal(readRetentionReceipt(root).ok, true); assert.equal(inspectEncryptedSnapshot(root).archiveBytes, 27);
  delete receipt.completedAt; fs.writeFileSync(manifest, JSON.stringify(receipt));
  assert.deepEqual(readRetentionReceipt(root), { ok: false, reason: 'invalid_created_at' });
  assert.equal(inspectEncryptedSnapshot(root).outputName, 'synthetic');
  receipt.completedAt = '2026-09-14'; receipt.archive = '../escape.age'; fs.writeFileSync(manifest, JSON.stringify(receipt));
  assert.equal(readRetentionReceipt(root).reason, 'unsafe_archive_name');
  assert.throws(() => inspectEncryptedSnapshot(root), /archive path is invalid/);
  receipt.archive = archive; fs.writeFileSync(manifest, JSON.stringify(receipt)); fs.appendFileSync(file, 'tamper');
  assert.equal(readRetentionReceipt(root).reason, 'archive_checksum_mismatch'); assert.throws(() => inspectEncryptedSnapshot(root), /checksum/);
  fs.unlinkSync(file); fs.symlinkSync(manifest, file);
  assert.equal(readRetentionReceipt(root).reason, 'symbolic_link_archive'); assert.throws(() => inspectEncryptedSnapshot(root), /archive is missing/);
});
