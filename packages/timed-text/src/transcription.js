const LANGUAGES = new Set(["en", "es"]);
const MAXIMUM_CUES = 10_000;
const MAXIMUM_CUE_TEXT = 2_000;
const MAXIMUM_DURATION_MS = 24 * 60 * 60 * 1_000;
const MAXIMUM_CUE_DURATION_MS = 120_000;
const CONTROL_OR_BIDI =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g;

export const TIMED_TEXT_SCHEMA = "timed-text-v1";

export function normalizeSegmentTranscription(value, {
  language,
  durationMs
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
  return normalizeTimedTextCues(cues, { language, durationMs });
}

export function normalizeTimedTextCues(value, {
  language,
  durationMs
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
  const cues = value.map((cue, index) => {
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
      id: `cue_${String(index + 1).padStart(6, "0")}`,
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
