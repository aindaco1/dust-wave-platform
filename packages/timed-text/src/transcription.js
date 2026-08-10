const LANGUAGES = new Set(["en", "es"]);
const MAXIMUM_CUES = 10_000;
const MAXIMUM_CUE_TEXT = 2_000;
const MAXIMUM_DURATION_MS = 24 * 60 * 60 * 1_000;
const MAXIMUM_CUE_DURATION_MS = 120_000;
const CONTROL_OR_BIDI =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;

export {
  ENGLISH_EDITORIAL_NORMALIZATION_POLICY,
  normalizeEnglishEditorialWords
} from "./editorial.js";
export {
  DEFAULT_TIMED_WORD_GROUPING_POLICY,
  groupTimedWords
} from "./word-grouping.js";

export const TIMED_TEXT_SCHEMA = "timed-text-v1";
export const DEFAULT_CAPTION_SEGMENTATION_POLICY = Object.freeze({
  minimumCueDurationMs: 500,
  maximumCueDurationMs: 10_000,
  maximumCharactersPerSecond: 25,
  maximumCharactersPerCue: 160,
  maximumMergeGapMs: 1_500,
  maximumPaddingMs: 1_500
});

export function normalizeSegmentTranscription(value, {
  language,
  durationMs,
  captionPolicy
}) {
  if (!LANGUAGES.has(language)) {
    throw new TypeError("Transcription language must be en or es");
  }
  if (
    !Number.isSafeInteger(durationMs)
    || durationMs < 1
    || durationMs > MAXIMUM_DURATION_MS
  ) {
    throw new TypeError("Transcription duration is invalid");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Transcription response must be an object");
  }
  const segments = value.segments;
  if (
    !Array.isArray(segments)
    || segments.length < 1
    || segments.length > MAXIMUM_CUES
  ) {
    throw new TypeError("Transcription response has no bounded segments");
  }

  const cues = segments.map((segment, index) => {
    if (!segment || typeof segment !== "object" || Array.isArray(segment)) {
      throw new TypeError(`Transcription segment ${index + 1} is invalid`);
    }
    const startsAtMs = transcriptionMillisecond(
      segment.start,
      `segment ${index + 1} start`
    );
    const endsAtMs = transcriptionMillisecond(
      segment.end,
      `segment ${index + 1} end`
    );
    return {
      startsAtMs,
      endsAtMs,
      textMarkdown: segment.text
    };
  });
  return normalizeTimedTextCues(cues, {
    language,
    durationMs,
    captionPolicy
  });
}

export function normalizeTimedTextCues(value, {
  language,
  durationMs,
  captionPolicy
}) {
  if (!LANGUAGES.has(language)) {
    throw new TypeError("Transcription language must be en or es");
  }
  if (
    !Number.isSafeInteger(durationMs)
    || durationMs < 1
    || durationMs > MAXIMUM_DURATION_MS
  ) {
    throw new TypeError("Transcription duration is invalid");
  }
  if (
    !Array.isArray(value)
    || value.length < 1
    || value.length > MAXIMUM_CUES
  ) {
    throw new TypeError("Transcription response has no bounded segments");
  }
  let previousEndMs = 0;
  const sourceCues = value.map((cue, index) => {
    if (!cue || typeof cue !== "object" || Array.isArray(cue)) {
      throw new TypeError(`Transcription segment ${index + 1} is invalid`);
    }
    const startsAtMs = cue.startsAtMs;
    const endsAtMs = cue.endsAtMs;
    if (
      !Number.isSafeInteger(startsAtMs)
      || !Number.isSafeInteger(endsAtMs)
      || startsAtMs < previousEndMs
      || endsAtMs <= startsAtMs
      || endsAtMs > durationMs
      || endsAtMs - startsAtMs > MAXIMUM_CUE_DURATION_MS
    ) {
      throw new TypeError(
        `Transcription segment ${index + 1} timing is invalid`
      );
    }
    previousEndMs = endsAtMs;
    return {
      startsAtMs,
      endsAtMs,
      speakerLabel: "",
      speakerConfirmed: false,
      textMarkdown: providerPlainText(
        cue.textMarkdown,
        `segment ${index + 1} text`
      )
    };
  });
  const segmented = captionPolicy === undefined
    ? sourceCues
    : segmentCaptionCues(
        sourceCues,
        durationMs,
        normalizeCaptionPolicy(captionPolicy)
      );
  validateSegmentedCues(segmented, durationMs);
  const cues = segmented.map((cue, index) => ({
    ...cue,
    id: `cue_${String(index + 1).padStart(6, "0")}`
  }));
  const plainText = cues.map(({ textMarkdown }) => textMarkdown).join("\n");
  return {
    schemaVersion: TIMED_TEXT_SCHEMA,
    language,
    timingPrecision: "segment",
    cues,
    plainText,
    webVtt: toWebVtt(cues),
    srt: toSrt(cues)
  };
}

