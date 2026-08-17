const MAXIMUM_CUES = 10_000;
const MAXIMUM_DURATION_MS = 24 * 60 * 60 * 1_000;
const MAXIMUM_CUE_TEXT_CHARACTERS = 2_000;
const MAXIMUM_CHAPTERS = 200;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const CONTROL_OR_BIDI = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;

export const CHAPTER_CONTEXT_SCHEMA = "timed-text-chapter-context-v1";
export const CHAPTER_CONTEXT_POLICY_VERSION = "chapter-context-v1";
export const CHAPTER_LIST_SCHEMA = "timed-text-chapter-list-v1";

export const DEFAULT_CHAPTER_CONTEXT_POLICY = Object.freeze({
  targetWindowDurationMs: 4 * 60 * 1_000,
  maximumWindowDurationMs: 6 * 60 * 1_000,
  maximumWindowCues: 80,
  maximumWindowCharacters: 8_000,
  minimumChapterDurationMs: 10_000,
  maximumChapters: MAXIMUM_CHAPTERS,
  maximumTitleCharacters: 100
});

export function planChapterContext(value, {
  durationMs,
  mode = "topics",
  policy = DEFAULT_CHAPTER_CONTEXT_POLICY
}) {
  validateDuration(durationMs);
  if (!["topics", "questions"].includes(mode)) {
    throw new TypeError("Chapter context mode is invalid");
  }
  const normalizedPolicy = normalizePolicy(policy);
  const cues = validateCues(value, durationMs);
  const anchors = cues.map((cue, index) => ({
    anchorId: `chapter_anchor_${cue.cueId}`,
    sourceCueId: cue.cueId,
    sourceWordId: cue.sourceWordId,
    startsAtMs: index === 0 ? 0 : cue.startsAtMs,
    spokenStartsAtMs: cue.startsAtMs,
    endsAtMs: cue.endsAtMs,
    speakerId: cue.speakerId,
    text: cue.text
  }));
  const windows = buildWindows(anchors, normalizedPolicy).map((records, index) => ({
    windowId: `chapter_window_${String(index + 1).padStart(4, "0")}`,
    startsAtMs: records[0].startsAtMs,
    endsAtMs: records.at(-1).endsAtMs,
    eligibleAnchorIds: records.map(({ anchorId }) => anchorId),
    records
  }));
  const context = {
    schemaVersion: CHAPTER_CONTEXT_SCHEMA,
    policyVersion: CHAPTER_CONTEXT_POLICY_VERSION,
    mode,
    durationMs,
    policy: normalizedPolicy,
    windows
  };
  validateContext(context);
  return context;
}

export function compileChapterEntries(value, context) {
  validateContext(context);
  const policy = normalizePolicy(context.policy);
  if (!Array.isArray(value) || value.length < 3 || value.length > policy.maximumChapters) {
    throw new TypeError("Chapter entries must contain a bounded YouTube chapter list");
  }
  const anchors = new Map(context.windows.flatMap(({ records }) =>
    records.map((record) => [record.anchorId, record])
  ));
  const seen = new Set();
  const chapters = value.map((entry, index) => {
    exactKeys(entry, ["anchorId", "title"], `chapter entry ${index + 1}`);
    if (!SAFE_IDENTIFIER.test(entry.anchorId) || seen.has(entry.anchorId)) {
      throw new TypeError(`Chapter entry ${index + 1} anchor is invalid`);
    }
    seen.add(entry.anchorId);
    const anchor = anchors.get(entry.anchorId);
    if (!anchor) throw new TypeError(`Chapter entry ${index + 1} anchor is unknown`);
    const title = normalizedText(
      entry.title,
      policy.maximumTitleCharacters,
      `chapter entry ${index + 1} title`
    );
    return {
      anchorId: anchor.anchorId,
      sourceCueId: anchor.sourceCueId,
      sourceWordId: anchor.sourceWordId,
      startsAtMs: anchor.startsAtMs,
      title
    };
  }).sort((left, right) => left.startsAtMs - right.startsAtMs);
  if (chapters[0].startsAtMs !== 0) {
    throw new TypeError("Chapter entries must begin at 00:00");
  }
  for (let index = 1; index < chapters.length; index += 1) {
    const gap = chapters[index].startsAtMs - chapters[index - 1].startsAtMs;
    if (gap < policy.minimumChapterDurationMs) {
      throw new TypeError(`Chapter entry ${index + 1} is too close to the previous chapter`);
    }
  }
  if (context.durationMs - chapters.at(-1).startsAtMs < policy.minimumChapterDurationMs) {
    throw new TypeError("Final chapter is shorter than the minimum chapter duration");
  }
  return {
    schemaVersion: CHAPTER_LIST_SCHEMA,
    mode: context.mode,
    durationMs: context.durationMs,
    policyVersion: context.policyVersion,
    chapters
  };
}

