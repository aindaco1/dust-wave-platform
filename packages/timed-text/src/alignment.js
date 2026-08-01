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
export const ALIGNMENT_PROCESSOR_SCHEMA = "alignment-processor-v1";
export const ALIGNMENT_PROCESSOR_VERSION =
  "dustwave-alignment-workflow-v1";
export const MAXIMUM_ALIGNMENT_RESULT_BYTES = 16 * 1024 * 1024;
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

export async function buildAlignmentProcessorManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Alignment processor manifest must be an object");
  }
  const projection = await validateAlignmentProjection(value.transcript);
  const source = value.source;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new TypeError("Alignment processor source is invalid");
  }
  const adapter = value.adapter;
  validateAdapterManifest(adapter);
  const runner = value.runner;
  if (
    !runner
    || typeof runner !== "object"
    || Array.isArray(runner)
    || !exactKeys(runner, ["repository", "revision"])
    || runner.repository !== "aindaco1/dust-wave-alignment-runner"
    || !/^[a-f0-9]{40}$/.test(String(runner.revision))
  ) {
    throw new TypeError("Alignment processor runner is invalid");
  }
  const base = {
    schemaVersion: ALIGNMENT_PROCESSOR_SCHEMA,
    processorVersion: ALIGNMENT_PROCESSOR_VERSION,
    jobId: identifier(value.jobId, "alignment job ID", 128),
    alignmentRevisionId: identifier(
      value.alignmentRevisionId,
      "alignment revision ID",
      128
    ),
    episodeId: identifier(value.episodeId, "episode ID", 180),
    showId: identifier(value.showId, "show ID", 180),
    transcriptId: identifier(value.transcriptId, "transcript ID", 180),
    workingMasterId: identifier(
      value.workingMasterId,
      "working master ID",
      180
    ),
    language: alignmentLanguage(value.language),
    source: {
      objectKey: alignmentObjectKey(source.objectKey),
      objectBytes: boundedInteger(
        source.objectBytes,
        1,
        10 * 1024 * 1024 * 1024,
        "alignment source bytes"
      ),
      etag: boundedText(source.etag, 1, 240, "alignment source ETag"),
      mimeType: alignmentSourceMimeType(source.mimeType),
      sha256: digest(source.sha256, "alignment source SHA-256"),
      durationMs: boundedInteger(
        source.durationMs,
        1,
        MAXIMUM_DURATION_MS,
        "alignment source duration"
      )
    },
    transcript: projection,
    adapter: {
      name: adapter.name,
      version: adapter.version,
      model: adapter.model,
      modelVersion: adapter.modelVersion,
      settingsVersion: adapter.settingsVersion,
      runnerDigest: adapter.runnerDigest
    },
    runner: {
      repository: runner.repository,
      revision: runner.revision
    },
    output: {
      maximumResultBytes: value.output?.maximumResultBytes
    },
    sourceUrl: secureAlignmentUrl(value.sourceUrl, "alignment source URL"),
    callbackUrl: secureAlignmentUrl(
      value.callbackUrl,
      "alignment callback URL"
    )
  };
  if (
    base.language !== projection.language
    || base.output.maximumResultBytes !== MAXIMUM_ALIGNMENT_RESULT_BYTES
  ) {
    throw new TypeError("Alignment processor output contract is invalid");
  }
  return {
    ...base,
    manifestSha256: await canonicalAlignmentSha256(base)
  };
}

