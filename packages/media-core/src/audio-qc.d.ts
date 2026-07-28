export type AudioQcFindingSeverity = "warning" | "blocker";
export type AudioQcSilenceKind =
  | "leading"
  | "internal"
  | "trailing"
  | "entire";

export interface AudioQcPolicy {
  schemaVersion: "audio-qc-policy-v1";
  revision: number;
  monoIntegratedLufs: number;
  stereoIntegratedLufs: number;
  integratedLufsTolerance: number;
  maximumTruePeakDbtp: number;
  maximumDcOffset: number;
  maximumChannelImbalanceLu: number;
  maximumLeadingSilenceMs: number;
  maximumTrailingSilenceMs: number;
  maximumInternalSilenceMs: number;
  silenceThresholdDb: number;
}

export interface AudioQcManifest {
  schemaVersion: "audio-qc-job-v1";
  runId: string;
  episodeId: string;
  showId: string;
  source: {
    bucketName: string;
    objectKey: string;
    objectBytes: number;
    etag: string;
    mimeType: string;
  };
  policy: AudioQcPolicy;
  callbackUrl: string;
  manifestSha256: string;
}

export interface AudioQcSilenceRegion {
  kind: AudioQcSilenceKind;
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface AudioQcMeasurements {
  durationMs: number;
  codec: string;
  container: string;
  sampleRateHz: number;
  bitDepth: number | null;
  channels: number;
  channelLayout: string;
  averageBitrateBps: number;
  integratedLufs: number;
  loudnessRangeLu: number;
  truePeakDbtp: number;
  samplePeakDbfs: number;
  clippedSamples: number;
  dcOffset: number;
  channelImbalanceLu: number | null;
  silence: {
    leadingMs: number;
    trailingMs: number;
    longestInternalMs: number | null;
    regions: AudioQcSilenceRegion[];
  };
}

export interface AudioQcFinding {
  code: string;
  severity: AudioQcFindingSeverity;
  startMs: number | null;
  endMs: number | null;
  measured: number;
  limit: number;
  unit: string;
  remediation: string;
}

export interface AudioQcQuality {
  targetIntegratedLufs: number;
  blockerCount: number;
  warningCount: number;
  passed: boolean;
  findings: AudioQcFinding[];
}

export interface AudioQcReport {
  schemaVersion: "audio-qc-report-v1";
  runId: string;
  manifestSha256: string;
  processorVersion: string;
  sourceSha256: string;
  measurements: AudioQcMeasurements;
  quality: AudioQcQuality;
  resource: {
    wallMs: number;
    maximumRssBytes: number;
    ffmpegVersion: string;
    ffprobeVersion: string;
  };
}

export const AUDIO_QC_POLICY_SCHEMA: "audio-qc-policy-v1";
export const AUDIO_QC_MANIFEST_SCHEMA: "audio-qc-job-v1";
export const AUDIO_QC_REPORT_SCHEMA: "audio-qc-report-v1";
export const DEFAULT_AUDIO_QC_POLICY: Readonly<AudioQcPolicy>;

export function validateAudioQcPolicy(value: unknown): AudioQcPolicy;
export function buildAudioQcManifest(
  body: Omit<AudioQcManifest, "manifestSha256">
): Promise<AudioQcManifest>;
export function validateAudioQcManifest(
  value: unknown,
  options?: { expectedHost?: string; expectedBucket?: string }
): Promise<AudioQcManifest>;
export function evaluateAudioQcMeasurements(
  measurements: unknown,
  policy: unknown
): AudioQcQuality;
export function validateAudioQcReport(
  value: unknown,
  manifest: AudioQcManifest
): Promise<AudioQcReport>;
export function audioQcReportSha256(
  report: unknown,
  manifest: AudioQcManifest
): Promise<string>;