export function formatYouTubeChapters(value) {
  const normalized = validateChapterList(value);
  return normalized.chapters
    .map(({ startsAtMs, title }) => `${chapterClock(startsAtMs, normalized.durationMs)} - ${title}`)
    .join("\n");
}

export function formatMarkdownChapters(value) {
  const normalized = validateChapterList(value);
  const lines = ["| Time | Chapter |", "| --- | --- |"];
  for (const chapter of normalized.chapters) {
    const title = chapter.title.replace(/\|/gu, "\\|");
    lines.push(`| ${chapterClock(chapter.startsAtMs, normalized.durationMs)} | ${title} |`);
  }
  return lines.join("\n");
}

export function validateChapterList(value, context) {
  exactKeys(
    value,
    ["schemaVersion", "mode", "durationMs", "policyVersion", "chapters"],
    "chapter list"
  );
  if (value.schemaVersion !== CHAPTER_LIST_SCHEMA
      || value.policyVersion !== CHAPTER_CONTEXT_POLICY_VERSION
      || !["topics", "questions"].includes(value.mode)) {
    throw new TypeError("Chapter list identity is invalid");
  }
  validateDuration(value.durationMs);
  if (!Array.isArray(value.chapters) || value.chapters.length < 3
      || value.chapters.length > MAXIMUM_CHAPTERS) {
    throw new TypeError("Chapter list chapters are invalid");
  }
  const anchors = new Set();
  let previousStart = -DEFAULT_CHAPTER_CONTEXT_POLICY.minimumChapterDurationMs;
  const chapters = value.chapters.map((chapter, index) => {
    exactKeys(
      chapter,
      ["anchorId", "sourceCueId", "sourceWordId", "startsAtMs", "title"],
      `chapter ${index + 1}`
    );
    if (!SAFE_IDENTIFIER.test(chapter.anchorId) || anchors.has(chapter.anchorId)
        || !SAFE_IDENTIFIER.test(chapter.sourceCueId)
        || !SAFE_IDENTIFIER.test(chapter.sourceWordId)
        || !Number.isSafeInteger(chapter.startsAtMs) || chapter.startsAtMs < 0
        || chapter.startsAtMs >= value.durationMs
        || chapter.startsAtMs - previousStart
          < DEFAULT_CHAPTER_CONTEXT_POLICY.minimumChapterDurationMs
        || normalizedText(
          chapter.title,
          DEFAULT_CHAPTER_CONTEXT_POLICY.maximumTitleCharacters,
          `chapter ${index + 1} title`
        ) !== chapter.title) {
      throw new TypeError(`Chapter ${index + 1} anchor evidence is invalid`);
    }
    anchors.add(chapter.anchorId);
    previousStart = chapter.startsAtMs;
    return { ...chapter };
  });
  if (chapters[0].startsAtMs !== 0) {
    throw new TypeError("Chapter list must begin at 00:00");
  }
  if (value.durationMs - chapters.at(-1).startsAtMs
      < DEFAULT_CHAPTER_CONTEXT_POLICY.minimumChapterDurationMs) {
    throw new TypeError("Chapter list final chapter is too short");
  }
  if (context !== undefined) {
    validateContext(context);
    if (context.mode !== value.mode || context.durationMs !== value.durationMs
        || context.policyVersion !== value.policyVersion) {
      throw new TypeError("Chapter list does not match its context");
    }
    const anchors = new Map(context.windows.flatMap(({ records }) =>
      records.map((record) => [record.anchorId, record])
    ));
    for (const [index, chapter] of chapters.entries()) {
      const anchor = anchors.get(chapter.anchorId);
      if (!anchor || anchor.sourceCueId !== chapter.sourceCueId
          || anchor.sourceWordId !== chapter.sourceWordId
          || anchor.startsAtMs !== chapter.startsAtMs) {
        throw new TypeError(`Chapter ${index + 1} anchor evidence is invalid`);
      }
    }
  }
  return { ...value, chapters };
}