export async function validateAlignmentProcessorManifest(
  value,
  { expectedHost, expectedRunnerRevision } = {}
) {
  const rebuilt = await buildAlignmentProcessorManifest(value);
  if (value.manifestSha256 !== rebuilt.manifestSha256) {
    throw new TypeError("Alignment processor manifest digest is invalid");
  }
  if (
    expectedRunnerRevision
    && rebuilt.runner.revision !== expectedRunnerRevision
  ) {
    throw new TypeError("Alignment processor runner revision is invalid");
  }
  if (expectedHost) {
    for (const urlValue of [rebuilt.sourceUrl, rebuilt.callbackUrl]) {
      if (new URL(urlValue).host !== expectedHost) {
        throw new TypeError("Alignment processor manifest host is invalid");
      }
    }
  }
  return rebuilt;
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

export function auditTimedTextReference({
  cues,
  referenceCues,
  windowMs = 60_000,
  minimumSimilarity = 0.75,
  maximumLowSimilarityWindowRatio = 0.1,
  maximumReportedWindows = 12
}) {
  const primary = reviewCues(cues, "transcript");
  const reference = reviewCues(referenceCues, "reference");
  const normalizedWindowMs = boundedInteger(
    windowMs,
    10_000,
    10 * 60_000,
    "reference audit window"
  );
  const normalizedMinimumSimilarity = boundedNumber(
    minimumSimilarity,
    0,
    1,
    "reference audit minimum similarity"
  );
  const normalizedMaximumLowRatio = boundedNumber(
    maximumLowSimilarityWindowRatio,
    0,
    1,
    "reference audit maximum low-similarity ratio"
  );
  const normalizedMaximumReported = boundedInteger(
    maximumReportedWindows,
    1,
    100,
    "reference audit reported-window limit"
  );
  const startsAtMs = Math.floor(
    primary[0].startsAtMs / normalizedWindowMs
  ) * normalizedWindowMs;
  const endsAtMs = primary.at(-1).endsAtMs;
  const windows = [];
  let totalDistance = 0;
  let totalComparisonWords = 0;
  let lowSimilarityWindowCount = 0;
  let missingReferenceWindowCount = 0;
  let referenceWordCount = 0;
  let primaryWordCount = 0;

  for (
    let windowStart = startsAtMs;
    windowStart < endsAtMs;
    windowStart += normalizedWindowMs
  ) {
    const windowEnd = Math.min(windowStart + normalizedWindowMs, endsAtMs);
    const primaryWindow = reviewWindow(primary, windowStart, windowEnd);
    const referenceWindow = reviewWindow(reference, windowStart, windowEnd);
    const primaryWords = primaryWindow.flatMap(({ words }) => words);
    const referenceWords = referenceWindow.flatMap(({ words }) => words);
    primaryWordCount += primaryWords.length;
    referenceWordCount += referenceWords.length;
    const comparisonWords = Math.max(
      primaryWords.length,
      referenceWords.length
    );
    const distance = lexicalEditDistance(primaryWords, referenceWords);
    const similarity = comparisonWords === 0
      ? 1
      : Math.max(0, 1 - distance / comparisonWords);
    if (primaryWords.length > 0 && referenceWords.length === 0) {
      missingReferenceWindowCount += 1;
    }
    if (
      comparisonWords > 0
      && similarity < normalizedMinimumSimilarity
    ) {
      lowSimilarityWindowCount += 1;
    }
    totalDistance += distance;
    totalComparisonWords += comparisonWords;
    const primaryCueNumbers = primaryWindow.map(({ index }) => index + 1);
    windows.push({
      startsAtMs: windowStart,
      endsAtMs: windowEnd,
      primaryWordCount: primaryWords.length,
      referenceWordCount: referenceWords.length,
      similarity: roundedRatio(similarity),
      firstCueNumber: primaryCueNumbers[0] ?? null,
      lastCueNumber: primaryCueNumbers.at(-1) ?? null
    });
  }

  const comparedWindowCount = windows.filter(
    ({ primaryWordCount: primaryWords, referenceWordCount: referenceWords }) =>
      primaryWords > 0 || referenceWords > 0
  ).length;
  const lowSimilarityWindowRatio = comparedWindowCount === 0
    ? 1
    : lowSimilarityWindowCount / comparedWindowCount;
  const weightedSimilarity = totalComparisonWords === 0
    ? 0
    : Math.max(0, 1 - totalDistance / totalComparisonWords);
  const reportedWindows = [...windows]
    .filter(({ primaryWordCount: primaryWords, referenceWordCount: referenceWords }) =>
      primaryWords > 0 || referenceWords > 0
    )
    .sort((left, right) =>
      left.similarity - right.similarity
      || left.startsAtMs - right.startsAtMs
    )
    .slice(0, normalizedMaximumReported);

  return {
    schemaVersion: "timed-text-reference-audit-v1",
    windowMs: normalizedWindowMs,
    minimumSimilarity: normalizedMinimumSimilarity,
    maximumLowSimilarityWindowRatio: normalizedMaximumLowRatio,
    primaryWordCount,
    referenceWordCount,
    windowCount: windows.length,
    comparedWindowCount,
    lowSimilarityWindowCount,
    lowSimilarityWindowRatio: roundedRatio(lowSimilarityWindowRatio),
    missingReferenceWindowCount,
    weightedSimilarity: roundedRatio(weightedSimilarity),
    passing:
      comparedWindowCount > 0
      && missingReferenceWindowCount === 0
      && lowSimilarityWindowRatio <= normalizedMaximumLowRatio,
    reportedWindows
  };
}

export function normalizeAlignmentLexicalWord(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("und")
    .replace(/[\p{Punctuation}\p{Symbol}\s]+/gu, "");
}

function reviewCues(value, field) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAXIMUM_CUES) {
    throw new TypeError(`Timed-text ${field} cues are invalid`);
  }
  let previousStart = -1;
  return value.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new TypeError(`Timed-text ${field} cue ${index + 1} is invalid`);
    }
    const startsAtMs = boundedInteger(
      candidate.startsAtMs,
      0,
      MAXIMUM_DURATION_MS - 1,
      `timed-text ${field} cue ${index + 1} start`
    );
    const endsAtMs = boundedInteger(
      candidate.endsAtMs,
      1,
      MAXIMUM_DURATION_MS,
      `timed-text ${field} cue ${index + 1} end`
    );
    if (startsAtMs < previousStart || endsAtMs <= startsAtMs) {
      throw new TypeError(`Timed-text ${field} cue ${index + 1} timing is invalid`);
    }
    previousStart = startsAtMs;
    const text = candidate.textMarkdown ?? candidate.text;
    const words = lexicalWords(text);
    return { index, startsAtMs, endsAtMs, words };
  });
}

