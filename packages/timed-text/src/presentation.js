const MAXIMUM_WORDS = 500_000;
const MAXIMUM_DURATION_MS = 24 * 60 * 60 * 1_000;
const MAXIMUM_TEXT_LENGTH = 2_000;
const CONTROL_OR_BIDI =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
const SAFE_IDENTIFIER = /^[a-z][a-z0-9_-]{0,119}$/u;
const SENTENCE_END = /[.!?]["'’”)\]]*$/u;
const STRONG_BREAK = /[:;—…]["'’”)\]]*$/u;
const COMMA_BREAK = /,["'’”)\]]*$/u;
const LEADING_PUNCTUATION = /^[,.;:!?)}\]”’]/u;
const FUNCTION_WORD = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "if", "in", "into",
  "my", "nor", "of", "on", "or", "our", "the", "their", "this", "that", "these",
  "those", "to", "your"
]);

export const TIMED_TEXT_PRESENTATION_POLICY_VERSION = "timed-text-presentation-v1";

export const DEFAULT_TIMED_TEXT_PRESENTATION_POLICY = Object.freeze({
  minimumWordsPerCue: 2,
  targetWordsPerCue: 8,
  maximumWordsPerCue: 14,
  maximumCueDurationMs: 6_000,
  maximumGapMs: 900,
  preferredPauseMs: 350,
  maximumLines: 2,
  maximumLineWidth: 1_000,
  spaceWidth: 24,
  maximumCandidateWords: 18,
  fastReadingCharactersPerSecond: 20,
  shortCueWarningMs: 833
});

export function planTimedTextPresentation(value, { durationMs, policy }) {
  validateDuration(durationMs);
  if (!Array.isArray(value) || value.length < 1 || value.length > MAXIMUM_WORDS) {
    throw new TypeError("Timed-text presentation words are invalid");
  }
  const normalizedPolicy = normalizePolicy(policy);
  let previousStart = -1;
  const words = value.map((word, index) => {
    const normalized = normalizeWord(word, index, durationMs, previousStart);
    previousStart = normalized.startsAtMs;
    return normalized;
  });
  const widthPrefix = prefixWidths(words);
  const ranges = hardBoundaryRanges(words, normalizedPolicy);
  const groups = ranges.flatMap(([start, end]) => optimizeRange(
    words,
    widthPrefix,
    start,
    end,
    normalizedPolicy
  ));
  const cues = groups.map(([start, end, layout]) => {
    const startsAtMs = words[start].startsAtMs;
    const endsAtMs = words[end].endsAtMs;
    const sourceCueIds = [];
    for (let index = start; index <= end; index += 1) {
      if (sourceCueIds.at(-1) !== words[index].sourceCueId) {
        sourceCueIds.push(words[index].sourceCueId);
      }
    }
    return {
      speakerId: words[start].speakerId,
      sourceCueIds,
      wordStartIndex: start,
      wordEndIndex: end,
      spokenStartsAtMs: startsAtMs,
      spokenEndsAtMs: endsAtMs,
      lineBreakBeforeWordIndexes: layout.breaks.map((index) => index - start),
      lineWidths: layout.widths,
      charactersPerSecond: rounded(
        displayedCharacters(words, start, end) / Math.max(0.001, (endsAtMs - startsAtMs) / 1_000)
      )
    };
  });
  const report = buildReport(cues, words, normalizedPolicy);
  return {
    policyVersion: TIMED_TEXT_PRESENTATION_POLICY_VERSION,
    cues,
    report
  };
}

function validateDuration(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAXIMUM_DURATION_MS) {
    throw new TypeError("Timed-text presentation duration is invalid");
  }
}

