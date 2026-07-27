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
const MAXIMUM_PEAK_LENGTH = 8_192;
const RECOMMENDED_PART_BYTES = 32 * 1024 * 1024;

export const DELIVERY_AUDIO_PROFILE =
  "mp3-44100-stereo-cbr128-frame-v1";
export const DELIVERY_AUDIO_MANIFEST_SCHEMA =
  "podcast-delivery-audio-job-v1";
export const DELIVERY_AUDIO_REPORT_SCHEMA =
  "podcast-delivery-audio-report-v1";
export const PLAYER_PEAKS_SCHEMA = "dustwave-player-peaks-v1";

export async function buildDeliveryAudioManifest(body) {
  const candidate = { ...body };
  delete candidate.manifestSha256;
  validateManifestBody(candidate);
  return {
    ...candidate,
    manifestSha256: await sha256Hex(JSON.stringify(candidate))
  };
}

export async function validateDeliveryAudioManifest(
  value,
  { expectedHost, expectedBucket } = {}
) {
  assertObject(value, "Delivery-audio manifest");
  validateManifestBody(value, { expectedHost, expectedBucket });
  if (
    !SHA256.test(String(value.manifestSha256 || ""))
    || await sha256Hex(JSON.stringify(withoutKey(value, "manifestSha256")))
      !== value.manifestSha256
  ) {
    throw new TypeError("Delivery-audio manifest digest is invalid");
  }
  return value;
}

export function validatePlayerPeaksDocument(value) {
  assertObject(value, "Player peaks document");
  if (
    value.schemaVersion !== PLAYER_PEAKS_SCHEMA
    || value.version !== 2
    || value.channels !== 1
    || value.sample_rate !== 16_000
    || !positiveInteger(value.samples_per_pixel, 16_000 * 60)
    || value.bits !== 8
    || !positiveInteger(value.length, MAXIMUM_PEAK_LENGTH)
    || !Array.isArray(value.data)
    || value.data.length !== value.length * 2
    || value.data.some((sample) =>
      !Number.isInteger(sample) || sample < -128 || sample > 127
    )
  ) {
    throw new TypeError("Player peaks document is invalid");
  }
  return {
    schemaVersion: PLAYER_PEAKS_SCHEMA,
    version: 2,
    channels: 1,
    sample_rate: 16_000,
    samples_per_pixel: value.samples_per_pixel,
    bits: 8,
    length: value.length,
    data: [...value.data]
  };
}

export async function playerPeaksSha256(value) {
  return sha256Hex(JSON.stringify(validatePlayerPeaksDocument(value)));
}

export async function validateDeliveryAudioReport(value, manifest) {
  assertObject(value, "Delivery-audio report");
  await validateDeliveryAudioManifest(manifest);
  if (
    value.schemaVersion !== DELIVERY_AUDIO_REPORT_SCHEMA
    || value.jobId !== manifest.jobId
    || value.manifestSha256 !== manifest.manifestSha256
    || !boundedText(value.processorVersion, 240)
    || value.sourceSha256 !== manifest.source.sha256
  ) {
    throw new TypeError("Delivery-audio report identity is invalid");
  }
  const audio = validateAudioOutput(value.audio, manifest);
  const peaks = validatePeaksEvidence(value.peaks, manifest);
  assertObject(value.resource, "Delivery-audio resource evidence");
  if (
    !nonNegativeInteger(value.resource.wallMs, 24 * 60 * 60 * 1_000)
    || !nonNegativeInteger(
      value.resource.maximumRssBytes,
      64 * 1024 * 1024 * 1024
    )
    || !boundedText(value.resource.ffmpegVersion, 240)
    || !boundedText(value.resource.ffprobeVersion, 240)
  ) {
    throw new TypeError("Delivery-audio resource evidence is invalid");
  }
  return {
    schemaVersion: DELIVERY_AUDIO_REPORT_SCHEMA,
    jobId: value.jobId,
    manifestSha256: value.manifestSha256,
    processorVersion: value.processorVersion,
    sourceSha256: value.sourceSha256,
    audio,
    peaks,
    resource: {
      wallMs: value.resource.wallMs,
      maximumRssBytes: value.resource.maximumRssBytes,
      ffmpegVersion: value.resource.ffmpegVersion,
      ffprobeVersion: value.resource.ffprobeVersion
    }
  };
}

export async function deliveryAudioReportSha256(report, manifest) {
  return sha256Hex(JSON.stringify(
    await validateDeliveryAudioReport(report, manifest)
  ));
}

function validateManifestBody(value, {
  expectedHost,
  expectedBucket
} = {}) {
  if (
    value.schemaVersion !== DELIVERY_AUDIO_MANIFEST_SCHEMA
    || !validIdentifier(value.jobId)
    || !validIdentifier(value.episodeId)
    || !validIdentifier(value.showId)
  ) {
    throw new TypeError("Delivery-audio manifest identity is invalid");
  }
  assertObject(value.source, "Delivery-audio source");
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
    throw new TypeError("Delivery-audio source snapshot is invalid");
  }
  assertObject(value.profile, "Delivery-audio profile");
  if (
    value.profile.id !== DELIVERY_AUDIO_PROFILE
    || value.profile.codec !== "mp3"
    || value.profile.sampleRateHz !== 44_100
    || value.profile.channels !== 2
    || value.profile.bitrateKbps !== 128
    || value.profile.writeXing !== false
  ) {
    throw new TypeError("Delivery-audio profile is invalid");
  }
  validateOutputContract(value.output, value);
  validatePeaksContract(value.peaks, value);
  validateEndpoints(value.endpoints, value, expectedHost);
}

