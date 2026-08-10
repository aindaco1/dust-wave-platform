const MAXIMUM_CUES = 10_000;
const MAXIMUM_DURATION_MS = 24 * 60 * 60 * 1_000;
const MAXIMUM_TEXT_LENGTH = 2_000;
const CONTROL_OR_BIDI = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
const SENTENCE_END = /[.!?]["'’”\)\]]*$/u;
const CONTINUATION_END = /[,;:\-–—]["'’”\)\]]*$/u;
const STARTS_LOWERCASE = /^[^\p{L}]*\p{Ll}/u;

export const DIALOGUE_REFLOW_POLICY_VERSION = "dialogue-reflow-v1";

export const DEFAULT_DIALOGUE_REFLOW_POLICY = Object.freeze({
  orphanWordCount: 3,
  targetWordsPerCue: 18,
  maximumWordsPerCue: 22,
  maximumCharactersPerCue: 140,
  maximumCueDurationMs: 10_000,
  maximumMergeGapMs: 900,
  continuationMergeGapMs: 450
});

export function reflowDialogueCues(value, {
  durationMs,
  policy = DEFAULT_DIALOGUE_REFLOW_POLICY,
  boundaryDecisions = []
}) {
  validateDuration(durationMs);
  const normalizedPolicy = normalizePolicy(policy);
  const cues = validateCues(value, durationMs);
  const decisions = normalizeBoundaryDecisions(boundaryDecisions, cues.length);
  const reflowed = [];
  let current = { ...cues[0] };
  for (let nextIndex = 1; nextIndex < cues.length; nextIndex += 1) {
    const next = cues[nextIndex];
    if (canMerge(current, next, normalizedPolicy, decisions.get(nextIndex - 1))) {
      current.endsAtMs = next.endsAtMs;
      current.textMarkdown = `${current.textMarkdown} ${next.textMarkdown}`;
    } else {
      reflowed.push(current);
      current = { ...next };
    }
  }
  reflowed.push(current);
  return reflowed;
}

function normalizeBoundaryDecisions(value, cueCount) {
  if (!Array.isArray(value) || value.length >= cueCount) {
    throw new TypeError("Dialogue reflow boundary decisions are invalid");
  }
  const decisions = new Map();
  for (const [position, decision] of value.entries()) {
    const keys = new Set(["afterCueIndex", "action"]);
    if (!decision || typeof decision !== "object" || Array.isArray(decision)
        || Object.keys(decision).length !== keys.size
        || Object.keys(decision).some((key) => !keys.has(key))
        || !Number.isSafeInteger(decision.afterCueIndex)
        || decision.afterCueIndex < 0 || decision.afterCueIndex >= cueCount - 1
        || !["merge", "keep"].includes(decision.action)
        || decisions.has(decision.afterCueIndex)) {
      throw new TypeError(`Dialogue reflow boundary decision ${position + 1} is invalid`);
    }
    decisions.set(decision.afterCueIndex, decision.action);
  }
  return decisions;
}

function validateDuration(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAXIMUM_DURATION_MS) {
    throw new TypeError("Dialogue reflow duration is invalid");
  }
}

function validateCues(value, durationMs) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAXIMUM_CUES) {
    throw new TypeError("Dialogue reflow cues are invalid");
  }
  let previousEnd = 0;
  return value.map((cue, index) => {
    const keys = new Set(["startsAtMs", "endsAtMs", "textMarkdown", "speakerLabel"]);
    if (!cue || typeof cue !== "object" || Array.isArray(cue)
        || Object.keys(cue).length !== keys.size
        || Object.keys(cue).some((key) => !keys.has(key))
        || !Number.isSafeInteger(cue.startsAtMs) || !Number.isSafeInteger(cue.endsAtMs)
        || cue.startsAtMs < previousEnd || cue.endsAtMs <= cue.startsAtMs
        || cue.endsAtMs > durationMs
        || typeof cue.textMarkdown !== "string"
        || cue.textMarkdown !== cue.textMarkdown.normalize("NFC").replace(/\s+/gu, " ").trim()
        || !cue.textMarkdown || [...cue.textMarkdown].length > MAXIMUM_TEXT_LENGTH
        || CONTROL_OR_BIDI.test(cue.textMarkdown)
        || typeof cue.speakerLabel !== "string"
        || cue.speakerLabel !== cue.speakerLabel.normalize("NFC").trim()
        || !cue.speakerLabel || [...cue.speakerLabel].length > 120
        || CONTROL_OR_BIDI.test(cue.speakerLabel)) {
      throw new TypeError(`Dialogue reflow cue ${index + 1} is invalid`);
    }
    previousEnd = cue.endsAtMs;
    return { ...cue };
  });
}

function normalizePolicy(value) {
  const bounds = Object.freeze({
    orphanWordCount: [1, 10],
    targetWordsPerCue: [2, 100],
    maximumWordsPerCue: [2, 100],
    maximumCharactersPerCue: [20, 2_000],
    maximumCueDurationMs: [100, 120_000],
    maximumMergeGapMs: [0, 10_000],
    continuationMergeGapMs: [0, 10_000]
  });
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).length !== Object.keys(bounds).length
      || Object.keys(value).some((key) => !Object.hasOwn(bounds, key))) {
    throw new TypeError("Dialogue reflow policy is invalid");
  }
  const normalized = {};
  for (const [key, [minimum, maximum]] of Object.entries(bounds)) {
    if (!Number.isSafeInteger(value[key]) || value[key] < minimum || value[key] > maximum) {
      throw new TypeError(`Dialogue reflow ${key} is invalid`);
    }
    normalized[key] = value[key];
  }
  if (normalized.orphanWordCount >= normalized.targetWordsPerCue
      || normalized.targetWordsPerCue > normalized.maximumWordsPerCue
      || normalized.continuationMergeGapMs > normalized.maximumMergeGapMs) {
    throw new TypeError("Dialogue reflow policy range is invalid");
  }
  return normalized;
}

function wordCount(value) {
  return value.split(/\s+/u).length;
}

function canMerge(left, right, policy, boundaryDecision) {
  if (left.speakerLabel !== right.speakerLabel) return false;
  const gapMs = right.startsAtMs - left.endsAtMs;
  if (gapMs < 0 || gapMs > policy.maximumMergeGapMs) return false;
  const textMarkdown = `${left.textMarkdown} ${right.textMarkdown}`;
  const leftWords = wordCount(left.textMarkdown);
  const rightWords = wordCount(right.textMarkdown);
  const combinedWords = leftWords + rightWords;
  if (combinedWords > policy.maximumWordsPerCue
      || [...textMarkdown].length > policy.maximumCharactersPerCue
      || right.endsAtMs - left.startsAtMs > policy.maximumCueDurationMs) {
    return false;
  }
  if (boundaryDecision === "keep") return false;
  if (boundaryDecision === "merge") return true;
  return leftWords <= policy.orphanWordCount
    || rightWords <= policy.orphanWordCount
    || !SENTENCE_END.test(left.textMarkdown)
    || CONTINUATION_END.test(left.textMarkdown)
    || STARTS_LOWERCASE.test(right.textMarkdown)
    || (combinedWords <= policy.targetWordsPerCue
      && gapMs <= policy.continuationMergeGapMs);
}
