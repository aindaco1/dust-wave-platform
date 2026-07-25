const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SHA256 = /^[a-f0-9]{64}$/;
const RUNNER_DIGEST = /^sha256:[a-f0-9]{64}$/;
const UNALIGNED_REASON = /^[a-z0-9][a-z0-9_.-]{0,119}$/;
const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const PASSING_TIMING_ORIGINS = new Set([
  "forced_alignment",
  "model",
  "editor"
]);
const ALL_TIMING_ORIGINS = new Set([
  ...PASSING_TIMING_ORIGINS,
  "interpolated"
]);
const MAXIMUM_CUES = 10_000;
const MAXIMUM_WORDS = 25_000;
const MAXIMUM_DURATION_MS = 24 * 60 * 60 * 1_000;

export const ALIGNMENT_RUNNER_SCHEMA = "2";
export const ALIGNMENT_MINIMUM_ALIGNED_WORD_RATIO = 0.98;

export async function buildAlignmentTranscriptProjection({
  transcriptId,
  contentSha256,
  language,
  cues
}) {
  const normalizedTranscriptId = identifier(transcriptId, "transcript ID", 180);
  const normalizedContentSha256 = digest(
    contentSha256,
    "transcript content SHA-256"
  );
  const normalizedLanguage = alignmentLanguage(language);
  if (
    !Array.isArray(cues)
    || cues.length < 1
    || cues.length > MAXIMUM_CUES
  ) {
    throw new TypeError("Alignment transcript cues are invalid");
  }
  let previousEndMs = 0;
  let wordCount = 0;
  const runnerCues = cues.map((candidate, cueIndex) => {
    if (
      !candidate
      || typeof candidate !== "object"
      || Array.isArray(candidate)
    ) {
      throw new TypeError(`Alignment cue ${cueIndex + 1} is invalid`);
    }
    const cueId = identifier(
      candidate.id,
      `alignment cue ${cueIndex + 1} ID`,
      128
    );
    const startsAtMs = boundedInteger(
      candidate.startsAtMs,
      0,
      MAXIMUM_DURATION_MS - 1,
      `alignment cue ${cueIndex + 1} start`
    );
    const endsAtMs = boundedInteger(
      candidate.endsAtMs,
      1,
      MAXIMUM_DURATION_MS,
      `alignment cue ${cueIndex + 1} end`
    );
    if (startsAtMs < previousEndMs || endsAtMs <= startsAtMs) {
      throw new TypeError(
        `Alignment cue ${cueIndex + 1} timing is invalid`
      );
    }
    previousEndMs = endsAtMs;
    const visible = visibleTimedText(
      candidate.textMarkdown,
      `alignment cue ${cueIndex + 1} text`
    );
    const words = [...visible.matchAll(WORD_PATTERN)].map(
      (match, wordIndex) => {
        wordCount += 1;
        if (wordCount > MAXIMUM_WORDS) {
          throw new TypeError("Alignment transcript has too many words");
        }
        return {
          wordId:
            `word_${normalizedTranscriptId.slice(-20)}_`
            + `${cueIndex.toString(36)}_${wordIndex.toString(36)}`,
          text: match[0]
        };
      }
    );
    if (!words.length) {
      throw new TypeError(
        `Alignment cue ${cueIndex + 1} has no lexical words`
      );
    }
    return { cueId, startsAtMs, endsAtMs, words };
  });
  const projectionSha256 = await canonicalAlignmentSha256(runnerCues);
  return {
    language: normalizedLanguage,
    contentSha256: normalizedContentSha256,
    projectionSha256,
    cues: runnerCues,
    wordCount
  };
}

