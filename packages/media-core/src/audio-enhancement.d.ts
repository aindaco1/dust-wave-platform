export type AudioEnhancementPresetId =
  | "dialogue-gentle-v1"
  | "loudness-only-v1";

export interface AudioEnhancementRecipe {
  schemaVersion: "audio-enhancement-recipe-v1";
  presetId: AudioEnhancementPresetId;
  previewStartMs: number;
  previewDurationMs: number;
  targetIntegratedLufs: number;
  maximumTruePeakDbtp: number;
}

export interface AudioEnhancementManifest {
  schemaVersion: "audio-enhancement-job-v1";
  jobId: string;
  episodeId: string;
  showId: string;
  source: {
    bucketName: string;
    objectKey: string;
    objectBytes: number;
    etag: string;
    mimeType: string;
  };
  qualityControl: {
    runId: string;
    reportSha256: string;
    sourceSha256: string;
    durationMs: number;
    blockerCount: 0;
  };
  recipe: AudioEnhancementRecipe;
  outputs: {
    original: {
      objectKey: string;
      mimeType: "audio/mpeg";
    };
    enhanced: {
      objectKey: string;
      mimeType: "audio/mpeg";
    };
  };
  callbackUrl: string;
  manifestSha256: string;
}

export interface AudioEnhancementOutput {
  objectKey: string;
  objectBytes: number;
  sha256: string;
  mimeType: "audio/mpeg";
  durationMs: number;
}

export interface AudioEnhancementReport {
  schemaVersion: "audio-enhancement-report-v1";
  jobId: string;
  manifestSha256: string;
  processorVersion: string;
  sourceSha256: string;
  outputs: {
    original: AudioEnhancementOutput;
    enhanced: AudioEnhancementOutput;
  };
  resource: {
    wallMs: number;
    maximumRssBytes: number;
    ffmpegVersion: string;
    ffprobeVersion: string;
  };
}

export const AUDIO_ENHANCEMENT_RECIPE_SCHEMA:
  "audio-enhancement-recipe-v1";
export const AUDIO_ENHANCEMENT_MANIFEST_SCHEMA:
  "audio-enhancement-job-v1";
export const AUDIO_ENHANCEMENT_REPORT_SCHEMA:
  "audio-enhancement-report-v1";
export const AUDIO_ENHANCEMENT_PRESETS: Readonly<Record<
  AudioEnhancementPresetId,
  Readonly<{
    id: AudioEnhancementPresetId;
    label: string;
    description: string;
  }>
>>;

export function validateAudioEnhancementRecipe(
  value: unknown,
  options?: { sourceDurationMs?: number }
): AudioEnhancementRecipe;
export function buildAudioEnhancementManifest(
  body: Omit<AudioEnhancementManifest, "manifestSha256">
): Promise<AudioEnhancementManifest>;
export function validateAudioEnhancementManifest(
  value: unknown,
  options?: { expectedHost?: string; expectedBucket?: string }
): Promise<AudioEnhancementManifest>;
export function validateAudioEnhancementReport(
  value: unknown,
  manifest: AudioEnhancementManifest
): Promise<AudioEnhancementReport>;
export function audioEnhancementReportSha256(
  report: unknown,
  manifest: AudioEnhancementManifest
): Promise<string>;
