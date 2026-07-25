import {
  normalizeSegmentTranscription,
  normalizeTimedTextCues
} from "./transcription.js";

const MAXIMUM_DURATION_MS = 24 * 60 * 60 * 1_000;
const MAXIMUM_CHUNKS = 256;
const TOKEN_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

export const TRANSCRIPTION_CHUNK_PLAN_SCHEMA =
  "transcription-chunk-plan-v1";
export const TRANSCRIPTION_CHUNK_PROCESSOR_SCHEMA =
  "transcription-chunk-processor-v1";
export const TRANSCRIPTION_CHUNK_PROCESSOR_VERSION =
  "ffmpeg-transcription-chunker-v1";
export const MAXIMUM_TRANSCRIPTION_CHUNK_BYTES = 16 * 1024 * 1024;
export const DEFAULT_TRANSCRIPTION_CHUNK_POLICY = Object.freeze({
  targetChunkDurationMs: 12 * 60 * 1_000,
  maximumChunkDurationMs: 15 * 60 * 1_000,
  minimumChunkDurationMs: 2 * 60 * 1_000,
  overlapMs: 1_500,
  silenceThresholdDb: -35,
  minimumSilenceDurationMs: 500,
  outputMimeType: "audio/mpeg",
  outputCodec: "libmp3lame",
  outputSampleRateHz: 16_000,
  outputChannels: 1,
  outputBitrateKbps: 64
});

export function planTranscriptionChunks({
  sourceDurationMs,
  silenceWindows = [],
  policy = DEFAULT_TRANSCRIPTION_CHUNK_POLICY
}) {
  const normalizedPolicy = validatePolicy(policy);
  const durationMs = boundedInteger(
    sourceDurationMs,
    1,
    MAXIMUM_DURATION_MS,
    "source duration"
  );
  const silences = validateSilenceWindows(silenceWindows, durationMs);
  const boundaries = [];
  let coreStartsAtMs = 0;
  while (
    durationMs - coreStartsAtMs
    > normalizedPolicy.maximumChunkDurationMs
  ) {
    const minimumBoundary =
      coreStartsAtMs + normalizedPolicy.minimumChunkDurationMs;
    const maximumBoundary = Math.min(
      coreStartsAtMs + normalizedPolicy.maximumChunkDurationMs,
      durationMs - normalizedPolicy.minimumChunkDurationMs
    );
    const targetBoundary = Math.min(
      coreStartsAtMs + normalizedPolicy.targetChunkDurationMs,
      maximumBoundary
    );
    if (maximumBoundary < minimumBoundary) break;
    const candidates = silences
      .map((silence) => ({
        boundary: Math.round(
          (silence.startsAtMs + silence.endsAtMs) / 2
        ),
        silence
      }))
      .filter(({ boundary }) =>
        boundary >= minimumBoundary && boundary <= maximumBoundary
      )
      .sort((left, right) =>
        Math.abs(left.boundary - targetBoundary)
          - Math.abs(right.boundary - targetBoundary)
        || left.boundary - right.boundary
      );
    const selected = candidates[0];
    const coreEndsAtMs = selected?.boundary ?? targetBoundary;
    boundaries.push({
      coreStartsAtMs,
      coreEndsAtMs,
      boundaryKind: selected ? "silence" : "duration"
    });
    coreStartsAtMs = coreEndsAtMs;
    if (boundaries.length >= MAXIMUM_CHUNKS) {
      throw new TypeError("Transcription chunk plan has too many chunks");
    }
  }
  boundaries.push({
    coreStartsAtMs,
    coreEndsAtMs: durationMs,
    boundaryKind: "end"
  });

  const chunks = boundaries.map((boundary, index) => ({
    index,
    coreStartsAtMs: boundary.coreStartsAtMs,
    coreEndsAtMs: boundary.coreEndsAtMs,
    mediaStartsAtMs: index === 0
      ? 0
      : Math.max(0, boundary.coreStartsAtMs - normalizedPolicy.overlapMs),
    mediaEndsAtMs: index === boundaries.length - 1
      ? durationMs
      : Math.min(
          durationMs,
          boundary.coreEndsAtMs + normalizedPolicy.overlapMs
        ),
    boundaryKind: boundary.boundaryKind
  }));

  return {
    schemaVersion: TRANSCRIPTION_CHUNK_PLAN_SCHEMA,
    sourceDurationMs: durationMs,
    policy: normalizedPolicy,
    silenceWindows: silences,
    chunks
  };
}