export async function validateAlignmentRunnerResult(
  value,
  {
    jobId,
    alignmentRevisionId,
    sourceAudioSha256,
    sourceDurationMs,
    projection,
    adapter
  }
) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || !exactKeys(value, ["manifest", "manifestSha256"])
  ) {
    throw new TypeError("Alignment result envelope is invalid");
  }
  const manifest = value.manifest;
  if (
    !manifest
    || typeof manifest !== "object"
    || Array.isArray(manifest)
    || !exactKeys(manifest, [
      "schemaVersion",
      "jobId",
      "alignmentRevisionId",
      "language",
      "sourceAudioSha256",
      "transcriptContentSha256",
      "transcriptProjectionSha256",
      "adapter",
      "candidateWords",
      "projectionIssues",
      "resource"
    ])
  ) {
    throw new TypeError("Alignment result manifest is invalid");
  }
  const normalizedDurationMs = boundedInteger(
    sourceDurationMs,
    1,
    MAXIMUM_DURATION_MS,
    "alignment source duration"
  );
  if (
    manifest.schemaVersion !== ALIGNMENT_RUNNER_SCHEMA
    || manifest.jobId !== identifier(jobId, "alignment job ID", 128)
    || manifest.alignmentRevisionId
      !== identifier(alignmentRevisionId, "alignment revision ID", 128)
    || manifest.language !== projection.language
    || manifest.sourceAudioSha256 !== digest(
      sourceAudioSha256,
      "alignment source SHA-256"
    )
    || manifest.transcriptContentSha256 !== projection.contentSha256
    || manifest.transcriptProjectionSha256 !== projection.projectionSha256
  ) {
    throw new TypeError("Alignment result identity is invalid");
  }
  validateResultAdapter(manifest.adapter, adapter);
  if (
    !Array.isArray(manifest.candidateWords)
    || manifest.candidateWords.length !== projection.wordCount
  ) {
    throw new TypeError("Alignment candidate word inventory is invalid");
  }
  const expectedWords = projection.cues.flatMap((cue) =>
    cue.words.map((word) => ({
      ...word,
      cueId: cue.cueId,
      cueStartsAtMs: cue.startsAtMs,
      cueEndsAtMs: cue.endsAtMs
    }))
  );
  let alignedWordCount = 0;
  let unalignedWordCount = 0;
  let interpolatedWordCount = 0;
  let invalidWordCount = 0;
  let previousStartsAtMs = -1;
  let previousEndsAtMs = -1;
  const candidateWords = manifest.candidateWords.map((candidate, index) => {
    const expected = expectedWords[index];
    if (
      !candidate
      || typeof candidate !== "object"
      || Array.isArray(candidate)
      || !exactKeys(candidate, [
        "wordId",
        "cueId",
        "text",
        "startsAtMs",
        "endsAtMs",
        "confidence",
        "timingOrigin",
        "unalignedReason"
      ])
      || candidate.wordId !== expected.wordId
      || candidate.cueId !== expected.cueId
      || normalizeAlignmentLexicalWord(candidate.text)
        !== normalizeAlignmentLexicalWord(expected.text)
    ) {
      throw new TypeError(`Alignment candidate word ${index + 1} is invalid`);
    }
    const hasStart = candidate.startsAtMs !== null;
    const hasEnd = candidate.endsAtMs !== null;
    if (!hasStart && !hasEnd) {
      if (
        candidate.confidence !== null
        || candidate.timingOrigin !== null
        || typeof candidate.unalignedReason !== "string"
        || !UNALIGNED_REASON.test(candidate.unalignedReason)
      ) {
        throw new TypeError(
          `Alignment candidate word ${index + 1} omission is invalid`
        );
      }
      unalignedWordCount += 1;
      return {
        wordId: expected.wordId,
        cueId: expected.cueId,
        text: expected.text,
        startsAtMs: null,
        endsAtMs: null,
        confidence: null,
        timingOrigin: null,
        unalignedReason: candidate.unalignedReason
      };
    }
    const startsAtMs = boundedInteger(
      candidate.startsAtMs,
      0,
      normalizedDurationMs - 1,
      `alignment candidate word ${index + 1} start`
    );
    const endsAtMs = boundedInteger(
      candidate.endsAtMs,
      1,
      normalizedDurationMs,
      `alignment candidate word ${index + 1} end`
    );
    const confidence = optionalConfidence(
      candidate.confidence,
      `alignment candidate word ${index + 1} confidence`
    );
    const timingOrigin = String(candidate.timingOrigin ?? "");
    if (
      endsAtMs <= startsAtMs
      || startsAtMs < expected.cueStartsAtMs
      || endsAtMs > expected.cueEndsAtMs
      || startsAtMs < previousStartsAtMs
      || endsAtMs < previousEndsAtMs
      || !ALL_TIMING_ORIGINS.has(timingOrigin)
      || candidate.unalignedReason !== null
    ) {
      invalidWordCount += 1;
    }
    previousStartsAtMs = startsAtMs;
    previousEndsAtMs = endsAtMs;
    if (timingOrigin === "interpolated") {
      interpolatedWordCount += 1;
    } else if (PASSING_TIMING_ORIGINS.has(timingOrigin)) {
      alignedWordCount += 1;
    }
    return {
      wordId: expected.wordId,
      cueId: expected.cueId,
      text: expected.text,
      startsAtMs,
      endsAtMs,
      confidence,
      timingOrigin,
      unalignedReason: null
    };
  });
  validateProjectionIssues(manifest.projectionIssues, projection.wordCount);
  const resource = validateResource(manifest.resource, normalizedDurationMs);
  const calculatedManifestSha256 = await canonicalAlignmentSha256(manifest);
  if (
    value.manifestSha256 !== calculatedManifestSha256
    || !SHA256.test(value.manifestSha256)
  ) {
    throw new TypeError("Alignment result manifest digest is invalid");
  }
  const alignedWordRatio = alignedWordCount / projection.wordCount;
  return {
    manifest: {
      ...manifest,
      candidateWords,
      resource
    },
    manifestSha256: calculatedManifestSha256,
    quality: {
      schemaVersion: "alignment-result-quality-v1",
      wordCount: projection.wordCount,
      alignedWordCount,
      unalignedWordCount,
      interpolatedWordCount,
      invalidWordCount,
      projectionIssueCount: manifest.projectionIssues.length,
      alignedWordRatio,
      structurallyEligible:
        invalidWordCount === 0
        && interpolatedWordCount === 0
        && alignedWordRatio >= ALIGNMENT_MINIMUM_ALIGNED_WORD_RATIO
    }
  };
}

