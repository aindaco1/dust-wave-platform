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

export function canonicalAlignmentJson(value: unknown): string;
export function canonicalAlignmentSha256(value: unknown): Promise<string>;
export function normalizeAlignmentLexicalWord(value: unknown): string;
