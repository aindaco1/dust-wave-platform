import {
  AUDIO_ENHANCEMENT_PRESETS
} from "./audio-enhancement.js";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SHA256 = /^[a-f0-9]{64}$/;
const SOURCE_MIME_TYPES = new Set([
  "audio/flac",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-flac",
  "audio/x-wav"
]);
const MAXIMUM_SOURCE_BYTES = 20 * 1024 * 1024 * 1024;
const MAXIMUM_OUTPUT_BYTES = 2 * 1024 * 1024 * 1024;
const MAXIMUM_DURATION_MS = 12 * 60 * 60 * 1_000;
const RECOMMENDED_PART_BYTES = 32 * 1024 * 1024;

export const AUDIO_ENHANCEMENT_DERIVATIVE_RECIPE_SCHEMA =
  "audio-enhancement-derivative-recipe-v1";
export const AUDIO_ENHANCEMENT_DERIVATIVE_MANIFEST_SCHEMA =
  "audio-enhancement-derivative-job-v1";
export const AUDIO_ENHANCEMENT_DERIVATIVE_REPORT_SCHEMA =
  "audio-enhancement-derivative-report-v1";

export function validateAudioEnhancementDerivativeRecipe(value) {
  assertObject(value, "Audio enhancement derivative recipe");
  const recipe = {
    schemaVersion: value.schemaVersion,
    presetId: value.presetId,
    targetIntegratedLufs: value.targetIntegratedLufs,
    maximumTruePeakDbtp: value.maximumTruePeakDbtp
  };
  if (
    recipe.schemaVersion !== AUDIO_ENHANCEMENT_DERIVATIVE_RECIPE_SCHEMA
    || !Object.hasOwn(AUDIO_ENHANCEMENT_PRESETS, recipe.presetId)
    || !boundedNumber(recipe.targetIntegratedLufs, -40, -5)
    || !boundedNumber(recipe.maximumTruePeakDbtp, -12, 0)
  ) {
    throw new TypeError("Audio enhancement derivative recipe is invalid");
  }
  return recipe;
}

export async function buildAudioEnhancementDerivativeManifest(body) {
  const candidate = { ...body };
  delete candidate.manifestSha256;
  validateManifestBody(candidate);
  return {
    ...candidate,
    manifestSha256: await sha256Hex(JSON.stringify(candidate))
  };
}

export async function validateAudioEnhancementDerivativeManifest(
  value,
  { expectedHost, expectedBucket } = {}
) {
  assertObject(value, "Audio enhancement derivative manifest");
  validateManifestBody(value, { expectedHost, expectedBucket });
  if (
    !SHA256.test(String(value.manifestSha256 || ""))
    || await sha256Hex(JSON.stringify(withoutKey(value, "manifestSha256")))
      !== value.manifestSha256
  ) {
    throw new TypeError(
      "Audio enhancement derivative manifest digest is invalid"
    );
  }
  return value;
}

export async function validateAudioEnhancementDerivativeReport(
  value,
  manifest
) {
  assertObject(value, "Audio enhancement derivative report");
  await validateAudioEnhancementDerivativeManifest(manifest);
  if (
    value.schemaVersion !== AUDIO_ENHANCEMENT_DERIVATIVE_REPORT_SCHEMA
    || value.jobId !== manifest.jobId
    || value.manifestSha256 !== manifest.manifestSha256
    || !boundedText(value.processorVersion, 240)
    || value.sourceSha256 !== manifest.source.sha256
  ) {
    throw new TypeError(
      "Audio enhancement derivative report identity is invalid"
    );
  }
  const output = validateOutput(value.output, manifest);
  assertObject(
    value.resource,
    "Audio enhancement derivative resource evidence"
  );
  if (
    !nonNegativeInteger(value.resource.wallMs, 24 * 60 * 60 * 1_000)
    || !nonNegativeInteger(
      value.resource.maximumRssBytes,
      64 * 1024 * 1024 * 1024
    )
    || !boundedText(value.resource.ffmpegVersion, 240)
    || !boundedText(value.resource.ffprobeVersion, 240)
  ) {
    throw new TypeError(
      "Audio enhancement derivative resource evidence is invalid"
    );
  }
  return {
    schemaVersion: AUDIO_ENHANCEMENT_DERIVATIVE_REPORT_SCHEMA,
    jobId: value.jobId,
    manifestSha256: value.manifestSha256,
    processorVersion: value.processorVersion,
    sourceSha256: value.sourceSha256,
    output,
    resource: {
      wallMs: value.resource.wallMs,
      maximumRssBytes: value.resource.maximumRssBytes,
      ffmpegVersion: value.resource.ffmpegVersion,
      ffprobeVersion: value.resource.ffprobeVersion
    }
  };
}

export async function audioEnhancementDerivativeReportSha256(
  report,
  manifest
) {
  const validated = await validateAudioEnhancementDerivativeReport(
    report,
    manifest
  );
  return sha256Hex(JSON.stringify(validated));
}

