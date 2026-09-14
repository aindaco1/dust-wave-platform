export interface RetentionPolicy {
  daily?: number; weekly?: number; monthly?: number; releaseSnapshots?: boolean;
}
/** Consumer-verified records with unique names, valid dates and archive sizes. */
export interface VerifiedSnapshot {
  name: string; createdAt: Date; archiveBytes: number; releaseSnapshot?: boolean;
}
export interface UntouchedSnapshot { name: string; reason: string }
export interface PlannedSnapshot { name: string; createdAt: string; archiveBytes: number }
export interface RetentionPlan {
  schemaVersion: 1; plannedAt: string; rootName: string;
  retention: Required<RetentionPolicy>;
  keep: Array<PlannedSnapshot & { reasons: string[] }>;
  prune: PlannedSnapshot[]; untouched: UntouchedSnapshot[];
  bytesEligibleForPrune: number; containsCustomerData: false; executeByDefault: false;
}
export function planSnapshotRetention(options?: {
  snapshots?: readonly VerifiedSnapshot[]; retention?: RetentionPolicy;
  untouched?: readonly UntouchedSnapshot[]; rootName?: string; now?: Date;
}): RetentionPlan;
export function evidenceAgeCheck(options: {
  id: string; label: string; evidence?: Record<string, unknown> | null;
  timestampFields: readonly string[]; maxAgeHours: number; required: boolean; now?: Date;
}): { id: string; status: 'PASS' | 'WARN' | 'FAIL'; detail: string; ageHours: number | null; maxAgeHours: number };
