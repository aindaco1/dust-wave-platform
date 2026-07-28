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
const MAXIMUM_DURATION_MS = 12 * 60 * 60 * 1_000;
const MINIMUM_PREVIEW_MS = 5_000;
const MAXIMUM_PREVIEW_MS = 90_000;

export const AUDIO_ENHANCEMENT_RECIPE_SCHEMA =
  "audio-enhancement-recipe-v1";
export const AUDIO_ENHANCEMENT_MANIFEST_SCHEMA =
  "audio-enhancement-job-v1";
export const AUDIO_ENHANCEMENT_REPORT_SCHEMA =
  "audio-enhancement-report-v1";

export const AUDIO_ENHANCEMENT_PRESETS = deepFreeze({
  "dialogue-gentle-v1": {
    id: "dialogue-gentle-v1",
    label: "Gentle dialogue",
    description:
      "Light rumble cleanup followed by transparent loudness normalization."
  },
  "loudness-only-v1": {
    id: "loudness-only-v1",
    label: "Loudness only",
    description:
      "Transparent loudness normalization without tonal filtering."
  }
});

export function validateAudioEnhancementRecipe(value, {
  sourceDurationMs
} = {}) {
  assertObject(value, "Audio enhancement recipe");
  const recipe = {
    schemaVersion: value.schemaVersion,
    presetId: value.presetId,
    previewStartMs: value.previewStartMs,
    previewDurationMs: value.previewDurationMs,
    targetIntegratedLufs: value.targetIntegratedLufs,
    maximumTruePeakDbtp: value.maximumTruePeakDbtp
  };
  if (
    recipe.schemaVersion !== AUDIO_ENHANCEMENT_RECIPE_SCHEMA
    || !Object.hasOwn(AUDIO_ENHANCEMENT_PRESETS, recipe.presetId)
    || !nonNegativeInteger(recipe.previewStartMs, MAXIMUM_DURATION_MS)
    || !boundedInteger(
      recipe.previewDurationMs,
      MINIMUM_PREVIEW_MS,
      MAXIMUM_PREVIEW_MS
    )
    || !boundedNumber(recipe.targetIntegratedLufs, -40, -5)
    || !boundedNumber(recipe.maximumTruePeakDbtp, -12, 0)
    || (
      sourceDurationMs !== undefined
      && (
        !positiveInteger(sourceDurationMs, MAXIMUM_DURATION_MS)
        || recipe.previewStartMs + recipe.previewDurationMs
          > sourceDurationMs
      )
    )
  ) {
    throw new TypeError("Audio enhancement recipe is invalid");
  }
  return recipe;
}

export async function buildAudioEnhancementManifest(body) {
  const candidate = { ...body };
  delete candidate.manifestSha256;
  validateManifestBody(candidate);
  return {
    ...candidate,
    manifestSha256: await sha256Hex(JSON.stringify(candidate))
  };
}

export async function validateAudioEnhancementManifest(value, {
  expectedHost,
  expectedBucket
} = {}) {
  assertObject(value, "Audio enhancement manifest");
  validateManifestBody(value, { expectedHost, expectedBucket });
  if (
    !SHA256.test(String(value.manifestSha256 || ""))
    || await sha256Hex(JSON.stringify(withoutKey(value, "manifestSha256")))
      !== value.manifestSha256
  ) {
    throw new TypeError("Audio enhancement manifest digest is invalid");
  }
  return value;
}

export async function validateAudioEnhancementReport(value, manifest) {
  assertObject(value, "Audio enhancement report");
  await validateAudioEnhancementManifest(manifest);
  if (
    value.schemaVersion !== AUDIO_ENHANCEMENT_REPORT_SCHEMA
    || value.jobId !== manifest.jobId
    || value.manifestSha256 !== manifest.manifestSha256
    || !boundedText(value.processorVersion, 240)
    || value.sourceSha256 !== manifest.qualityControl.sourceSha256
  ) {
    throw new TypeError("Audio enhancement report identity is invalid");
  }
  assertObject(value.outputs, "Audio enhancement outputs");
  const original = validateOutput(
    value.outputs.original,
    manifest.outputs.original,
    manifest.recipe.previewDurationMs
  );
  const enhanced = validateOutput(
    value.outputs.enhanced,
    manifest.outputs.enhanced,
    manifest.recipe.previewDurationMs
  );
  assertObject(value.resource, "Audio enhancement resource evidence");
  if (
    !nonNegativeInteger(value.resource.wallMs, 24 * 60 * 60 * 1_000)
    || !nonNegativeInteger(
      value.resource.maximumRssBytes,
      64 * 1024 * 1024 * 1024
    )
    || !boundedText(value.resource.ffmpegVersion, 240)
    || !boundedText(value.resource.ffprobeVersion, 240)
  ) {
    throw new TypeError("Audio enhancement resource evidence is invalid");
  }
  return {
    schemaVersion: AUDIO_ENHANCEMENT_REPORT_SCHEMA,
    jobId: value.jobId,
    manifestSha256: value.manifestSha256,
    processorVersion: value.processorVersion,
    sourceSha256: value.sourceSha256,
    outputs: { original, enhanced },
    resource: {
      wallMs: value.resource.wallMs,
      maximumRssBytes: value.resource.maximumRssBytes,
      ffmpegVersion: value.resource.ffmpegVersion,
      ffprobeVersion: value.resource.ffprobeVersion
    }
  };
}

