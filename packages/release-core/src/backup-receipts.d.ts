export interface BackupReceipt extends Record<string, unknown> {
  encrypted: true; archive: string; archiveSha256: string;
  createdAt?: string; completedAt?: string; archiveBytes?: number;
  outputName?: string; encryptionBackend?: string; releaseSnapshot?: boolean;
}
/** Read-only Node API. The caller owns snapshot discovery and root validation. */
export function readRetentionReceipt(directory: string):
  | { ok: true; receipt: BackupReceipt; createdAt: Date }
  | { ok: false; reason: string };
export function requireBackupDirectory(value: string, label: string): string;
export function inspectEncryptedSnapshot(snapshot: string): {
  source: string; receipt: BackupReceipt; manifestPath: string;
  archivePath: string; archiveName: string; archiveSha256: string;
  archiveBytes: number; outputName: string;
};