function normalizeWord(value, index, durationMs, previousStart) {
  const allowed = new Set([
    "wordId", "text", "startsAtMs", "endsAtMs", "speakerId", "sourceCueId",
    "displayWidth", "gapBeforeMs", "boundaryBefore"
  ]);
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).some((key) => !allowed.has(key))
      || !SAFE_IDENTIFIER.test(value.wordId)
      || !SAFE_IDENTIFIER.test(value.speakerId)
      || !SAFE_IDENTIFIER.test(value.sourceCueId)
      || typeof value.text !== "string" || CONTROL_OR_BIDI.test(value.text)
      || !Number.isSafeInteger(value.startsAtMs) || !Number.isSafeInteger(value.endsAtMs)
      || value.startsAtMs < 0 || value.startsAtMs < previousStart
      || value.endsAtMs <= value.startsAtMs || value.endsAtMs > durationMs
      || !Number.isSafeInteger(value.displayWidth) || value.displayWidth < 1
      || value.displayWidth > 1_000_000
      || (value.gapBeforeMs !== undefined
        && (!Number.isSafeInteger(value.gapBeforeMs) || value.gapBeforeMs < 0
          || value.gapBeforeMs > 10_000))
      || (value.boundaryBefore !== undefined && typeof value.boundaryBefore !== "boolean")) {
    throw new TypeError(`Timed-text presentation word ${index + 1} is invalid`);
  }
  const text = value.text.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!text || [...text].length > MAXIMUM_TEXT_LENGTH) {
    throw new TypeError(`Timed-text presentation word ${index + 1} is invalid`);
  }
  return {
    wordId: value.wordId,
    text,
    startsAtMs: value.startsAtMs,
    endsAtMs: value.endsAtMs,
    speakerId: value.speakerId,
    sourceCueId: value.sourceCueId,
    displayWidth: value.displayWidth,
    gapBeforeMs: value.gapBeforeMs,
    boundaryBefore: value.boundaryBefore === true
  };
}

function normalizePolicy(value) {
  const bounds = Object.freeze({
    minimumWordsPerCue: [1, 50],
    targetWordsPerCue: [1, 50],
    maximumWordsPerCue: [1, 100],
    maximumCueDurationMs: [100, 120_000],
    maximumGapMs: [0, 10_000],
    preferredPauseMs: [0, 10_000],
    maximumLines: [1, 4],
    maximumLineWidth: [20, 1_000_000],
    spaceWidth: [1, 100_000],
    maximumCandidateWords: [1, 100],
    fastReadingCharactersPerSecond: [1, 100],
    shortCueWarningMs: [100, 10_000]
  });
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).length !== Object.keys(bounds).length
      || Object.keys(value).some((key) => !Object.hasOwn(bounds, key))) {
    throw new TypeError("Timed-text presentation policy is invalid");
  }
  const policy = {};
  for (const [key, [minimum, maximum]] of Object.entries(bounds)) {
    const candidate = value[key];
    if (!Number.isSafeInteger(candidate) || candidate < minimum || candidate > maximum) {
      throw new TypeError(`Timed-text presentation ${key} is invalid`);
    }
    policy[key] = candidate;
  }
  if (policy.minimumWordsPerCue > policy.targetWordsPerCue
      || policy.targetWordsPerCue > policy.maximumWordsPerCue
      || policy.preferredPauseMs > policy.maximumGapMs
      || policy.maximumWordsPerCue > policy.maximumCandidateWords) {
    throw new TypeError("Timed-text presentation policy range is invalid");
  }
  return policy;
}

function prefixWidths(words) {
  const prefix = [0];
  for (const word of words) prefix.push(prefix.at(-1) + word.displayWidth);
  return prefix;
}

function hardBoundaryRanges(words, policy) {
  const ranges = [];
  let start = 0;
  for (let index = 1; index < words.length; index += 1) {
    const gapMs = words[index].gapBeforeMs
      ?? Math.max(0, words[index].startsAtMs - words[index - 1].endsAtMs);
    if (words[index].boundaryBefore
        || words[index].speakerId !== words[index - 1].speakerId
        || gapMs > policy.maximumGapMs) {
      ranges.push([start, index - 1]);
      start = index;
    }
  }
  ranges.push([start, words.length - 1]);
  return ranges;
}