export function chapterClock(milliseconds, durationMs = milliseconds + 1) {
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0
      || !Number.isSafeInteger(durationMs) || durationMs <= milliseconds
      || durationMs > MAXIMUM_DURATION_MS) {
    throw new TypeError("Chapter timestamp is invalid");
  }
  const seconds = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor(seconds / 60) % 60;
  const remainder = seconds % 60;
  return durationMs >= 3_600_000
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function buildWindows(anchors, policy) {
  const windows = [];
  let current = [];
  let characters = 0;
  for (const anchor of anchors) {
    const nextCharacters = characters + [...anchor.text].length;
    const nextDuration = current.length
      ? anchor.endsAtMs - current[0].startsAtMs
      : anchor.endsAtMs - anchor.startsAtMs;
    const full = current.length > 0 && (
      current.length >= policy.maximumWindowCues
      || nextCharacters > policy.maximumWindowCharacters
      || nextDuration > policy.maximumWindowDurationMs
      || (anchor.startsAtMs - current[0].startsAtMs >= policy.targetWindowDurationMs
        && current.length >= 2)
    );
    if (full) {
      windows.push(current);
      current = [];
      characters = 0;
    }
    current.push(anchor);
    characters += [...anchor.text].length;
  }
  if (current.length) windows.push(current);
  return windows;
}

function validateContext(value) {
  exactKeys(
    value,
    ["schemaVersion", "policyVersion", "mode", "durationMs", "policy", "windows"],
    "chapter context"
  );
  if (value.schemaVersion !== CHAPTER_CONTEXT_SCHEMA
      || value.policyVersion !== CHAPTER_CONTEXT_POLICY_VERSION
      || !["topics", "questions"].includes(value.mode)) {
    throw new TypeError("Chapter context identity is invalid");
  }
  validateDuration(value.durationMs);
  const policy = normalizePolicy(value.policy);
  if (!Array.isArray(value.windows) || value.windows.length < 1
      || value.windows.length > MAXIMUM_CUES) {
    throw new TypeError("Chapter context windows are invalid");
  }
  const anchors = new Set();
  const windowIds = new Set();
  let previousEnd = 0;
  let totalRecords = 0;
  for (const [windowIndex, window] of value.windows.entries()) {
    exactKeys(
      window,
      ["windowId", "startsAtMs", "endsAtMs", "eligibleAnchorIds", "records"],
      `chapter context window ${windowIndex + 1}`
    );
    if (!/^chapter_window_[0-9]{4}$/u.test(window.windowId)
        || windowIds.has(window.windowId)
        || !Array.isArray(window.records) || window.records.length < 1
        || window.records.length > policy.maximumWindowCues
        || !Array.isArray(window.eligibleAnchorIds)
        || window.eligibleAnchorIds.length !== window.records.length) {
      throw new TypeError(`Chapter context window ${windowIndex + 1} is invalid`);
    }
    windowIds.add(window.windowId);
    totalRecords += window.records.length;
    if (totalRecords > MAXIMUM_CUES) {
      throw new TypeError("Chapter context contains too many records");
    }
    let windowCharacters = 0;
    for (const [recordIndex, record] of window.records.entries()) {
      exactKeys(record, [
        "anchorId", "sourceCueId", "sourceWordId", "startsAtMs", "spokenStartsAtMs",
        "endsAtMs", "speakerId", "text"
      ], `chapter context record ${recordIndex + 1}`);
      if (!SAFE_IDENTIFIER.test(record.anchorId) || anchors.has(record.anchorId)
          || window.eligibleAnchorIds[recordIndex] !== record.anchorId
          || !SAFE_IDENTIFIER.test(record.sourceCueId)
          || !SAFE_IDENTIFIER.test(record.sourceWordId)
          || !Number.isSafeInteger(record.startsAtMs) || record.startsAtMs < 0
          || !Number.isSafeInteger(record.spokenStartsAtMs) || record.spokenStartsAtMs < 0
          || (anchors.size === 0
            ? record.startsAtMs !== 0
            : record.startsAtMs !== record.spokenStartsAtMs)
          || record.spokenStartsAtMs < previousEnd
          || !Number.isSafeInteger(record.endsAtMs) || record.endsAtMs <= record.spokenStartsAtMs
          || record.endsAtMs > value.durationMs
          || normalizedText(record.speakerId, 120, "chapter context speaker") !== record.speakerId
          || normalizedText(record.text, MAXIMUM_CUE_TEXT_CHARACTERS, "chapter context text") !== record.text) {
        throw new TypeError(`Chapter context record ${recordIndex + 1} is invalid`);
      }
      anchors.add(record.anchorId);
      previousEnd = record.endsAtMs;
      windowCharacters += [...record.text].length;
    }
    if (window.startsAtMs !== window.records[0].startsAtMs
        || window.endsAtMs !== window.records.at(-1).endsAtMs
        || window.endsAtMs - window.startsAtMs > policy.maximumWindowDurationMs
        || windowCharacters > policy.maximumWindowCharacters) {
      throw new TypeError(`Chapter context window ${windowIndex + 1} timing is invalid`);
    }
  }
}