function validateSegmentedCues(cues, durationMs) {
  let previousEndMs = 0;
  for (const cue of cues) {
    if (
      !Number.isSafeInteger(cue.startsAtMs)
      || !Number.isSafeInteger(cue.endsAtMs)
      || cue.startsAtMs < previousEndMs
      || cue.endsAtMs <= cue.startsAtMs
      || cue.endsAtMs > durationMs
      || cue.endsAtMs - cue.startsAtMs > MAXIMUM_CUE_DURATION_MS
      || !cue.textMarkdown
      || cue.textMarkdown.length > MAXIMUM_CUE_TEXT
    ) {
      throw new TypeError("Caption segmentation produced invalid cue evidence");
    }
    previousEndMs = cue.endsAtMs;
  }
}

function segmentCaptionCues(cues, durationMs, policy) {
  const split = cues.flatMap((cue) => splitCaptionCue(cue, policy));
  const merged = [];
  for (const cue of split) {
    const previous = merged.at(-1);
    if (previous && captionCuesCanMerge(previous, cue, policy)) {
      previous.endsAtMs = cue.endsAtMs;
      previous.textMarkdown = `${previous.textMarkdown} ${cue.textMarkdown}`;
    } else {
      merged.push({ ...cue });
    }
  }
  const rebalanced = rebalanceFastCaptionCues(merged, policy);
  const padded = [];
  for (let index = 0; index < rebalanced.length; index += 1) {
    const cue = rebalanced[index];
    const previousEnd = padded.at(-1)?.endsAtMs ?? 0;
    const nextStart = index === rebalanced.length - 1
      ? durationMs
      : rebalanced[index + 1].startsAtMs;
    const desiredDuration = Math.min(
      policy.maximumCueDurationMs,
      Math.max(
        policy.minimumCueDurationMs,
        Math.ceil(
          cue.textMarkdown.length
            / policy.maximumCharactersPerSecond
            * 1_000
        )
      )
    );
    let startsAtMs = cue.startsAtMs;
    let endsAtMs = cue.endsAtMs;
    let missing = desiredDuration - (endsAtMs - startsAtMs);
    if (missing > 0) {
      const endPadding = Math.min(
        missing,
        policy.maximumPaddingMs,
        Math.max(0, nextStart - endsAtMs)
      );
      endsAtMs += endPadding;
      missing -= endPadding;
    }
    if (missing > 0) {
      const startPadding = Math.min(
        missing,
        policy.maximumPaddingMs,
        Math.max(0, startsAtMs - previousEnd)
      );
      startsAtMs -= startPadding;
    }
    padded.push({ ...cue, startsAtMs, endsAtMs });
  }
  return padded;
}

function rebalanceFastCaptionCues(cues, policy) {
  const rebalanced = cues.map((cue) => ({ ...cue }));
  for (let index = 0; index < rebalanced.length; index += 1) {
    if (!captionCueIsFast(rebalanced[index], policy)) continue;
    for (const neighborIndex of [index + 1, index - 1]) {
      if (neighborIndex < 0 || neighborIndex >= rebalanced.length) continue;
      const startIndex = Math.min(index, neighborIndex);
      const left = rebalanced[startIndex];
      const right = rebalanced[startIndex + 1];
      const gap = right.startsAtMs - left.endsAtMs;
      const duration = right.endsAtMs - left.startsAtMs;
      const textMarkdown = `${left.textMarkdown} ${right.textMarkdown}`;
      if (
        gap < 0
        || gap > policy.maximumMergeGapMs
        || duration > policy.maximumCueDurationMs * 2
        || textMarkdown.length > policy.maximumCharactersPerCue * 2
        || textMarkdown.length / (duration / 1_000)
          > policy.maximumCharactersPerSecond
      ) {
        continue;
      }
      const replacements = splitCaptionCue({
        ...left,
        endsAtMs: right.endsAtMs,
        textMarkdown
      }, policy);
      if (
        replacements.length === 2
        && replacements.every((cue) => !captionCueIsFast(cue, policy))
      ) {
        rebalanced.splice(startIndex, 2, ...replacements);
        index = Math.max(-1, startIndex - 1);
        break;
      }
    }
  }
  return rebalanced;
}

function captionCuesCanMerge(left, right, policy) {
  const gap = right.startsAtMs - left.endsAtMs;
  if (gap < 0 || gap > policy.maximumMergeGapMs) return false;
  const duration = right.endsAtMs - left.startsAtMs;
  const characters = left.textMarkdown.length + right.textMarkdown.length + 1;
  if (
    duration > policy.maximumCueDurationMs
    || characters > policy.maximumCharactersPerCue
  ) {
    return false;
  }
  return captionCueNeedsMerge(left, policy)
    || captionCueNeedsMerge(right, policy);
}

function captionCueNeedsMerge(cue, policy) {
  const duration = cue.endsAtMs - cue.startsAtMs;
  return duration < policy.minimumCueDurationMs
    || captionCueIsFast(cue, policy);
}

function captionCueIsFast(cue, policy) {
  const duration = cue.endsAtMs - cue.startsAtMs;
  return cue.textMarkdown.length / (duration / 1_000)
    > policy.maximumCharactersPerSecond;
}

