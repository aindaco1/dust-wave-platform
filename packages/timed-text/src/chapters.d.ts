export type ChapterMode = "topics" | "questions";

export interface ChapterContextPolicy {
  targetWindowDurationMs: number;
  maximumWindowDurationMs: number;
  maximumWindowCues: number;
  maximumWindowCharacters: number;
  minimumChapterDurationMs: number;
  maximumChapters: number;
  maximumTitleCharacters: number;
}

export interface ChapterSourceCue {
  cueId: string;
  sourceWordId: string;
  startsAtMs: number;
  endsAtMs: number;
  speakerId: string;
  text: string;
}

export interface ChapterContextRecord {
  anchorId: string;
  sourceCueId: string;
  sourceWordId: string;
  startsAtMs: number;
  spokenStartsAtMs: number;
  endsAtMs: number;
  speakerId: string;
  text: string;
}

export interface ChapterContextWindow {
  windowId: string;
  startsAtMs: number;
  endsAtMs: number;
  eligibleAnchorIds: string[];
  records: ChapterContextRecord[];
}

export interface ChapterContext {
  schemaVersion: "timed-text-chapter-context-v1";
  policyVersion: "chapter-context-v1";
  mode: ChapterMode;
  durationMs: number;
  policy: ChapterContextPolicy;
  windows: ChapterContextWindow[];
}

export interface ChapterEntry {
  anchorId: string;
  title: string;
}

export interface CompiledChapter {
  anchorId: string;
  sourceCueId: string;
  sourceWordId: string;
  startsAtMs: number;
  title: string;
}

export interface ChapterList {
  schemaVersion: "timed-text-chapter-list-v1";
  mode: ChapterMode;
  durationMs: number;
  policyVersion: "chapter-context-v1";
  chapters: CompiledChapter[];
}

export const CHAPTER_CONTEXT_SCHEMA: "timed-text-chapter-context-v1";
export const CHAPTER_CONTEXT_POLICY_VERSION: "chapter-context-v1";
export const CHAPTER_LIST_SCHEMA: "timed-text-chapter-list-v1";
export const DEFAULT_CHAPTER_CONTEXT_POLICY: Readonly<ChapterContextPolicy>;

export function planChapterContext(
  value: ChapterSourceCue[],
  options: {
    durationMs: number;
    mode?: ChapterMode;
    policy?: ChapterContextPolicy;
  }
): ChapterContext;

export function compileChapterEntries(value: ChapterEntry[], context: ChapterContext): ChapterList;
export function validateChapterList(value: ChapterList, context?: ChapterContext): ChapterList;
export function formatYouTubeChapters(value: ChapterList): string;
export function formatMarkdownChapters(value: ChapterList): string;
export function chapterClock(milliseconds: number, durationMs?: number): string;