export function validateTranscriptionChunkPlan(value, {
  sourceDurationMs,
  policy = DEFAULT_TRANSCRIPTION_CHUNK_POLICY
} = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Transcription chunk plan must be an object");
  }
  const durationMs = boundedInteger(
    sourceDurationMs ?? value.sourceDurationMs,
    1,
    MAXIMUM_DURATION_MS,
    "source duration"
  );
  const normalizedPolicy = validatePolicy(policy);
  const rebuilt = planTranscriptionChunks({
    sourceDurationMs: durationMs,
    silenceWindows: value.silenceWindows,
    policy: normalizedPolicy
  });
  if (JSON.stringify(value) !== JSON.stringify(rebuilt)) {
    throw new TypeError("Transcription chunk plan is not deterministic");
  }
  return rebuilt;
}

export function mergeChunkTranscriptions(value, {
  language,
  sourceDurationMs,
  policy = DEFAULT_TRANSCRIPTION_CHUNK_POLICY
}) {
  if (!Array.isArray(value) || value.length < 1) {
    throw new TypeError("Chunk transcription evidence is missing");
  }
  const plan = validateTranscriptionChunkPlan({
    schemaVersion: TRANSCRIPTION_CHUNK_PLAN_SCHEMA,
    sourceDurationMs,
    policy: validatePolicy(policy),
    silenceWindows: value[0]?.plan?.silenceWindows ?? [],
    chunks: value.map((entry) => entry?.plan?.chunk)
  }, {
    sourceDurationMs,
    policy
  });
  if (value.length !== plan.chunks.length) {
    throw new TypeError("Chunk transcription evidence is incomplete");
  }

  const merged = [];
  let deduplicatedTokenCount = 0;
  let droppedCueCount = 0;
  let priorChunkIndex = -1;
  for (let index = 0; index < plan.chunks.length; index += 1) {
    const expectedChunk = plan.chunks[index];
    const entry = value[index];
    if (
      !entry
      || typeof entry !== "object"
      || JSON.stringify(entry.plan?.chunk) !== JSON.stringify(expectedChunk)
      || JSON.stringify(entry.plan?.silenceWindows)
        !== JSON.stringify(plan.silenceWindows)
    ) {
      throw new TypeError(`Chunk transcription ${index + 1} is invalid`);
    }
    const expectedLocalDurationMs =
      expectedChunk.mediaEndsAtMs - expectedChunk.mediaStartsAtMs;
    const localDurationMs = entry.mediaDurationMs === undefined
      ? expectedLocalDurationMs
      : boundedInteger(
          entry.mediaDurationMs,
          Math.max(1, expectedLocalDurationMs - 2_000),
          expectedLocalDurationMs + 2_000,
          `chunk transcription ${index + 1} encoded duration`
        );
    const normalized = normalizeSegmentTranscription(entry.response, {
      language,
      durationMs: localDurationMs
    });
    for (const cue of normalized.cues) {
      const absoluteStartsAtMs =
        expectedChunk.mediaStartsAtMs + cue.startsAtMs;
      const absoluteEndsAtMs =
        expectedChunk.mediaStartsAtMs + cue.endsAtMs;
      const midpointMs = Math.floor(
        (absoluteStartsAtMs + absoluteEndsAtMs) / 2
      );
      const ownsMidpoint =
        midpointMs >= expectedChunk.coreStartsAtMs
        && (
          midpointMs < expectedChunk.coreEndsAtMs
          || (
            index === plan.chunks.length - 1
            && midpointMs <= expectedChunk.coreEndsAtMs
          )
        );
      if (!ownsMidpoint) {
        droppedCueCount += 1;
        continue;
      }
      const startsAtMs = Math.max(
        absoluteStartsAtMs,
        expectedChunk.coreStartsAtMs
      );
      const endsAtMs = Math.min(
        absoluteEndsAtMs,
        expectedChunk.coreEndsAtMs
      );
      if (endsAtMs <= startsAtMs) {
        droppedCueCount += 1;
        continue;
      }
      let textMarkdown = cue.textMarkdown;
      if (merged.length && priorChunkIndex !== index) {
        const overlap = removeConservativeTokenOverlap(
          merged.at(-1).textMarkdown,
          textMarkdown,
          language
        );
        textMarkdown = overlap.text;
        deduplicatedTokenCount += overlap.removedTokenCount;
        if (!textMarkdown) {
          droppedCueCount += 1;
          continue;
        }
      }
      merged.push({ startsAtMs, endsAtMs, textMarkdown });
      priorChunkIndex = index;
    }
  }
  const transcription = normalizeTimedTextCues(merged, {
    language,
    durationMs: sourceDurationMs
  });
  return {
    transcription,
    evidence: {
      schemaVersion: "transcription-chunk-merge-evidence-v1",
      chunkCount: plan.chunks.length,
      cueCount: transcription.cues.length,
      deduplicatedTokenCount,
      droppedCueCount
    }
  };
}

export async function buildTranscriptionChunkProcessorManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Transcription chunk manifest must be an object");
  }
  const policy = validatePolicy(value.policy);
  const runId = identifier(value.runId, "run ID");
  const jobId = identifier(value.jobId, "job ID");
  const source = value.source;
  const output = value.output;
  if (
    !source
    || typeof source !== "object"
    || Array.isArray(source)
    || !output
    || typeof output !== "object"
    || Array.isArray(output)
  ) {
    throw new TypeError("Transcription chunk manifest media is invalid");
  }
  const uploadUrlTemplate = secureUrl(
    output.uploadUrlTemplate,
    "upload URL template",
    { template: true }
  );
  const base = {
    schemaVersion: TRANSCRIPTION_CHUNK_PROCESSOR_SCHEMA,
    processorVersion: TRANSCRIPTION_CHUNK_PROCESSOR_VERSION,
    runId,
    jobId,
    episodeId: identifier(value.episodeId, "episode ID"),
    showId: identifier(value.showId, "show ID"),
    workingMasterId: identifier(
      value.workingMasterId,
      "working master ID"
    ),
    language: language(value.language),
    source: {
      objectKey: objectKey(source.objectKey, "source object key"),
      objectBytes: boundedInteger(
        source.objectBytes,
        1,
        10 * 1024 * 1024 * 1024,
        "source object bytes"
      ),
      etag: boundedText(source.etag, 1, 240, "source ETag"),
      mimeType: sourceMimeType(source.mimeType),
      sha256: sha256(source.sha256, "source SHA-256"),
      durationMs: boundedInteger(
        source.durationMs,
        1,
        MAXIMUM_DURATION_MS,
        "source duration"
      )
    },
    policy,
    output: {
      keyPrefix: objectKey(output.keyPrefix, "output key prefix"),
      mimeType: output.mimeType,
      maximumObjectBytes: output.maximumObjectBytes,
      uploadUrlTemplate
    },
    sourceUrl: secureUrl(value.sourceUrl, "source URL"),
    callbackUrl: secureUrl(value.callbackUrl, "callback URL")
  };
  if (
    base.output.mimeType !== "audio/mpeg"
    || base.output.maximumObjectBytes !== MAXIMUM_TRANSCRIPTION_CHUNK_BYTES
    || !base.output.uploadUrlTemplate.includes("{index}")
  ) {
    throw new TypeError("Transcription chunk output contract is invalid");
  }
  return {
    ...base,
    manifestSha256: await digestJson(base)
  };
}

export async function validateTranscriptionChunkProcessorManifest(
  value,
  {
    expectedHost,
    expectedOutputKeyPrefix
  } = {}
) {
  const rebuilt = await buildTranscriptionChunkProcessorManifest(value);
  if (value.manifestSha256 !== rebuilt.manifestSha256) {
    throw new TypeError("Transcription chunk manifest digest is invalid");
  }
  if (expectedHost) {
    for (const urlValue of [
      rebuilt.sourceUrl,
      rebuilt.callbackUrl,
      rebuilt.output.uploadUrlTemplate.replace("{index}", "0")
    ]) {
      if (new URL(urlValue).host !== expectedHost) {
        throw new TypeError("Transcription chunk manifest host is invalid");
      }
    }
  }
  if (
    expectedOutputKeyPrefix
    && rebuilt.output.keyPrefix !== expectedOutputKeyPrefix
  ) {
    throw new TypeError(
      "Transcription chunk manifest output prefix is invalid"
    );
  }
  return rebuilt;
}

function validatePolicy(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Transcription chunk policy must be an object");
  }
  const policy = {
    targetChunkDurationMs: boundedInteger(
      value.targetChunkDurationMs,
      60_000,
      30 * 60_000,
      "target chunk duration"
    ),
    maximumChunkDurationMs: boundedInteger(
      value.maximumChunkDurationMs,
      2 * 60_000,
      30 * 60_000,
      "maximum chunk duration"
    ),
    minimumChunkDurationMs: boundedInteger(
      value.minimumChunkDurationMs,
      30_000,
      10 * 60_000,
      "minimum chunk duration"
    ),
    overlapMs: boundedInteger(
      value.overlapMs,
      0,
      10_000,
      "chunk overlap"
    ),
    silenceThresholdDb: boundedNumber(
      value.silenceThresholdDb,
      -80,
      -10,
      "silence threshold"
    ),
    minimumSilenceDurationMs: boundedInteger(
      value.minimumSilenceDurationMs,
      100,
      10_000,
      "minimum silence duration"
    ),
    outputMimeType: value.outputMimeType,
    outputCodec: value.outputCodec,
    outputSampleRateHz: value.outputSampleRateHz,
    outputChannels: value.outputChannels,
    outputBitrateKbps: value.outputBitrateKbps
  };
  if (
    policy.minimumChunkDurationMs >= policy.targetChunkDurationMs
    || policy.targetChunkDurationMs > policy.maximumChunkDurationMs
    || policy.outputMimeType !== "audio/mpeg"
    || policy.outputCodec !== "libmp3lame"
    || policy.outputSampleRateHz !== 16_000
    || policy.outputChannels !== 1
    || policy.outputBitrateKbps !== 64
  ) {
    throw new TypeError("Transcription chunk policy is invalid");
  }
  return policy;
}

