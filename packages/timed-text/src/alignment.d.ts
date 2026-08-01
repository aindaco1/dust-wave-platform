export type AlignmentLanguage = "en" | "es";
export type AlignmentTimingOrigin =
  | "forced_alignment"
  | "model"
  | "editor"
  | "interpolated";

export interface AlignmentTranscriptProjection {
  language: AlignmentLanguage;
  contentSha256: string;
  projectionSha256: string;
  wordCount: number;
  cues: Array<{
    cueId: string;
    startsAtMs: number;
    endsAtMs: number;
    words: Array<{
      wordId: string;
      text: string;
    }>;
  }>;
}

export interface AlignmentRunnerAdapterIdentity {
  name: "stable-ts" | "whisperx" | "fixture";
  version: string;
  model: string;
  modelVersion: string;
  settingsVersion: string;
  runnerDigest: `sha256:${string}`;
}

export interface AlignmentCandidateWord {
  wordId: string;
  cueId: string;
  text: string;
  startsAtMs: number | null;
  endsAtMs: number | null;
  confidence: number | null;
  timingOrigin: AlignmentTimingOrigin | null;
  unalignedReason: string | null;
}

export const ALIGNMENT_RUNNER_SCHEMA: "2";
export const ALIGNMENT_PROCESSOR_SCHEMA: "alignment-processor-v1";
export const ALIGNMENT_PROCESSOR_VERSION:
  "dustwave-alignment-workflow-v1";
export const MAXIMUM_ALIGNMENT_RESULT_BYTES: 16777216;
export const ALIGNMENT_MINIMUM_ALIGNED_WORD_RATIO: 0.98;

export function buildAlignmentTranscriptProjection(input: {
  transcriptId: string;
  contentSha256: string;
  language: AlignmentLanguage;
  cues: Array<{
    id: string;
    startsAtMs: number;
    endsAtMs: number;
    textMarkdown: unknown;
  }>;
}): Promise<AlignmentTranscriptProjection>;

export function validateAlignmentRunnerResult(
  value: unknown,
  options: {
    jobId: string;
    alignmentRevisionId: string;
    sourceAudioSha256: string;
    sourceDurationMs: number;
    projection: AlignmentTranscriptProjection;
    adapter: AlignmentRunnerAdapterIdentity;
  }
): Promise<{
  manifest: {
    schemaVersion: "2";
    jobId: string;
    alignmentRevisionId: string;
    language: AlignmentLanguage;
    sourceAudioSha256: string;
    transcriptContentSha256: string;
    transcriptProjectionSha256: string;
    adapter: AlignmentRunnerAdapterIdentity;
    candidateWords: AlignmentCandidateWord[];
    projectionIssues: Array<Record<string, string | null>>;
    resource: {
      inputDurationMinutes: number;
      wallClockMinutes: number;
      peakMemoryMb: number;
      runner: string;
    };
  };
  manifestSha256: string;
  quality: {
    schemaVersion: "alignment-result-quality-v1";
    wordCount: number;
    alignedWordCount: number;
    unalignedWordCount: number;
    interpolatedWordCount: number;
    invalidWordCount: number;
    projectionIssueCount: number;
    alignedWordRatio: number;
    structurallyEligible: boolean;
  };
}>;

export interface AlignmentProcessorManifest {
  schemaVersion: "alignment-processor-v1";
  processorVersion: "dustwave-alignment-workflow-v1";
  jobId: string;
  alignmentRevisionId: string;
  episodeId: string;
  showId: string;
  transcriptId: string;
  workingMasterId: string;
  language: AlignmentLanguage;
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
  transcript: AlignmentTranscriptProjection;
  adapter: AlignmentRunnerAdapterIdentity;
  runner: {
    repository: "aindaco1/dust-wave-alignment-runner";
    revision: string;
  };
  output: {
    maximumResultBytes: 16777216;
  };
  sourceUrl: string;
  callbackUrl: string;
  manifestSha256: string;
}

export function buildAlignmentProcessorManifest(
  value: Omit<AlignmentProcessorManifest, "manifestSha256">
): Promise<AlignmentProcessorManifest>;

export function validateAlignmentProcessorManifest(
  value: unknown,
  options?: {
    expectedHost?: string;
    expectedRunnerRevision?: string;
  }
): Promise<AlignmentProcessorManifest>;

export function canonicalAlignmentJson(value: unknown): string;
export function canonicalAlignmentSha256(value: unknown): Promise<string>;
export function normalizeAlignmentLexicalWord(value: unknown): string;

export interface TimedTextReferenceAuditCue {
  startsAtMs: number;
  endsAtMs: number;
  text?: unknown;
  textMarkdown?: unknown;
}

export interface TimedTextReferenceAudit {
  schemaVersion: "timed-text-reference-audit-v1";
  windowMs: number;
  minimumSimilarity: number;
  maximumLowSimilarityWindowRatio: number;
  primaryWordCount: number;
  referenceWordCount: number;
  windowCount: number;
  comparedWindowCount: number;
  lowSimilarityWindowCount: number;
  lowSimilarityWindowRatio: number;
  missingReferenceWindowCount: number;
  weightedSimilarity: number;
  passing: boolean;
  reportedWindows: Array<{
    startsAtMs: number;
    endsAtMs: number;
    primaryWordCount: number;
    referenceWordCount: number;
    similarity: number;
    firstCueNumber: number | null;
    lastCueNumber: number | null;
  }>;
}

export function auditTimedTextReference(input: {
  cues: TimedTextReferenceAuditCue[];
  referenceCues: TimedTextReferenceAuditCue[];
  windowMs?: number;
  minimumSimilarity?: number;
  maximumLowSimilarityWindowRatio?: number;
  maximumReportedWindows?: number;
}): TimedTextReferenceAudit;