function validateCues(value, durationMs) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAXIMUM_CUES) {
    throw new TypeError("Chapter context cues are invalid");
  }
  let previousEnd = 0;
  const identifiers = new Set();
  return value.map((cue, index) => {
    exactKeys(
      cue,
      ["cueId", "sourceWordId", "startsAtMs", "endsAtMs", "speakerId", "text"],
      `chapter context cue ${index + 1}`
    );
    if (!SAFE_IDENTIFIER.test(cue.cueId) || identifiers.has(cue.cueId)
        || !SAFE_IDENTIFIER.test(cue.sourceWordId)
        || !Number.isSafeInteger(cue.startsAtMs) || cue.startsAtMs < previousEnd
        || !Number.isSafeInteger(cue.endsAtMs) || cue.endsAtMs <= cue.startsAtMs
        || cue.endsAtMs > durationMs) {
      throw new TypeError(`Chapter context cue ${index + 1} is invalid`);
    }
    identifiers.add(cue.cueId);
    previousEnd = cue.endsAtMs;
    const speakerId = normalizedText(cue.speakerId, 120, `chapter context cue ${index + 1} speaker`);
    const text = normalizedText(cue.text, MAXIMUM_CUE_TEXT_CHARACTERS, `chapter context cue ${index + 1} text`);
    return { ...cue, speakerId, text };
  });
}

function normalizePolicy(value) {
  const bounds = Object.freeze({
    targetWindowDurationMs: [30_000, 30 * 60 * 1_000],
    maximumWindowDurationMs: [30_000, 30 * 60 * 1_000],
    maximumWindowCues: [2, 500],
    maximumWindowCharacters: [500, 50_000],
    minimumChapterDurationMs: [10_000, 30 * 60 * 1_000],
    maximumChapters: [3, MAXIMUM_CHAPTERS],
    maximumTitleCharacters: [10, 200]
  });
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).length !== Object.keys(bounds).length
      || Object.keys(value).some((key) => !Object.hasOwn(bounds, key))) {
    throw new TypeError("Chapter context policy is invalid");
  }
  const policy = {};
  for (const [key, [minimum, maximum]] of Object.entries(bounds)) {
    if (!Number.isSafeInteger(value[key]) || value[key] < minimum || value[key] > maximum) {
      throw new TypeError(`Chapter context ${key} is invalid`);
    }
    policy[key] = value[key];
  }
  if (policy.targetWindowDurationMs > policy.maximumWindowDurationMs) {
    throw new TypeError("Chapter context policy range is invalid");
  }
  return policy;
}

function validateDuration(value) {
  if (!Number.isSafeInteger(value) || value < 30_000 || value > MAXIMUM_DURATION_MS) {
    throw new TypeError("Chapter duration is invalid");
  }
}

function normalizedText(value, maximumCharacters, label) {
  if (typeof value !== "string") throw new TypeError(`${label} is invalid`);
  const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!normalized || [...normalized].length > maximumCharacters || CONTROL_OR_BIDI.test(normalized)) {
    throw new TypeError(`${label} is invalid`);
  }
  return normalized;
}

function exactKeys(value, keys, label) {
  const allowed = new Set(keys);
  if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).length !== allowed.size
      || Object.keys(value).some((key) => !allowed.has(key))) {
    throw new TypeError(`${label} contains unexpected fields`);
  }
}