function reviewWindow(cues, startsAtMs, endsAtMs) {
  return cues.filter((cue) => {
    const midpoint = cue.startsAtMs + (cue.endsAtMs - cue.startsAtMs) / 2;
    return midpoint >= startsAtMs && midpoint < endsAtMs;
  });
}

function lexicalWords(value) {
  return [...String(value ?? "").normalize("NFKC").matchAll(WORD_PATTERN)]
    .map(({ 0: word }) => normalizeAlignmentLexicalWord(word))
    .filter(Boolean);
}

function lexicalEditDistance(left, right) {
  if (left.length > right.length) return lexicalEditDistance(right, left);
  let prior = Array.from({ length: left.length + 1 }, (_, index) => index);
  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    const current = [rightIndex];
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      current[leftIndex] = Math.min(
        current[leftIndex - 1] + 1,
        prior[leftIndex] + 1,
        prior[leftIndex - 1]
          + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    prior = current;
  }
  return prior[left.length];
}

function roundedRatio(value) {
  return Number(Number(value).toFixed(6));
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

async function validateAlignmentProjection(value) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || !exactKeys(value, [
      "language",
      "contentSha256",
      "projectionSha256",
      "cues",
      "wordCount"
    ])
    || !Array.isArray(value.cues)
    || value.cues.length < 1
    || value.cues.length > MAXIMUM_CUES
  ) {
    throw new TypeError("Alignment transcript projection is invalid");
  }
  const language = alignmentLanguage(value.language);
  const contentSha256 = digest(
    value.contentSha256,
    "alignment transcript content SHA-256"
  );
  let wordCount = 0;
  let priorEndMs = 0;
  const cues = value.cues.map((candidate, cueIndex) => {
    if (
      !candidate
      || typeof candidate !== "object"
      || Array.isArray(candidate)
      || !exactKeys(candidate, [
        "cueId",
        "startsAtMs",
        "endsAtMs",
        "words"
      ])
      || !Array.isArray(candidate.words)
      || candidate.words.length < 1
    ) {
      throw new TypeError(
        `Alignment transcript projection cue ${cueIndex + 1} is invalid`
      );
    }
    const cueId = identifier(
      candidate.cueId,
      `alignment projection cue ${cueIndex + 1} ID`,
      128
    );
    const startsAtMs = boundedInteger(
      candidate.startsAtMs,
      0,
      MAXIMUM_DURATION_MS - 1,
      `alignment projection cue ${cueIndex + 1} start`
    );
    const endsAtMs = boundedInteger(
      candidate.endsAtMs,
      1,
      MAXIMUM_DURATION_MS,
      `alignment projection cue ${cueIndex + 1} end`
    );
    if (startsAtMs < priorEndMs || endsAtMs <= startsAtMs) {
      throw new TypeError(
        `Alignment transcript projection cue ${cueIndex + 1} timing is invalid`
      );
    }
    priorEndMs = endsAtMs;
    const words = candidate.words.map((word, wordIndex) => {
      if (
        !word
        || typeof word !== "object"
        || Array.isArray(word)
        || !exactKeys(word, ["wordId", "text"])
      ) {
        throw new TypeError(
          `Alignment projection word ${wordIndex + 1} is invalid`
        );
      }
      wordCount += 1;
      if (wordCount > MAXIMUM_WORDS) {
        throw new TypeError("Alignment transcript has too many words");
      }
      const text = String(word.text ?? "");
      if (
        !normalizeAlignmentLexicalWord(text)
        || text.length > 500
        || /[\u0000-\u001f\u007f]/u.test(text)
      ) {
        throw new TypeError(
          `Alignment projection word ${wordIndex + 1} text is invalid`
        );
      }
      return {
        wordId: identifier(
          word.wordId,
          `alignment projection word ${wordIndex + 1} ID`,
          128
        ),
        text
      };
    });
    return { cueId, startsAtMs, endsAtMs, words };
  });
  if (value.wordCount !== wordCount) {
    throw new TypeError("Alignment projection word count is invalid");
  }
  const projectionSha256 = digest(
    value.projectionSha256,
    "alignment transcript projection SHA-256"
  );
  if (await canonicalAlignmentSha256(cues) !== projectionSha256) {
    throw new TypeError("Alignment transcript projection digest is invalid");
  }
  return {
    language,
    contentSha256,
    projectionSha256,
    cues,
    wordCount
  };
}

