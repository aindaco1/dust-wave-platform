import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { planSnapshotRetention, validatedPruneTargets, evidenceAgeCheck } from '../src/backup-planning.js';
import { readRetentionReceipt, retentionRootId, inspectEncryptedSnapshot, assertCopiedArchiveDigest } from '../src/backup-receipts.js';
import { sha256File } from '../src/file-integrity.js';

const rootId = '1'.repeat(64);
const archiveSha256 = 'a'.repeat(64);

test('retention preserves newest and release entries while selecting ISO week and month boundaries', () => {
  const record = (name, date, releaseSnapshot = false) => Object.freeze({ name, createdAt: new Date(date), archiveBytes: 10, archiveSha256, releaseSnapshot });
  const snapshots = Object.freeze([
    record('release', '2020-01-01', true), record('latest', '2027-01-04'),
    record('same-day', '2027-01-04'), record('previous-week', '2027-01-03'), record('december', '2026-12-31')
  ]);
  const untouched = Object.freeze([{ name: 'z', reason: 'invalid' }, { name: 'a', reason: 'symlink' }]);
  const plan = planSnapshotRetention({ rootId, snapshots, untouched, retention: { daily: 1, weekly: 2, monthly: 2 }, now: new Date('2027-01-05'), rootName: 'snapshots' });
  assert.deepEqual(plan.keep.map(x => [x.name, x.reasons]), [
    ['latest', ['daily', 'monthly', 'newest', 'weekly']], ['previous-week', ['weekly']], ['december', ['monthly']], ['release', ['release']]
  ]);
  assert.deepEqual(plan.prune.map(x => x.name), ['same-day']);
  assert.equal(plan.bytesEligibleForPrune, 10); assert.equal(plan.executeByDefault, false);
  assert.equal(plan.plannedAt, '2027-01-05T00:00:00.000Z');
  assert.deepEqual(untouched.map(x => x.name), ['z', 'a']);
  assert.equal(planSnapshotRetention({ rootId, snapshots, retention: { releaseSnapshots: false } }).keep.length, 1);
  assert.deepEqual(planSnapshotRetention({ rootId }).prune, []);
});

test('batch validation binds the root, policy and archives and selects only still-eligible reviewed names', () => {
  const snapshot = (name, hour) => ({ name, createdAt: new Date(Date.UTC(2026, 0, 1, hour)), archiveSha256, archiveBytes: 4 });
  const snapshots = [snapshot('newest', 3), snapshot('first', 2), snapshot('second', 1)];
  const plan = planSnapshotRetention({ rootId, snapshots });
  const current = planSnapshotRetention({ rootId, snapshots: [...snapshots, snapshot('unlisted', 0)] });
  assert.deepEqual(validatedPruneTargets(JSON.parse(JSON.stringify(plan)), current), plan.prune);
  assert.throws(() => validatedPruneTargets({ ...plan, schemaVersion: 1 }, current), /version 2/);
  assert.throws(() => validatedPruneTargets({ ...plan, rootId: '2'.repeat(64) }, current), /root/);
  assert.throws(() => validatedPruneTargets({ ...plan, retention: {} }, current), /policy/);
  assert.throws(() => validatedPruneTargets({ ...plan, prune: [...plan.prune, plan.prune[0]] }, current), /Duplicate/);
  for (const row of [...plan.keep, ...plan.prune]) {
    for (const digest of [undefined, 'b'.repeat(64)]) {
      const changed = structuredClone(plan);
      [...changed.keep, ...changed.prune].find(entry => entry.name === row.name).archiveSha256 = digest;
      assert.throws(() => validatedPruneTargets(changed, current), /verification/);
    }
  }
  const protectedNow = planSnapshotRetention({ rootId, snapshots: [snapshots[0], snapshots[1], { ...snapshots[2], releaseSnapshot: true }] });
  assert.throws(() => validatedPruneTargets(plan, protectedNow), /no longer eligible/);
  assert.throws(() => planSnapshotRetention({ snapshots }), /root ID/);
  assert.throws(() => planSnapshotRetention({ rootId, snapshots: [{ ...snapshots[0], archiveSha256: '' }] }), /verified archive hash/);
});

test('root ID distinguishes same-name roots and a replacement directory at the original path', t => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'retention-root-'));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const a = path.join(scratch, 'a', 'backups'), b = path.join(scratch, 'b', 'backups');
  fs.mkdirSync(a, { recursive: true });
  fs.mkdirSync(b, { recursive: true });
  const id = retentionRootId(a);
  assert.match(id, /^[a-f0-9]{64}$/);
  assert.notEqual(id, retentionRootId(b));
  fs.mkdirSync(path.join(a, 'unlisted'));
  assert.equal(id, retentionRootId(a));
  fs.renameSync(a, path.join(scratch, 'original'));
  fs.mkdirSync(a);
  assert.notEqual(id, retentionRootId(a));
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
  const read = readRetentionReceipt(root);
  assert.equal(read.ok, true);
  assert.equal(read.archiveSha256, receipt.archiveSha256);
  assert.equal(read.archiveBytes, 27); assert.equal(inspectEncryptedSnapshot(root).archiveBytes, 27);
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

test('copied archives must match a valid planned SHA-256', () => {
  const planned = 'a'.repeat(64);
  assert.doesNotThrow(() => assertCopiedArchiveDigest(planned, planned));
  for (const digest of ['b'.repeat(64), undefined, null, '', 'a'.repeat(63), 'g'.repeat(64), planned.toUpperCase(), [planned]]) {
    assert.throws(() => assertCopiedArchiveDigest(planned, digest), /planned SHA-256/);
    assert.throws(() => assertCopiedArchiveDigest(digest, planned), /planned SHA-256/);
  }
  for (const digest of [undefined, null, '', 'invalid']) {
    assert.throws(() => assertCopiedArchiveDigest(digest, digest), /planned SHA-256/);
  }
});