function validateSilenceWindows(value, sourceDurationMs) {
  if (!Array.isArray(value) || value.length > 10_000) {
    throw new TypeError("Silence windows are invalid");
  }
  let priorEnd = 0;
  return value.map((window, index) => {
    if (!window || typeof window !== "object" || Array.isArray(window)) {
      throw new TypeError(`Silence window ${index + 1} is invalid`);
    }
    const startsAtMs = boundedInteger(
      window.startsAtMs,
      0,
      sourceDurationMs,
      `silence window ${index + 1} start`
    );
    const endsAtMs = boundedInteger(
      window.endsAtMs,
      1,
      sourceDurationMs,
      `silence window ${index + 1} end`
    );
    if (startsAtMs < priorEnd || endsAtMs <= startsAtMs) {
      throw new TypeError(`Silence window ${index + 1} is invalid`);
    }
    priorEnd = endsAtMs;
    return { startsAtMs, endsAtMs };
  });
}

function removeConservativeTokenOverlap(previous, current, language) {
  const priorTokens = textTokens(previous, language);
  const currentTokens = textTokens(current, language);
  const maximum = Math.min(priorTokens.length, currentTokens.length, 20);
  let overlap = 0;
  for (let count = maximum; count >= 1; count -= 1) {
    const priorStart = priorTokens.length - count;
    if (
      priorTokens.slice(priorStart).every(
        (token, index) => token.normalized === currentTokens[index].normalized
      )
    ) {
      overlap = count;
      break;
    }
  }
  const accepted =
    overlap >= 3
    || (
      overlap >= 2
      && overlap === currentTokens.length
    );
  if (!accepted) {
    return { text: current, removedTokenCount: 0 };
  }
  const endIndex = currentTokens[overlap - 1].end;
  return {
    text: current.slice(endIndex).replace(/^[\s,.;:!?¿¡—–-]+/u, "").trim(),
    removedTokenCount: overlap
  };
}

function textTokens(value, language) {
  return [...String(value).matchAll(TOKEN_PATTERN)].map((match) => ({
    normalized: match[0].normalize("NFKC").toLocaleLowerCase(language),
    end: match.index + match[0].length
  }));
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

function identifier(value, field) {
  const text = String(value ?? "");
  if (
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(text)
    || text.length > 180
  ) {
    throw new TypeError(`${field} is invalid`);
  }
  return text;
}

function language(value) {
  if (value !== "en" && value !== "es") {
    throw new TypeError("Transcription language must be en or es");
  }
  return value;
}

function objectKey(value, field) {
  const text = String(value ?? "");
  if (
    !text.startsWith("podcasts/")
    || text.length > 900
    || text.includes("..")
    || /[\u0000-\u001f\u007f\\]/.test(text)
  ) {
    throw new TypeError(`${field} is invalid`);
  }
  return text.replace(/\/+$/, "");
}

function sourceMimeType(value) {
  if (!new Set([
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/x-wav",
    "audio/flac",
    "audio/x-flac"
  ]).has(value)) {
    throw new TypeError("Source MIME type is invalid");
  }
  return value;
}

function sha256(value, field) {
  const text = String(value ?? "");
  if (!/^[a-f0-9]{64}$/.test(text)) {
    throw new TypeError(`${field} is invalid`);
  }
  return text;
}

function boundedText(value, minimum, maximum, field) {
  const text = String(value ?? "").trim();
  if (
    text.length < minimum
    || text.length > maximum
    || /[\u0000-\u001f\u007f]/.test(text)
  ) {
    throw new TypeError(`${field} is invalid`);
  }
  return text;
}

function secureUrl(value, field, { template = false } = {}) {
  const raw = boundedText(value, 12, 2_000, field);
  const parseable = template
    ? raw.replace("{index}", "0")
    : raw;
  let url;
  try {
    url = new URL(parseable);
  } catch {
    throw new TypeError(`${field} is invalid`);
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.hash
    || (template && !raw.includes("{index}"))
  ) {
    throw new TypeError(`${field} is invalid`);
  }
  return raw;
}

async function digestJson(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value))
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