function optimizeRange(words, widthPrefix, rangeStart, rangeEnd, policy) {
  const length = rangeEnd - rangeStart + 1;
  const costs = Array(length + 1).fill(Number.POSITIVE_INFINITY);
  const choices = Array(length).fill(null);
  costs[length] = 0;
  for (let localStart = length - 1; localStart >= 0; localStart -= 1) {
    const start = rangeStart + localStart;
    for (let count = 1;
      count <= policy.maximumCandidateWords && localStart + count <= length;
      count += 1) {
      const end = start + count - 1;
      const durationMs = words[end].endsAtMs - words[start].startsAtMs;
      if (count > 1 && (count > policy.maximumWordsPerCue
          || durationMs > policy.maximumCueDurationMs)) break;
      const layout = bestLayout(words, widthPrefix, start, end, policy);
      if (!layout) continue;
      const score = groupCost(
        words,
        start,
        end,
        rangeStart,
        rangeEnd,
        durationMs,
        layout,
        policy
      ) + costs[localStart + count];
      const choice = choices[localStart];
      if (score < costs[localStart]
          || (score === costs[localStart] && (!choice || end > choice.end))) {
        costs[localStart] = score;
        choices[localStart] = { end, layout };
      }
    }
    if (!choices[localStart]) {
      throw new TypeError("Timed-text presentation could not preserve every word");
    }
  }
  const groups = [];
  for (let start = rangeStart; start <= rangeEnd;) {
    const choice = choices[start - rangeStart];
    groups.push([start, choice.end, choice.layout]);
    start = choice.end + 1;
  }
  return groups;
}

function widthBetween(widthPrefix, start, end, spaceWidth) {
  return widthPrefix[end + 1] - widthPrefix[start] + Math.max(0, end - start) * spaceWidth;
}

function bestLayout(words, widthPrefix, start, end, policy) {
  const count = end - start + 1;
  const totalWidth = widthBetween(widthPrefix, start, end, policy.spaceWidth);
  if (totalWidth <= policy.maximumLineWidth) {
    return { breaks: [], widths: [totalWidth], cost: 0, overlongWord: false };
  }
  if (count === 1) {
    return {
      breaks: [],
      widths: [totalWidth],
      cost: (totalWidth - policy.maximumLineWidth) ** 2,
      overlongWord: true
    };
  }
  const lineCount = Math.min(policy.maximumLines, count);
  const costs = Array.from({ length: lineCount + 1 }, () => Array(count + 1).fill(Infinity));
  const previous = Array.from({ length: lineCount + 1 }, () => Array(count + 1).fill(-1));
  costs[0][0] = 0;
  const targetWidth = Math.min(policy.maximumLineWidth, Math.ceil(totalWidth / lineCount));
  for (let line = 1; line <= lineCount; line += 1) {
    for (let localEnd = line; localEnd <= count; localEnd += 1) {
      for (let localStart = line - 1; localStart < localEnd; localStart += 1) {
        if (!Number.isFinite(costs[line - 1][localStart])) continue;
        const absoluteStart = start + localStart;
        const absoluteEnd = start + localEnd - 1;
        const width = widthBetween(widthPrefix, absoluteStart, absoluteEnd, policy.spaceWidth);
        if (width > policy.maximumLineWidth) continue;
        const isFinalLine = line === lineCount;
        const raggedness = isFinalLine
          ? Math.abs(width - targetWidth) * 0.35
          : (width - targetWidth) ** 2 / Math.max(1, targetWidth);
        const boundaryCost = localEnd < count
          ? lineBoundaryCost(words, absoluteEnd, absoluteEnd + 1)
          : 0;
        const cost = costs[line - 1][localStart] + raggedness + boundaryCost;
        if (cost < costs[line][localEnd]) {
          costs[line][localEnd] = cost;
          previous[line][localEnd] = localStart;
        }
      }
    }
  }
  if (!Number.isFinite(costs[lineCount][count])) return null;
  const breaks = [];
  const widths = [];
  let localEnd = count;
  for (let line = lineCount; line >= 1; line -= 1) {
    const localStart = previous[line][localEnd];
    if (localStart < 0) return null;
    widths.push(widthBetween(
      widthPrefix,
      start + localStart,
      start + localEnd - 1,
      policy.spaceWidth
    ));
    if (localStart > 0) breaks.push(start + localStart);
    localEnd = localStart;
  }
  return {
    breaks: breaks.reverse(),
    widths: widths.reverse(),
    cost: costs[lineCount][count],
    overlongWord: false
  };
}

