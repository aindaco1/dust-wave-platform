export interface TimedTextPresentationWord {
  wordId: string;
  text: string;
  startsAtMs: number;
  endsAtMs: number;
  speakerId: string;
  sourceCueId: string;
  displayWidth: number;
  gapBeforeMs?: number;
  boundaryBefore?: boolean;
}

export interface TimedTextPresentationPolicy {
  minimumWordsPerCue: number;
  targetWordsPerCue: number;
  maximumWordsPerCue: number;
  maximumCueDurationMs: number;
  maximumGapMs: number;
  preferredPauseMs: number;
  maximumLines: number;
  maximumLineWidth: number;
  spaceWidth: number;
  maximumCandidateWords: number;
  fastReadingCharactersPerSecond: number;
  shortCueWarningMs: number;
}

export interface TimedTextPresentationCue {
  speakerId: string;
  sourceCueIds: string[];
  wordStartIndex: number;
  wordEndIndex: number;
  spokenStartsAtMs: number;
  spokenEndsAtMs: number;
  lineBreakBeforeWordIndexes: number[];
  lineWidths: number[];
  charactersPerSecond: number;
}

export interface TimedTextPresentationReport {
  wordCount: number;
  cueCount: number;
  maximumLines: number;
  maximumLineWidth: number;
  maximumCharactersPerSecond: number;
  fastCueCount: number;
  shortCueCount: number;
  overlongWordCount: number;
}

export interface TimedTextPresentationPlan {
  policyVersion: string;
  cues: TimedTextPresentationCue[];
  report: TimedTextPresentationReport;
}

export const TIMED_TEXT_PRESENTATION_POLICY_VERSION: string;
export const DEFAULT_TIMED_TEXT_PRESENTATION_POLICY: Readonly<TimedTextPresentationPolicy>;

export function planTimedTextPresentation(
  words: TimedTextPresentationWord[],
  options: { durationMs: number; policy: TimedTextPresentationPolicy }
): TimedTextPresentationPlan;