export function canonicalAlignmentJson(value) {
  return JSON.stringify(sortCanonicalValue(value));
}

export async function canonicalAlignmentSha256(value) {
  const bytes = new TextEncoder().encode(canonicalAlignmentJson(value));
  const valueDigest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(valueDigest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function normalizeAlignmentLexicalWord(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("und")
    .replace(/[\p{Punctuation}\p{Symbol}\s]+/gu, "");
}

function validateResultAdapter(value, expected) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || !exactKeys(value, [
      "name",
      "version",
      "model",
      "modelVersion",
      "settingsVersion",
      "runnerDigest"
    ])
    || value.name !== expected.name
    || value.version !== expected.version
    || value.model !== expected.model
    || value.modelVersion !== expected.modelVersion
    || value.settingsVersion !== expected.settingsVersion
    || value.runnerDigest !== expected.runnerDigest
    || !RUNNER_DIGEST.test(String(value.runnerDigest))
  ) {
    throw new TypeError("Alignment result adapter identity is invalid");
  }
}

function validateProjectionIssues(value, wordCount) {
  if (
    !Array.isArray(value)
    || value.length > Math.max(100, wordCount * 2)
    || new TextEncoder().encode(JSON.stringify(value)).byteLength
      > 2 * 1024 * 1024
  ) {
    throw new TypeError("Alignment projection issues are invalid");
  }
  for (const issue of value) {
    if (!issue || typeof issue !== "object" || Array.isArray(issue)) {
      throw new TypeError("Alignment projection issue is invalid");
    }
    for (const entry of Object.values(issue)) {
      if (
        entry !== null
        && typeof entry !== "string"
      ) {
        throw new TypeError("Alignment projection issue value is invalid");
      }
      if (typeof entry === "string" && entry.length > 500) {
        throw new TypeError("Alignment projection issue is too large");
      }
    }
  }
}

function validateResource(value, durationMs) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || !exactKeys(value, [
      "inputDurationMinutes",
      "wallClockMinutes",
      "peakMemoryMb",
      "runner"
    ])
  ) {
    throw new TypeError("Alignment runner resource evidence is invalid");
  }
  const expectedInputMinutes = Number((durationMs / 60_000).toFixed(3));
  if (Number(value.inputDurationMinutes) !== expectedInputMinutes) {
    throw new TypeError("Alignment runner input duration is invalid");
  }
  const wallClockMinutes = boundedNumber(
    value.wallClockMinutes,
    0,
    24 * 60,
    "alignment wall-clock minutes"
  );
  const peakMemoryMb = boundedNumber(
    value.peakMemoryMb,
    0,
    1024 * 1024,
    "alignment peak memory"
  );
  const runner = String(value.runner ?? "");
  if (!/^python-[0-9]+\.[0-9]+$/.test(runner)) {
    throw new TypeError("Alignment runner identity is invalid");
  }
  return {
    inputDurationMinutes: expectedInputMinutes,
    wallClockMinutes,
    peakMemoryMb,
    runner
  };
}

function visibleTimedText(value, field) {
  const text = String(value ?? "")
    .normalize("NFKC")
    .replace(/<\/?u>/gi, "")
    .replace(/[*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (
    !text
    || text.length > 10_000
    || /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(text)
    || /[<>]/.test(text)
  ) {
    throw new TypeError(`${field} is invalid`);
  }
  return text;
}

function alignmentLanguage(value) {
  if (value !== "en" && value !== "es") {
    throw new TypeError("Alignment language must be en or es");
  }
  return value;
}

function identifier(value, field, maximum) {
  const text = String(value ?? "");
  if (
    !IDENTIFIER.test(text)
    || text.length > maximum
  ) {
    throw new TypeError(`${field} is invalid`);
  }
  return text;
}

function digest(value, field) {
  const text = String(value ?? "");
  if (!SHA256.test(text)) {
    throw new TypeError(`${field} is invalid`);
  }
  return text;
}

function boundedInteger(value, minimum, maximum, field) {
  const number = Number(value);
  if (
    !Number.isSafeInteger(number)
    || number < minimum
    || number > maximum
  ) {
    throw new TypeError(`${field} is invalid`);
  }
  return number;
}

function boundedNumber(value, minimum, maximum, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new TypeError(`${field} is invalid`);
  }
  return number;
}

function optionalConfidence(value, field) {
  if (value === null) return null;
  return boundedNumber(value, 0, 1, field);
}

function exactKeys(value, keys) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function sortCanonicalValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortCanonicalValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortCanonicalValue(value[key])])
    );
  }
  if (
    value === null
    || typeof value === "string"
    || typeof value === "boolean"
    || (
      typeof value === "number"
      && Number.isFinite(value)
    )
  ) {
    return value;
  }
  throw new TypeError("Alignment canonical JSON value is invalid");
}
