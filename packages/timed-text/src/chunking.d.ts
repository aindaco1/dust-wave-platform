import type {
  NormalizedSegmentTranscription,
  TimedTextLanguage
} from "./transcription.js";

export interface TranscriptionChunkPolicy {
  targetChunkDurationMs: number;
  maximumChunkDurationMs: number;
  minimumChunkDurationMs: number;
  overlapMs: number;
  silenceThresholdDb: number;
  minimumSilenceDurationMs: number;
  outputMimeType: "audio/mpeg";
  outputCodec: "libmp3lame";
  outputSampleRateHz: 16000;
  outputChannels: 1;
  outputBitrateKbps: 64;
}

export interface SilenceWindow {
  startsAtMs: number;
  endsAtMs: number;
}

export interface TranscriptionChunk {
  index: number;
  coreStartsAtMs: number;
  coreEndsAtMs: number;
  mediaStartsAtMs: number;
  mediaEndsAtMs: number;
  boundaryKind: "silence" | "duration" | "end";
}

export interface TranscriptionChunkPlan {
  schemaVersion: "transcription-chunk-plan-v1";
  sourceDurationMs: number;
  policy: TranscriptionChunkPolicy;
  silenceWindows: SilenceWindow[];
  chunks: TranscriptionChunk[];
}

export const TRANSCRIPTION_CHUNK_PLAN_SCHEMA:
  "transcription-chunk-plan-v1";
export const TRANSCRIPTION_CHUNK_PROCESSOR_SCHEMA:
  "transcription-chunk-processor-v1";
export const TRANSCRIPTION_CHUNK_PROCESSOR_VERSION:
  "ffmpeg-transcription-chunker-v1";
export const MAXIMUM_TRANSCRIPTION_CHUNK_BYTES: 16777216;
export const DEFAULT_TRANSCRIPTION_CHUNK_POLICY:
  Readonly<TranscriptionChunkPolicy>;

export interface TranscriptionChunkProcessorManifest {
  schemaVersion: "transcription-chunk-processor-v1";
  processorVersion: "ffmpeg-transcription-chunker-v1";
  runId: string;
  jobId: string;
  episodeId: string;
  showId: string;
  workingMasterId: string;
  language: TimedTextLanguage;
  source: {
    objectKey: string;
    objectBytes: number;
    etag: string;
    mimeType:
      | "audio/mpeg"
      | "audio/mp4"
      | "audio/wav"
      | "audio/x-wav"
      | "audio/flac"
      | "audio/x-flac";
    sha256: string;
    durationMs: number;
  };
  policy: TranscriptionChunkPolicy;
  output: {
    keyPrefix: string;
    mimeType: "audio/mpeg";
    maximumObjectBytes: 16777216;
    uploadUrlTemplate: string;
  };
  sourceUrl: string;
  callbackUrl: string;
  manifestSha256: string;
}

export function planTranscriptionChunks(input: {
  sourceDurationMs: number;
  silenceWindows?: SilenceWindow[];
  policy?: TranscriptionChunkPolicy;
}): TranscriptionChunkPlan;

export function validateTranscriptionChunkPlan(
  value: unknown,
  options?: {
    sourceDurationMs?: number;
    policy?: TranscriptionChunkPolicy;
  }
): TranscriptionChunkPlan;

export function mergeChunkTranscriptions(
  value: Array<{
    plan: {
      silenceWindows: SilenceWindow[];
      chunk: TranscriptionChunk;
    };
    mediaDurationMs?: number;
    response: unknown;
  }>,
  options: {
    language: TimedTextLanguage;
    sourceDurationMs: number;
    policy?: TranscriptionChunkPolicy;
  }
): {
  transcription: NormalizedSegmentTranscription;
  evidence: {
    schemaVersion: "transcription-chunk-merge-evidence-v1";
    chunkCount: number;
    cueCount: number;
    deduplicatedTokenCount: number;
    droppedCueCount: number;
  };
};

export function buildTranscriptionChunkProcessorManifest(
  value: Omit<TranscriptionChunkProcessorManifest, "manifestSha256">
): Promise<TranscriptionChunkProcessorManifest>;

export function validateTranscriptionChunkProcessorManifest(
  value: unknown,
  options?: {
    expectedHost?: string;
    expectedOutputKeyPrefix?: string;
  }
): Promise<TranscriptionChunkProcessorManifest>;
