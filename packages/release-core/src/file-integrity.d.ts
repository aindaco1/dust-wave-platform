export interface ChecksumManifestEntry {
  path: string;
  bytes: number;
  sha256: string;
  mode: string;
}

export interface ChecksumFailure {
  path: unknown;
  reason: 'duplicate' | 'path_escape' | 'missing' | 'unsupported_type' | 'checksum_mismatch' | 'unlisted';
  actual?: string;
}

export function sha256File(filePath: string): string;
export function listFilesRecursive(root: string, options?: { exclude?: string[] | Set<string> }): string[];
export function buildChecksumManifest(root: string, options?: { exclude?: string[] | Set<string> }): ChecksumManifestEntry[];
export function verifyChecksumManifest(
  root: string,
  entries?: Array<Partial<ChecksumManifestEntry>>,
  options?: { exclude?: string[] | Set<string>; requireComplete?: boolean }
): { ok: boolean; checked: number; failures: ChecksumFailure[] };
export function enforcePrivatePermissions(root: string): void;
