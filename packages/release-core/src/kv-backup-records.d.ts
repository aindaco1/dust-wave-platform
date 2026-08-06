export interface KvPutRecord {
  key: string;
  value: string;
  metadata?: unknown;
}

export function transformKvBackupValuesToPutRecords(values?: unknown): KvPutRecord[];