export async function audioEnhancementReportSha256(report, manifest) {
  const validated = await validateAudioEnhancementReport(report, manifest);
  return sha256Hex(JSON.stringify(validated));
}

function validateManifestBody(value, {
  expectedHost,
  expectedBucket
} = {}) {
  if (
    value.schemaVersion !== AUDIO_ENHANCEMENT_MANIFEST_SCHEMA
    || !validIdentifier(value.jobId)
    || !validIdentifier(value.episodeId)
    || !validIdentifier(value.showId)
  ) {
    throw new TypeError("Audio enhancement manifest identity is invalid");
  }
  assertObject(value.source, "Audio enhancement source");
  const sourcePrefix =
    `podcasts/${value.showId}/${value.episodeId}/source_audio/`;
  if (
    (expectedBucket && value.source.bucketName !== expectedBucket)
    || !boundedText(value.source.bucketName, 120)
    || !safeObjectKey(value.source.objectKey)
    || !value.source.objectKey.startsWith(sourcePrefix)
    || !positiveInteger(value.source.objectBytes, MAXIMUM_SOURCE_BYTES)
    || !boundedText(value.source.etag, 240)
    || !SOURCE_MIME_TYPES.has(value.source.mimeType)
  ) {
    throw new TypeError("Audio enhancement source snapshot is invalid");
  }
  assertObject(value.qualityControl, "Audio enhancement quality control");
  if (
    !validIdentifier(value.qualityControl.runId)
    || !SHA256.test(String(value.qualityControl.reportSha256 || ""))
    || !SHA256.test(String(value.qualityControl.sourceSha256 || ""))
    || !positiveInteger(
      value.qualityControl.durationMs,
      MAXIMUM_DURATION_MS
    )
    || value.qualityControl.blockerCount !== 0
  ) {
    throw new TypeError("Audio enhancement quality control is invalid");
  }
  validateAudioEnhancementRecipe(value.recipe, {
    sourceDurationMs: value.qualityControl.durationMs
  });
  assertObject(value.outputs, "Audio enhancement output contract");
  validateOutputContract(
    value.outputs.original,
    value,
    "original"
  );
  validateOutputContract(
    value.outputs.enhanced,
    value,
    "enhanced"
  );
  let callback;
  try {
    callback = new URL(String(value.callbackUrl || ""));
  } catch {
    throw new TypeError("Audio enhancement callback URL is invalid");
  }
  if (
    callback.protocol !== "https:"
    || (expectedHost && callback.hostname !== expectedHost)
    || callback.pathname
      !== `/v1/processor/audio-enhancements/${value.jobId}/complete`
    || callback.username
    || callback.password
    || callback.port
    || callback.search
    || callback.hash
  ) {
    throw new TypeError("Audio enhancement callback URL is invalid");
  }
}

function validateOutputContract(value, manifest, kind) {
  assertObject(value, `Audio enhancement ${kind} output`);
  const expectedPrefix =
    `podcasts/${manifest.showId}/${manifest.episodeId}/`
    + `audio_enhancement/${manifest.jobId}/`;
  if (
    !safeObjectKey(value.objectKey)
    || !value.objectKey.startsWith(expectedPrefix)
    || !value.objectKey.endsWith(`-${kind}.mp3`)
    || value.mimeType !== "audio/mpeg"
  ) {
    throw new TypeError(
      `Audio enhancement ${kind} output contract is invalid`
    );
  }
}

function validateOutput(value, contract, expectedDurationMs) {
  assertObject(value, "Audio enhancement output");
  if (
    value.objectKey !== contract.objectKey
    || !positiveInteger(value.objectBytes, 200 * 1024 * 1024)
    || !SHA256.test(String(value.sha256 || ""))
    || value.mimeType !== contract.mimeType
    || !positiveInteger(value.durationMs, MAXIMUM_PREVIEW_MS + 2_000)
    || Math.abs(value.durationMs - expectedDurationMs) > 1_000
  ) {
    throw new TypeError("Audio enhancement output is invalid");
  }
  return {
    objectKey: value.objectKey,
    objectBytes: value.objectBytes,
    sha256: value.sha256,
    mimeType: value.mimeType,
    durationMs: value.durationMs
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

function boundedInteger(value, minimum, maximum) {
  return Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum;
}

function boundedNumber(value, minimum, maximum) {
  return typeof value === "number"
    && Number.isFinite(value)
    && value >= minimum
    && value <= maximum;
}

function deepFreeze(value) {
  Object.freeze(value);
  Object.values(value).forEach((entry) => {
    if (entry && typeof entry === "object" && !Object.isFrozen(entry)) {
      deepFreeze(entry);
    }
  });
  return value;
}