function validateOutputContract(value, manifest) {
  assertObject(value, "Delivery-audio output contract");
  const expectedPrefix =
    `podcasts/${manifest.showId}/${manifest.episodeId}/`
    + `delivery_audio/${manifest.jobId}/`;
  if (
    !safeObjectKey(value.objectKey)
    || !value.objectKey.startsWith(expectedPrefix)
    || !value.objectKey.endsWith(`/${manifest.jobId}.mp3`)
    || value.mimeType !== "audio/mpeg"
    || value.recommendedPartBytes !== RECOMMENDED_PART_BYTES
  ) {
    throw new TypeError("Delivery-audio output contract is invalid");
  }
}

function validatePeaksContract(value, manifest) {
  assertObject(value, "Player peaks output contract");
  const expectedPrefix =
    `podcasts/${manifest.showId}/${manifest.episodeId}/`
    + `delivery_audio/${manifest.jobId}/`;
  if (
    value.schemaVersion !== PLAYER_PEAKS_SCHEMA
    || !safeObjectKey(value.objectKey)
    || !value.objectKey.startsWith(expectedPrefix)
    || !value.objectKey.endsWith(`/${manifest.jobId}-peaks.json`)
    || value.mimeType !== "application/json"
    || value.maximumLength !== MAXIMUM_PEAK_LENGTH
  ) {
    throw new TypeError("Player peaks output contract is invalid");
  }
}

function validateEndpoints(value, manifest, expectedHost) {
  assertObject(value, "Delivery-audio endpoints");
  const basePath = `/v1/processor/delivery-audio-jobs/${manifest.jobId}`;
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
      throw new TypeError("Delivery-audio endpoint is invalid");
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
      throw new TypeError("Delivery-audio endpoint is invalid");
    }
  }
}

function validateAudioOutput(value, manifest) {
  assertObject(value, "Delivery-audio output");
  const durationTolerance = Math.max(
    1_000,
    Math.round(manifest.source.durationMs * 0.005)
  );
  if (
    value.objectKey !== manifest.output.objectKey
    || !positiveInteger(value.objectBytes, MAXIMUM_OUTPUT_BYTES)
    || !SHA256.test(String(value.sha256 || ""))
    || value.mimeType !== "audio/mpeg"
    || !positiveInteger(value.durationMs, MAXIMUM_DURATION_MS + 1_000)
    || Math.abs(value.durationMs - manifest.source.durationMs)
      > durationTolerance
    || value.streamProfile !== DELIVERY_AUDIO_PROFILE
    || value.audioCodec !== "mp3"
    || value.sampleRateHz !== 44_100
    || value.channels !== 2
    || value.bitrateKbps !== 128
    || !positiveInteger(value.frameBytes, MAXIMUM_OUTPUT_BYTES)
    || value.frameBytes !== value.objectBytes
    || !positiveInteger(value.frameCount, 2_000_000)
    || Math.abs(
      Math.round((value.frameCount * 1_152 * 1_000) / 44_100)
      - value.durationMs
    ) > 1
    || value.id3v2Bytes !== 0
    || value.id3v1Bytes !== 0
    || value.fullyDecoded !== true
  ) {
    throw new TypeError("Delivery-audio output is invalid");
  }
  return {
    objectKey: value.objectKey,
    objectBytes: value.objectBytes,
    sha256: value.sha256,
    mimeType: "audio/mpeg",
    durationMs: value.durationMs,
    streamProfile: DELIVERY_AUDIO_PROFILE,
    audioCodec: "mp3",
    sampleRateHz: 44_100,
    channels: 2,
    bitrateKbps: 128,
    frameBytes: value.frameBytes,
    frameCount: value.frameCount,
    id3v2Bytes: 0,
    id3v1Bytes: 0,
    fullyDecoded: true
  };
}

function validatePeaksEvidence(value, manifest) {
  assertObject(value, "Player peaks evidence");
  if (
    value.objectKey !== manifest.peaks.objectKey
    || value.schemaVersion !== PLAYER_PEAKS_SCHEMA
    || !SHA256.test(String(value.sha256 || ""))
    || !positiveInteger(value.objectBytes, 125_000)
    || value.mimeType !== "application/json"
    || value.channels !== 1
    || value.sampleRateHz !== 16_000
    || !positiveInteger(value.samplesPerPixel, 16_000 * 60)
    || value.bits !== 8
    || !positiveInteger(value.length, MAXIMUM_PEAK_LENGTH)
    || value.dataPointCount !== value.length * 2
  ) {
    throw new TypeError("Player peaks evidence is invalid");
  }
  return {
    objectKey: value.objectKey,
    schemaVersion: PLAYER_PEAKS_SCHEMA,
    sha256: value.sha256,
    objectBytes: value.objectBytes,
    mimeType: "application/json",
    channels: 1,
    sampleRateHz: 16_000,
    samplesPerPixel: value.samplesPerPixel,
    bits: 8,
    length: value.length,
    dataPointCount: value.dataPointCount
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
