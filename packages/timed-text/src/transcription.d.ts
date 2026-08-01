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
