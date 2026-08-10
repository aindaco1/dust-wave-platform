const MAXIMUM_WORDS = 500_000;
const MAXIMUM_DURATION_MS = 24 * 60 * 60 * 1_000;
const MAXIMUM_WORD_TEXT = 2_000;
const CONTROL_OR_BIDI =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
const SENTENCE_END = /[.!?]["'’”\)\]]*$/u;

export const DEFAULT_TIMED_WORD_GROUPING_POLICY = Object.freeze({
  minimumWordsPerCue: 3,
  targetWordsPerCue: 10,
  maximumWordsPerCue: 16,
  targetCharactersPerCue: 72,
  maximumCharactersPerCue: 110,
  maximumCueDurationMs: 6_000,
  maximumGapMs: 750,
  preferredPauseMs: 350,
  maximumCandidateWords: 16
});

export function groupTimedWords(value, { durationMs, policy }) {
  validateDuration(durationMs);
  if (!Array.isArray(value) || value.length < 1 || value.length > MAXIMUM_WORDS) {
    throw new TypeError("Timed words are invalid");
  }
  const normalizedPolicy = normalizePolicy(policy);
  let priorStart = -1;
  const words = value.map((word, index) => {
    const normalized = normalizeWord(word, index, durationMs, priorStart);
    priorStart = normalized.startsAtMs;
    return normalized;
  });

  const ranges = hardBoundaryRanges(words, normalizedPolicy);
  const groups = ranges.flatMap(([start, end]) => optimizeRange(
    words,
    start,
    end,
    normalizedPolicy
  ));
  const cues = [];
  for (const [start, end] of groups) {
    const startsAtMs = Math.max(
      cues.at(-1)?.endsAtMs ?? 0,
      words[start].startsAtMs
    );
    const endsAtMs = Math.min(
      durationMs,
      Math.max(startsAtMs + 1, words[end].endsAtMs)
    );
    const textMarkdown = words.slice(start, end + 1)
      .map(({ text }) => text)
      .join(" ")
      .replace(/\s+([,.;:!?])/gu, "$1")
      .normalize("NFC");
    if (!textMarkdown || endsAtMs <= startsAtMs) {
      throw new TypeError("Timed word grouping produced invalid cue evidence");
    }
    cues.push({ startsAtMs, endsAtMs, textMarkdown });
  }
  return cues;
}

function validateDuration(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAXIMUM_DURATION_MS) {
    throw new TypeError("Timed word grouping duration is invalid");
  }
}

function normalizeWord(value, index, durationMs, priorStart) {
  const allowed = new Set(["text", "startsAtMs", "endsAtMs", "boundaryBefore"]);
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).some((key) => !allowed.has(key))
      || typeof value.text !== "string" || CONTROL_OR_BIDI.test(value.text)
      || !Number.isSafeInteger(value.startsAtMs)
      || !Number.isSafeInteger(value.endsAtMs)
      || value.startsAtMs < 0 || value.startsAtMs < priorStart
      || value.endsAtMs <= value.startsAtMs || value.endsAtMs > durationMs
      || (value.boundaryBefore !== undefined
        && typeof value.boundaryBefore !== "boolean")) {
    throw new TypeError(`Timed word ${index + 1} is invalid`);
  }
  const text = value.text.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!text || [...text].length > MAXIMUM_WORD_TEXT) {
    throw new TypeError(`Timed word ${index + 1} is invalid`);
  }
  return {
    text,
    startsAtMs: value.startsAtMs,
    endsAtMs: value.endsAtMs,
    boundaryBefore: value.boundaryBefore === true
  };
}