function validateManifestBody(value, {
  expectedHost,
  expectedBucket
} = {}) {
  if (
    value.schemaVersion !== AUDIO_ENHANCEMENT_DERIVATIVE_MANIFEST_SCHEMA
    || !validIdentifier(value.jobId)
    || !validIdentifier(value.selectedPreviewId)
    || !validIdentifier(value.episodeId)
    || !validIdentifier(value.showId)
  ) {
    throw new TypeError(
      "Audio enhancement derivative manifest identity is invalid"
    );
  }
  assertObject(value.source, "Audio enhancement derivative source");
  const episodePrefix = `podcasts/${value.showId}/${value.episodeId}/`;
  if (
    !validIdentifier(value.source.workingMasterId)
    || (expectedBucket && value.source.bucketName !== expectedBucket)
    || !boundedText(value.source.bucketName, 120)
    || !safeObjectKey(value.source.objectKey)
    || !value.source.objectKey.startsWith(episodePrefix)
    || !positiveInteger(value.source.objectBytes, MAXIMUM_SOURCE_BYTES)
    || !boundedText(value.source.etag, 240)
    || !SOURCE_MIME_TYPES.has(value.source.mimeType)
    || !SHA256.test(String(value.source.sha256 || ""))
    || !positiveInteger(value.source.durationMs, MAXIMUM_DURATION_MS)
  ) {
    throw new TypeError(
      "Audio enhancement derivative source snapshot is invalid"
    );
  }
  assertObject(
    value.qualityControl,
    "Audio enhancement derivative quality control"
  );
  if (
    !validIdentifier(value.qualityControl.runId)
    || !SHA256.test(String(value.qualityControl.reportSha256 || ""))
    || value.qualityControl.blockerCount !== 0
  ) {
    throw new TypeError(
      "Audio enhancement derivative quality control is invalid"
    );
  }
  assertObject(
    value.selection,
    "Audio enhancement derivative preview selection"
  );
  if (
    !SHA256.test(String(value.selection.previewManifestSha256 || ""))
    || !SHA256.test(String(value.selection.previewReportSha256 || ""))
    || !SHA256.test(String(value.selection.previewEnhancedSha256 || ""))
  ) {
    throw new TypeError(
      "Audio enhancement derivative preview selection is invalid"
    );
  }
  validateAudioEnhancementDerivativeRecipe(value.recipe);
  validateOutputContract(value.output, value);
  validateEndpoints(value.endpoints, value, expectedHost);
}

function validateOutputContract(value, manifest) {
  assertObject(value, "Audio enhancement derivative output contract");
  const expectedPrefix =
    `podcasts/${manifest.showId}/${manifest.episodeId}/`
    + `audio_enhancement_derivatives/${manifest.jobId}/`;
  if (
    !safeObjectKey(value.objectKey)
    || !value.objectKey.startsWith(expectedPrefix)
    || !value.objectKey.endsWith(`/${manifest.jobId}.mp3`)
    || value.mimeType !== "audio/mpeg"
    || value.recommendedPartBytes !== RECOMMENDED_PART_BYTES
  ) {
    throw new TypeError(
      "Audio enhancement derivative output contract is invalid"
    );
  }
}

function validateEndpoints(value, manifest, expectedHost) {
  assertObject(value, "Audio enhancement derivative endpoints");
  const basePath =
    `/v1/processor/audio-enhancement-derivatives/${manifest.jobId}`;
  const expected = {
    source: `${basePath}/source`,
    partTemplate: `${basePath}/parts/{partNumber}`,
    uploadComplete: `${basePath}/upload-complete`,
    evidenceComplete: `${basePath}/complete`
  };
  for (const [key, pathname] of Object.entries(expected)) {
    let endpoint;
    try {
      endpoint = new URL(String(value[key] || "").replace(
        "{partNumber}",
        "1"
      ));
    } catch {
      throw new TypeError(
        "Audio enhancement derivative endpoint is invalid"
      );
    }
    const expectedPath = pathname.replace("{partNumber}", "1");
    if (
      endpoint.protocol !== "https:"
      || (expectedHost && endpoint.hostname !== expectedHost)
      || endpoint.pathname !== expectedPath
      || endpoint.username
      || endpoint.password
      || endpoint.port
      || endpoint.search
      || endpoint.hash
      || (
        key === "partTemplate"
        && !String(value[key]).includes("{partNumber}")
      )
    ) {
      throw new TypeError(
        "Audio enhancement derivative endpoint is invalid"
      );
    }
  }
}

function validateOutput(value, manifest) {
  assertObject(value, "Audio enhancement derivative output");
  const durationTolerance = Math.max(
    1_000,
    Math.round(manifest.source.durationMs * 0.005)
  );
  if (
    value.objectKey !== manifest.output.objectKey
    || !positiveInteger(value.objectBytes, MAXIMUM_OUTPUT_BYTES)
    || !SHA256.test(String(value.sha256 || ""))
    || value.mimeType !== manifest.output.mimeType
    || !positiveInteger(value.durationMs, MAXIMUM_DURATION_MS + 1_000)
    || Math.abs(value.durationMs - manifest.source.durationMs)
      > durationTolerance
    || value.audioCodec !== "mp3"
    || value.sampleRateHz !== 48_000
    || value.fullyDecoded !== true
  ) {
    throw new TypeError("Audio enhancement derivative output is invalid");
  }
  return {
    objectKey: value.objectKey,
    objectBytes: value.objectBytes,
    sha256: value.sha256,
    mimeType: value.mimeType,
    durationMs: value.durationMs,
    audioCodec: "mp3",
    sampleRateHz: 48_000,
    fullyDecoded: true
  };
}

function withoutKey(value, key) {
  const result = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey !== key) result[entryKey] = entryValue;
  }
  return result;
}

async function sha256Hex(value) {
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function validIdentifier(value) {
  return typeof value === "string"
    && value.length <= 160
    && IDENTIFIER.test(value);
}

function safeObjectKey(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 1_024
    && !value.startsWith("/")
    && !value.includes("\\")
    && !value.includes("..")
    && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}

function boundedText(value, maximum) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maximum
    && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}

function positiveInteger(value, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value > 0 && value <= maximum;
}

function nonNegativeInteger(value, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function boundedNumber(value, minimum, maximum) {
  return typeof value === "number"
    && Number.isFinite(value)
    && value >= minimum
    && value <= maximum;
}
