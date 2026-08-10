export type TimedTextLanguage = "en" | "es";

export interface TimedTextCue {
  id: string;
  startsAtMs: number;
  endsAtMs: number;
  speakerLabel: "";
  speakerConfirmed: false;
  textMarkdown: string;
}

export interface NormalizedSegmentTranscription {
  schemaVersion: "timed-text-v1";
  language: TimedTextLanguage;
  timingPrecision: "segment";
  cues: TimedTextCue[];
  plainText: string;
  webVtt: string;
  srt: string;
}

export const TIMED_TEXT_SCHEMA: "timed-text-v1";
export interface CaptionSegmentationPolicy {
  minimumCueDurationMs: number;
  maximumCueDurationMs: number;
  maximumCharactersPerSecond: number;
  maximumCharactersPerCue: number;
  maximumMergeGapMs: number;
  maximumPaddingMs: number;
}

export const DEFAULT_CAPTION_SEGMENTATION_POLICY:
  Readonly<CaptionSegmentationPolicy>;

export const ENGLISH_EDITORIAL_NORMALIZATION_POLICY:
  "english-editorial-normalization-v1";

export interface EnglishEditorialWord {
  text: string;
  sourceStartIndex: number;
  sourceEndIndex: number;
}

export function normalizeEnglishEditorialWords(
  value: string[]
): EnglishEditorialWord[];

export interface TimedWordGroupingPolicy {
  minimumWordsPerCue: number;
  targetWordsPerCue: number;
  maximumWordsPerCue: number;
  targetCharactersPerCue: number;
  maximumCharactersPerCue: number;
  maximumCueDurationMs: number;
  maximumGapMs: number;
  preferredPauseMs: number;
  maximumCandidateWords: number;
}

export interface TimedWordInput {
  text: string;
  startsAtMs: number;
  endsAtMs: number;
  boundaryBefore?: boolean;
}

export interface GroupedTimedWordCue {
  startsAtMs: number;
  endsAtMs: number;
  textMarkdown: string;
}

export const DEFAULT_TIMED_WORD_GROUPING_POLICY:
  Readonly<TimedWordGroupingPolicy>;

export function groupTimedWords(
  value: TimedWordInput[],
  options: {
    durationMs: number;
    policy: TimedWordGroupingPolicy;
  }
): GroupedTimedWordCue[];

export function normalizeTimedTextCues(
  value: Array<{
    startsAtMs: number;
    endsAtMs: number;
    textMarkdown: unknown;
  }>,
  options: {
    language: TimedTextLanguage;
    durationMs: number;
    captionPolicy?: CaptionSegmentationPolicy;
  }
): NormalizedSegmentTranscription;

export function normalizeSegmentTranscription(
  value: unknown,
  options: {
    language: TimedTextLanguage;
    durationMs: number;
    captionPolicy?: CaptionSegmentationPolicy;
  }
): NormalizedSegmentTranscription;