function normalizePolicy(value) {
  const bounds = Object.freeze({
    minimumWordsPerCue: [1, 50],
    targetWordsPerCue: [1, 50],
    maximumWordsPerCue: [1, 100],
    targetCharactersPerCue: [1, 2_000],
    maximumCharactersPerCue: [20, 2_000],
    maximumCueDurationMs: [100, 120_000],
    maximumGapMs: [0, 10_000],
    preferredPauseMs: [0, 10_000],
    maximumCandidateWords: [1, 100]
  });
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).length !== Object.keys(bounds).length
      || Object.keys(value).some((key) => !Object.hasOwn(bounds, key))) {
    throw new TypeError("Timed word grouping policy is invalid");
  }
  const policy = {};
  for (const [key, [minimum, maximum]] of Object.entries(bounds)) {
    const candidate = value[key];
    if (!Number.isSafeInteger(candidate)
        || candidate < minimum || candidate > maximum) {
      throw new TypeError(`Timed word grouping ${key} is invalid`);
    }
    policy[key] = candidate;
  }
  if (policy.minimumWordsPerCue > policy.targetWordsPerCue
      || policy.targetWordsPerCue > policy.maximumWordsPerCue
      || policy.targetCharactersPerCue > policy.maximumCharactersPerCue
      || policy.preferredPauseMs > policy.maximumGapMs
      || policy.maximumWordsPerCue > policy.maximumCandidateWords) {
    throw new TypeError("Timed word grouping policy range is invalid");
  }
  return policy;
}

function hardBoundaryRanges(words, policy) {
  const ranges = [];
  let start = 0;
  for (let index = 1; index < words.length; index += 1) {
    const gapMs = words[index].startsAtMs - words[index - 1].endsAtMs;
    if (words[index].boundaryBefore || gapMs > policy.maximumGapMs) {
      ranges.push([start, index - 1]);
      start = index;
    }
  }
  ranges.push([start, words.length - 1]);
  return ranges;
}

function optimizeRange(words, rangeStart, rangeEnd, policy) {
  const length = rangeEnd - rangeStart + 1;
  const costs = Array(length + 1).fill(Number.POSITIVE_INFINITY);
  const choices = Array(length).fill(-1);
  costs[length] = 0;

  for (let localStart = length - 1; localStart >= 0; localStart -= 1) {
    const start = rangeStart + localStart;
    let characters = 0;
    for (let count = 1;
      count <= policy.maximumCandidateWords && localStart + count <= length;
      count += 1) {
      const end = start + count - 1;
      characters += words[end].text.length + (count === 1 ? 0 : 1);
      const durationMs = words[end].endsAtMs - words[start].startsAtMs;
      if (count > 1 && (count > policy.maximumWordsPerCue
          || characters > policy.maximumCharactersPerCue
          || durationMs > policy.maximumCueDurationMs)) {
        break;
      }
      const localEnd = localStart + count - 1;
      const score = groupCost(
        words,
        start,
        end,
        rangeStart,
        rangeEnd,
        characters,
        policy
      ) + costs[localEnd + 1];
      if (score < costs[localStart]
          || (score === costs[localStart] && end > choices[localStart])) {
        costs[localStart] = score;
        choices[localStart] = end;
      }
    }
    if (choices[localStart] < start) {
      throw new TypeError("Timed word grouping could not preserve every word");
    }
  }

  const groups = [];
  for (let start = rangeStart; start <= rangeEnd;) {
    const end = choices[start - rangeStart];
    groups.push([start, end]);
    start = end + 1;
  }
  return groups;
}

function groupCost(
  words,
  start,
  end,
  rangeStart,
  rangeEnd,
  characters,
  policy
) {
  const count = end - start + 1;
  let score = Math.abs(count - policy.targetWordsPerCue) * 16
    + Math.abs(characters - policy.targetCharactersPerCue);
  if (count < policy.minimumWordsPerCue) {
    score += (policy.minimumWordsPerCue - count) * 120;
  }
  if (count === 1 && rangeEnd > rangeStart) score += 1_000;
  if (end < rangeEnd) {
    if (SENTENCE_END.test(words[end].text)) score -= 80;
    else score += 24;
    const gapMs = Math.max(0, words[end + 1].startsAtMs - words[end].endsAtMs);
    if (policy.preferredPauseMs > 0) {
      score -= Math.min(60, Math.floor(gapMs / policy.preferredPauseMs * 30));
    }
  }
  return score;
}