function lineBoundaryCost(words, leftIndex, rightIndex) {
  const left = words[leftIndex].text;
  const right = words[rightIndex].text;
  let cost = 18;
  if (SENTENCE_END.test(left)) cost -= 110;
  else if (STRONG_BREAK.test(left)) cost -= 75;
  else if (COMMA_BREAK.test(left)) cost -= 45;
  if (FUNCTION_WORD.has(coreWord(left))) cost += 130;
  if (LEADING_PUNCTUATION.test(right)) cost += 1_000;
  if ([...left].length <= 2 && !SENTENCE_END.test(left)) cost += 40;
  return cost;
}

function groupCost(
  words,
  start,
  end,
  rangeStart,
  rangeEnd,
  durationMs,
  layout,
  policy
) {
  const count = end - start + 1;
  const characters = displayedCharacters(words, start, end);
  let score = Math.abs(count - policy.targetWordsPerCue) * 18 + layout.cost;
  if (count < policy.minimumWordsPerCue) {
    score += (policy.minimumWordsPerCue - count) * 160;
  }
  if (count === 1 && rangeEnd > rangeStart && !layout.overlongWord) score += 1_200;
  const charactersPerSecond = characters / Math.max(0.001, durationMs / 1_000);
  if (charactersPerSecond > policy.fastReadingCharactersPerSecond) {
    score += (charactersPerSecond - policy.fastReadingCharactersPerSecond) ** 2 * 3;
  }
  if (end < rangeEnd) {
    if (SENTENCE_END.test(words[end].text)) score -= 150;
    else if (STRONG_BREAK.test(words[end].text)) score -= 95;
    else if (COMMA_BREAK.test(words[end].text)) score -= 50;
    else score += 30;
    if (FUNCTION_WORD.has(coreWord(words[end].text))) score += 160;
    const gapMs = words[end + 1].gapBeforeMs
      ?? Math.max(0, words[end + 1].startsAtMs - words[end].endsAtMs);
    if (policy.preferredPauseMs > 0) {
      score -= Math.min(90, Math.floor(gapMs / policy.preferredPauseMs * 45));
    }
  }
  return score;
}

function displayedCharacters(words, start, end) {
  let characters = Math.max(0, end - start);
  for (let index = start; index <= end; index += 1) characters += [...words[index].text].length;
  return characters;
}

function coreWord(value) {
  return value.toLocaleLowerCase("en-US")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function rounded(value) {
  return Number(value.toFixed(3));
}

function buildReport(cues, words, policy) {
  let maximumLines = 0;
  let maximumLineWidth = 0;
  let maximumCharactersPerSecond = 0;
  let fastCueCount = 0;
  let shortCueCount = 0;
  let overlongWordCount = 0;
  for (const cue of cues) {
    maximumLines = Math.max(maximumLines, cue.lineWidths.length);
    maximumLineWidth = Math.max(maximumLineWidth, ...cue.lineWidths);
    maximumCharactersPerSecond = Math.max(
      maximumCharactersPerSecond,
      cue.charactersPerSecond
    );
    if (cue.charactersPerSecond > policy.fastReadingCharactersPerSecond) fastCueCount += 1;
    if (cue.spokenEndsAtMs - cue.spokenStartsAtMs < policy.shortCueWarningMs) shortCueCount += 1;
    if (cue.lineWidths.some((width) => width > policy.maximumLineWidth)) overlongWordCount += 1;
  }
  return {
    wordCount: words.length,
    cueCount: cues.length,
    maximumLines,
    maximumLineWidth,
    maximumCharactersPerSecond: rounded(maximumCharactersPerSecond),
    fastCueCount,
    shortCueCount,
    overlongWordCount
  };
}
