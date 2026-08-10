export interface DialogueCue {
  startsAtMs: number;
  endsAtMs: number;
  textMarkdown: string;
  speakerLabel: string;
}

export interface DialogueReflowPolicy {
  orphanWordCount: number;
  targetWordsPerCue: number;
  maximumWordsPerCue: number;
  maximumCharactersPerCue: number;
  maximumCueDurationMs: number;
  maximumMergeGapMs: number;
  continuationMergeGapMs: number;
}

export const DIALOGUE_REFLOW_POLICY_VERSION: "dialogue-reflow-v1";
export const DEFAULT_DIALOGUE_REFLOW_POLICY: Readonly<DialogueReflowPolicy>;

export function reflowDialogueCues(
  value: DialogueCue[],
  options: {
    durationMs: number;
    policy?: DialogueReflowPolicy;
  }
): DialogueCue[];
