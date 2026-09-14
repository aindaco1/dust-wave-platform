import fs from 'node:fs';
import path from 'node:path';
import { sha256File } from './file-integrity.js';

export function readRetentionReceipt(directory) {
  const manifestPath = path.join(directory, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return { ok: false, reason: 'missing_manifest' };
  if (fs.lstatSync(manifestPath).isSymbolicLink()) return { ok: false, reason: 'symbolic_link_manifest' };
  let receipt;
  try {
    receipt = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch {
    return { ok: false, reason: 'invalid_manifest' };
  }
  if (receipt.encrypted !== true || !String(receipt.archive || '').trim()) {
    return { ok: false, reason: 'not_encrypted_receipt' };
  }
  const createdAt = new Date(String(receipt.completedAt || receipt.createdAt || ''));
  if (!Number.isFinite(createdAt.getTime())) return { ok: false, reason: 'invalid_created_at' };
  const archiveName = String(receipt.archive).trim();
  if (path.basename(archiveName) !== archiveName) return { ok: false, reason: 'unsafe_archive_name' };
  const archivePath = path.join(directory, archiveName);
  if (!fs.existsSync(archivePath)) return { ok: false, reason: 'missing_archive' };
  const archiveStat = fs.lstatSync(archivePath);
  if (archiveStat.isSymbolicLink()) return { ok: false, reason: 'symbolic_link_archive' };
  if (!archiveStat.isFile()) return { ok: false, reason: 'missing_archive' };
  const expectedSha256 = String(receipt.archiveSha256 || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedSha256) || sha256File(archivePath) !== expectedSha256) {
    return { ok: false, reason: 'archive_checksum_mismatch' };
  }
  return { ok: true, receipt, createdAt };
}

export function requireBackupDirectory(value, label) {
  const resolved = path.resolve(String(value || ''));
  if (!value || !fs.existsSync(resolved)) throw new Error(`${label} must be an existing directory.`);
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real, non-symlinked directory.`);
  return fs.realpathSync(resolved);
}

function safeSnapshotName(value) {
  const name = String(value || '').trim();
  if (!name || name !== path.basename(name) || !/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error('Encrypted receipt outputName is not a safe directory name.');
  }
  return name;
}

export function inspectEncryptedSnapshot(snapshot) {
  const source = requireBackupDirectory(snapshot, 'Snapshot');
  const manifestPath = path.join(source, 'manifest.json');
  if (!fs.existsSync(manifestPath) || !fs.lstatSync(manifestPath).isFile()) {
    throw new Error('Snapshot manifest.json is missing.');
  }
  const receipt = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (receipt.encrypted !== true || !String(receipt.archive || '').trim()) {
    throw new Error('Snapshot is not an encrypted backup receipt.');
  }
  const archiveName = path.basename(String(receipt.archive));
  if (archiveName !== receipt.archive || !/\.tar\.gz\.(?:age|gpg)$/.test(archiveName)) {
    throw new Error('Encrypted receipt archive path is invalid.');
  }
  const archivePath = path.join(source, archiveName);
  if (!fs.existsSync(archivePath) || !fs.lstatSync(archivePath).isFile()) {
    throw new Error('Encrypted archive is missing.');
  }
  const archiveSha256 = sha256File(archivePath);
  if (archiveSha256 !== String(receipt.archiveSha256 || '').trim().toLowerCase()) {
    throw new Error('Encrypted archive checksum does not match its receipt.');
  }
  return {
    source,
    receipt,
    manifestPath,
    archivePath,
    archiveName,
    archiveSha256,
    archiveBytes: fs.statSync(archivePath).size,
    outputName: safeSnapshotName(receipt.outputName)
  };
}

