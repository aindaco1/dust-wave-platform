export interface RetentionPolicy {
  daily?: number; weekly?: number; monthly?: number; releaseSnapshots?: boolean;
}
/** Consumer-verified records with unique names, valid dates and verified archive sizes and hashes. */
export interface VerifiedSnapshot {
  name: string; createdAt: Date; archiveBytes: number; archiveSha256: string; releaseSnapshot?: boolean;
}
export interface UntouchedSnapshot { name: string; reason: string }
export interface PlannedSnapshot { name: string; createdAt: string; archiveBytes: number; archiveSha256: string }
export interface RetentionPlan {
  schemaVersion: 2; rootId: string; plannedAt: string; rootName: string;
  retention: Required<RetentionPolicy>;
  keep: Array<PlannedSnapshot & { reasons: string[] }>;
  prune: PlannedSnapshot[]; untouched: UntouchedSnapshot[];
  bytesEligibleForPrune: number; containsCustomerData: false; executeByDefault: false;
}
export function planSnapshotRetention(options: {
  rootId: string;
  snapshots?: readonly VerifiedSnapshot[]; retention?: RetentionPolicy;
  untouched?: readonly UntouchedSnapshot[]; rootName?: string; now?: Date;
}): RetentionPlan;
export function validatedPruneTargets(plan: unknown, current: RetentionPlan): PlannedSnapshot[];
export function evidenceAgeCheck(options: {
  id: string; label: string; evidence?: Record<string, unknown> | null;
  timestampFields: readonly string[]; maxAgeHours: number; required: boolean; now?: Date;
}): { id: string; status: 'PASS' | 'WARN' | 'FAIL'; detail: string; ageHours: number | null; maxAgeHours: number };