function validateAdapterManifest(value) {
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
    || !["stable-ts", "whisperx"].includes(value.name)
    || !boundedAdapterText(value.version)
    || !boundedAdapterText(value.model)
    || !boundedAdapterText(value.modelVersion)
    || !boundedAdapterText(value.settingsVersion)
    || !RUNNER_DIGEST.test(String(value.runnerDigest))
  ) {
    throw new TypeError("Alignment processor adapter is invalid");
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

function alignmentObjectKey(value) {
  const text = String(value ?? "");
  if (
    !text.startsWith("podcasts/")
    || text.length > 900
    || text.includes("..")
    || /[\u0000-\u001f\u007f\\]/u.test(text)
  ) {
    throw new TypeError("Alignment source object key is invalid");
  }
  return text;
}

function alignmentSourceMimeType(value) {
  if (![
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/x-wav",
    "audio/flac",
    "audio/x-flac"
  ].includes(value)) {
    throw new TypeError("Alignment source MIME type is invalid");
  }
  return value;
}

function secureAlignmentUrl(value, field) {
  const raw = boundedText(value, 12, 2_000, field);
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new TypeError(`${field} is invalid`);
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.hash
  ) {
    throw new TypeError(`${field} is invalid`);
  }
  return raw;
}

function boundedText(value, minimum, maximum, field) {
  const text = String(value ?? "").trim();
  if (
    text.length < minimum
    || text.length > maximum
    || /[\u0000-\u001f\u007f]/u.test(text)
  ) {
    throw new TypeError(`${field} is invalid`);
  }
  return text;
}

function boundedAdapterText(value) {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 200
    && !/[\u0000-\u001f\u007f]/u.test(value);
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
