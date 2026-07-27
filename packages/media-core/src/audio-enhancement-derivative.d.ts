import type {
  AudioEnhancementPresetId
} from "./audio-enhancement.js";

export interface AudioEnhancementDerivativeRecipe {
  schemaVersion: "audio-enhancement-derivative-recipe-v1";
  presetId: AudioEnhancementPresetId;
  targetIntegratedLufs: number;
  maximumTruePeakDbtp: number;
}

export interface AudioEnhancementDerivativeManifest {
  schemaVersion: "audio-enhancement-derivative-job-v1";
  jobId: string;
  selectedPreviewId: string;
  episodeId: string;
  showId: string;
  source: {
    workingMasterId: string;
    bucketName: string;
    objectKey: string;
    objectBytes: number;
    etag: string;
    mimeType: string;
    sha256: string;
    durationMs: number;
  };
  qualityControl: {
    runId: string;
    reportSha256: string;
    blockerCount: 0;
  };
  selection: {
    previewManifestSha256: string;
    previewReportSha256: string;
    previewEnhancedSha256: string;
  };
  recipe: AudioEnhancementDerivativeRecipe;
  output: {
    objectKey: string;
    mimeType: "audio/mpeg";
    recommendedPartBytes: 33554432;
  };
  endpoints: {
    source: string;
    partTemplate: string;
    uploadComplete: string;
    evidenceComplete: string;
  };
  manifestSha256: string;
}

export interface AudioEnhancementDerivativeOutput {
  objectKey: string;
  objectBytes: number;
  sha256: string;
  mimeType: "audio/mpeg";
  durationMs: number;
  audioCodec: "mp3";
  sampleRateHz: 48000;
  fullyDecoded: true;
}

export interface AudioEnhancementDerivativeReport {
  schemaVersion: "audio-enhancement-derivative-report-v1";
  jobId: string;
  manifestSha256: string;
  processorVersion: string;
  sourceSha256: string;
  output: AudioEnhancementDerivativeOutput;
  resource: {
    wallMs: number;
    maximumRssBytes: number;
    ffmpegVersion: string;
    ffprobeVersion: string;
  };
}

export const AUDIO_ENHANCEMENT_DERIVATIVE_RECIPE_SCHEMA:
  "audio-enhancement-derivative-recipe-v1";
export const AUDIO_ENHANCEMENT_DERIVATIVE_MANIFEST_SCHEMA:
  "audio-enhancement-derivative-job-v1";
export const AUDIO_ENHANCEMENT_DERIVATIVE_REPORT_SCHEMA:
  "audio-enhancement-derivative-report-v1";

export function validateAudioEnhancementDerivativeRecipe(
  value: unknown
): AudioEnhancementDerivativeRecipe;
export function buildAudioEnhancementDerivativeManifest(
  body: Omit<AudioEnhancementDerivativeManifest, "manifestSha256">
): Promise<AudioEnhancementDerivativeManifest>;
export function validateAudioEnhancementDerivativeManifest(
  value: unknown,
  options?: { expectedHost?: string; expectedBucket?: string }
): Promise<AudioEnhancementDerivativeManifest>;
export function validateAudioEnhancementDerivativeReport(
  value: unknown,
  manifest: AudioEnhancementDerivativeManifest
): Promise<AudioEnhancementDerivativeReport>;
export function audioEnhancementDerivativeReportSha256(
  report: unknown,
  manifest: AudioEnhancementDerivativeManifest
): Promise<string>;