function splitCaptionCue(cue, policy) {
  const duration = cue.endsAtMs - cue.startsAtMs;
  const words = cue.textMarkdown.split(" ");
  const partCount = Math.min(
    words.length,
    Math.max(
      1,
      Math.ceil(duration / policy.maximumCueDurationMs),
      Math.ceil(cue.textMarkdown.length / policy.maximumCharactersPerCue)
    )
  );
  if (partCount === 1) return [{ ...cue }];

  const parts = [];
  let wordIndex = 0;
  let consumedWeight = 0;
  const totalWeight = words.reduce((sum, word) => sum + word.length, 0)
    + words.length - 1;
  for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
    const remainingParts = partCount - partIndex;
    const maximumEnd = words.length - (remainingParts - 1);
    const targetWeight = (totalWeight - consumedWeight) / remainingParts;
    let end = wordIndex + 1;
    let partWeight = words[wordIndex].length;
    while (end < maximumEnd) {
      const nextWeight = partWeight + 1 + words[end].length;
      if (nextWeight > targetWeight && end > wordIndex + 1) break;
      partWeight = nextWeight;
      end += 1;
    }
    const startsAtMs = partIndex === 0
      ? cue.startsAtMs
      : parts.at(-1).endsAtMs;
    const nextConsumedWeight = consumedWeight + partWeight
      + (partIndex < partCount - 1 ? 1 : 0);
    const proportionalEnd = cue.startsAtMs + Math.round(
      duration * nextConsumedWeight / totalWeight
    );
    const endsAtMs = partIndex === partCount - 1
      ? cue.endsAtMs
      : Math.max(
          startsAtMs + 1,
          Math.min(
            proportionalEnd,
            cue.endsAtMs - (partCount - partIndex - 1)
          )
        );
    parts.push({
      ...cue,
      startsAtMs,
      endsAtMs,
      textMarkdown: words.slice(wordIndex, end).join(" ")
    });
    consumedWeight = nextConsumedWeight;
    wordIndex = end;
  }
  return parts;
}

function normalizeCaptionPolicy(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Caption segmentation policy is invalid");
  }
  const policy = {};
  for (const [key, minimum, maximum] of [
    ["minimumCueDurationMs", 100, 5_000],
    ["maximumCueDurationMs", 1_000, 30_000],
    ["maximumCharactersPerSecond", 5, 100],
    ["maximumCharactersPerCue", 20, MAXIMUM_CUE_TEXT],
    ["maximumMergeGapMs", 0, 10_000],
    ["maximumPaddingMs", 0, 10_000]
  ]) {
    const candidate = value[key];
    if (
      !Number.isSafeInteger(candidate)
      || candidate < minimum
      || candidate > maximum
    ) {
      throw new TypeError(`Caption segmentation ${key} is invalid`);
    }
    policy[key] = candidate;
  }
  if (policy.maximumCueDurationMs < policy.minimumCueDurationMs) {
    throw new TypeError("Caption segmentation duration range is invalid");
  }
  return policy;
}

function providerPlainText(value, field) {
  const text = String(value ?? "")
    .normalize("NFKC")
    .replace(CONTROL_OR_BIDI, "")
    .replace(/[<>]/g, (character) => character === "<" ? "‹" : "›")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.length > MAXIMUM_CUE_TEXT) {
    throw new TypeError(`${field} is missing or too long`);
  }
  return text;
}

function transcriptionMillisecond(value, field) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new TypeError(`${field} is invalid`);
  }
  const milliseconds = Math.round(seconds * 1_000);
  if (!Number.isSafeInteger(milliseconds) || milliseconds > MAXIMUM_DURATION_MS) {
    throw new TypeError(`${field} is invalid`);
  }
  return milliseconds;
}

function toWebVtt(cues) {
  return [
    "WEBVTT",
    "",
    ...cues.flatMap((cue) => [
      cue.id,
      `${webVttTimestamp(cue.startsAtMs)} --> ${webVttTimestamp(cue.endsAtMs)}`,
      cue.textMarkdown,
      ""
    ])
  ].join("\n");
}

function toSrt(cues) {
  return cues.flatMap((cue, index) => [
    String(index + 1),
    `${srtTimestamp(cue.startsAtMs)} --> ${srtTimestamp(cue.endsAtMs)}`,
    cue.textMarkdown,
    ""
  ]).join("\n");
}

function webVttTimestamp(milliseconds) {
  const { hours, minutes, seconds, remainder } = timestampParts(milliseconds);
  return `${hours}:${minutes}:${seconds}.${remainder}`;
}

function srtTimestamp(milliseconds) {
  const { hours, minutes, seconds, remainder } = timestampParts(milliseconds);
  return `${hours}:${minutes}:${seconds},${remainder}`;
}

function timestampParts(milliseconds) {
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor(milliseconds % 3_600_000 / 60_000);
  const seconds = Math.floor(milliseconds % 60_000 / 1_000);
  const remainder = milliseconds % 1_000;
  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
    remainder: String(remainder).padStart(3, "0")
  };
}
