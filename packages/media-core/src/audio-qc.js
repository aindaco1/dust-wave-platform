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
const FINDING_ORDER = Object.freeze([
  "duration_too_long",
  "unsupported_channel_count",
  "low_sample_rate",
  "integrated_loudness",
  "true_peak",
  "clipping",
  "dc_offset",
  "channel_imbalance",
  "leading_silence",
  "trailing_silence",
  "internal_silence"
]);

export const AUDIO_QC_POLICY_SCHEMA = "audio-qc-policy-v1";
export const AUDIO_QC_MANIFEST_SCHEMA = "audio-qc-job-v1";
export const AUDIO_QC_REPORT_SCHEMA = "audio-qc-report-v1";

export const DEFAULT_AUDIO_QC_POLICY = deepFreeze({
  schemaVersion: AUDIO_QC_POLICY_SCHEMA,
  revision: 1,
  monoIntegratedLufs: -19,
  stereoIntegratedLufs: -16,
  integratedLufsTolerance: 1,
  maximumTruePeakDbtp: -1,
  maximumDcOffset: 0.01,
  maximumChannelImbalanceLu: 2,
  maximumLeadingSilenceMs: 2_000,
  maximumTrailingSilenceMs: 3_000,
  maximumInternalSilenceMs: 5_000,
  silenceThresholdDb: -50
});

export function validateAudioQcPolicy(value) {
  assertObject(value, "Audio QC policy");
  const policy = {
    schemaVersion: value.schemaVersion,
    revision: value.revision,
    monoIntegratedLufs: value.monoIntegratedLufs,
    stereoIntegratedLufs: value.stereoIntegratedLufs,
    integratedLufsTolerance: value.integratedLufsTolerance,
    maximumTruePeakDbtp: value.maximumTruePeakDbtp,
    maximumDcOffset: value.maximumDcOffset,
    maximumChannelImbalanceLu: value.maximumChannelImbalanceLu,
    maximumLeadingSilenceMs: value.maximumLeadingSilenceMs,
    maximumTrailingSilenceMs: value.maximumTrailingSilenceMs,
    maximumInternalSilenceMs: value.maximumInternalSilenceMs,
    silenceThresholdDb: value.silenceThresholdDb
  };
  if (
    policy.schemaVersion !== AUDIO_QC_POLICY_SCHEMA
    || !positiveInteger(policy.revision)
    || !boundedNumber(policy.monoIntegratedLufs, -40, -5)
    || !boundedNumber(policy.stereoIntegratedLufs, -40, -5)
    || !boundedNumber(policy.integratedLufsTolerance, 0.1, 10)
    || !boundedNumber(policy.maximumTruePeakDbtp, -12, 0)
    || !boundedNumber(policy.maximumDcOffset, 0, 0.25)
    || !boundedNumber(policy.maximumChannelImbalanceLu, 0, 24)
    || !nonNegativeInteger(policy.maximumLeadingSilenceMs, 60_000)
    || !nonNegativeInteger(policy.maximumTrailingSilenceMs, 60_000)
    || !nonNegativeInteger(policy.maximumInternalSilenceMs, 120_000)
    || !boundedNumber(policy.silenceThresholdDb, -100, -10)
  ) {
    throw new TypeError("Audio QC policy is invalid");
  }
  return policy;
}

export async function buildAudioQcManifest(body) {
  const candidate = { ...body };
  delete candidate.manifestSha256;
  validateAudioQcManifestBody(candidate);
  return {
    ...candidate,
    manifestSha256: await sha256Hex(canonicalJson(candidate))
  };
}

export async function validateAudioQcManifest(value, {
  expectedHost,
  expectedBucket
} = {}) {
  assertObject(value, "Audio QC manifest");
  validateAudioQcManifestBody(value, { expectedHost, expectedBucket });
  if (
    !SHA256.test(String(value.manifestSha256 || ""))
    || await sha256Hex(canonicalJson(withoutKey(value, "manifestSha256")))
      !== value.manifestSha256
  ) {
    throw new TypeError("Audio QC manifest digest is invalid");
  }
  return value;
}

export function evaluateAudioQcMeasurements(measurementsValue, policyValue) {
  const measurements = validateMeasurements(measurementsValue);
  const policy = validateAudioQcPolicy(policyValue);
  const targetIntegratedLufs = measurements.channels === 1
    ? policy.monoIntegratedLufs
    : policy.stereoIntegratedLufs;
  const findings = [];
  if (measurements.durationMs > MAXIMUM_DURATION_MS) {
    findings.push(finding({
      code: "duration_too_long",
      severity: "blocker",
      measured: measurements.durationMs,
      limit: MAXIMUM_DURATION_MS,
      unit: "ms",
      remediation: "Split or replace the source before processing."
    }));
  }
  if (measurements.channels > 2) {
    findings.push(finding({
      code: "unsupported_channel_count",
      severity: "blocker",
      measured: measurements.channels,
      limit: 2,
      unit: "channels",
      remediation: "Approve an explicit mono or stereo mixdown."
    }));
  }
  if (measurements.sampleRateHz < 44_100) {
    findings.push(finding({
      code: "low_sample_rate",
      severity: "warning",
      measured: measurements.sampleRateHz,
      limit: 44_100,
      unit: "Hz",
      remediation: "Review the source quality before creating derivatives."
    }));
  }
  if (
    Math.abs(measurements.integratedLufs - targetIntegratedLufs)
      > policy.integratedLufsTolerance
  ) {
    findings.push(finding({
      code: "integrated_loudness",
      severity: "warning",
      measured: measurements.integratedLufs,
      limit: targetIntegratedLufs,
      unit: "LUFS",
      remediation: "Compare a loudness-normalized preview before approval."
    }));
  }
  if (measurements.truePeakDbtp > policy.maximumTruePeakDbtp) {
    findings.push(finding({
      code: "true_peak",
      severity: "warning",
      measured: measurements.truePeakDbtp,
      limit: policy.maximumTruePeakDbtp,
      unit: "dBTP",
      remediation: "Use a true-peak limiter and remeasure the derivative."
    }));
  }
  if (measurements.clippedSamples > 0) {
    findings.push(finding({
      code: "clipping",
      severity: "warning",
      measured: measurements.clippedSamples,
      limit: 0,
      unit: "samples",
      remediation: "Inspect the reported peaks and replace or repair the source."
    }));
  }
  if (Math.abs(measurements.dcOffset) > policy.maximumDcOffset) {
    findings.push(finding({
      code: "dc_offset",
      severity: "warning",
      measured: measurements.dcOffset,
      limit: policy.maximumDcOffset,
      unit: "ratio",
      remediation: "Apply a high-pass/DC-removal pass and compare the result."
    }));
  }
  if (
    measurements.channelImbalanceLu !== null
    && measurements.channelImbalanceLu > policy.maximumChannelImbalanceLu
  ) {
    findings.push(finding({
      code: "channel_imbalance",
      severity: "warning",
      measured: measurements.channelImbalanceLu,
      limit: policy.maximumChannelImbalanceLu,
      unit: "LU",
      remediation: "Review channel routing and approve a balanced mix."
    }));
  }
  const silence = measurements.silence;
  if (silence.leadingMs > policy.maximumLeadingSilenceMs) {
    findings.push(finding({
      code: "leading_silence",
      severity: "warning",
      startMs: 0,
      endMs: silence.leadingMs,
      measured: silence.leadingMs,
      limit: policy.maximumLeadingSilenceMs,
      unit: "ms",
      remediation: "Trim intentionally or retain with an editorial reason."
    }));
  }
  if (silence.trailingMs > policy.maximumTrailingSilenceMs) {
    findings.push(finding({
      code: "trailing_silence",
      severity: "warning",
      startMs: measurements.durationMs - silence.trailingMs,
      endMs: measurements.durationMs,
      measured: silence.trailingMs,
      limit: policy.maximumTrailingSilenceMs,
      unit: "ms",
      remediation: "Trim intentionally or retain with an editorial reason."
    }));
  }
  if (
    silence.longestInternalMs !== null
    && silence.longestInternalMs > policy.maximumInternalSilenceMs
  ) {
    const region = silence.regions.find(
      ({ kind, durationMs }) =>
        kind === "internal" && durationMs === silence.longestInternalMs
    );
    findings.push(finding({
      code: "internal_silence",
      severity: "warning",
      startMs: region?.startMs,
      endMs: region?.endMs,
      measured: silence.longestInternalMs,
      limit: policy.maximumInternalSilenceMs,
      unit: "ms",
      remediation: "Review the pause in context before editing."
    }));
  }
  findings.sort(
    (left, right) =>
      FINDING_ORDER.indexOf(left.code) - FINDING_ORDER.indexOf(right.code)
  );
  const blockerCount = findings.filter(
    ({ severity }) => severity === "blocker"
  ).length;
  const warningCount = findings.length - blockerCount;
  return {
    targetIntegratedLufs,
    blockerCount,
    warningCount,
    passed: blockerCount === 0,
    findings
  };
}

export async function validateAudioQcReport(value, manifest) {
  assertObject(value, "Audio QC report");
  await validateAudioQcManifest(manifest);
  if (
    value.schemaVersion !== AUDIO_QC_REPORT_SCHEMA
    || value.runId !== manifest.runId
    || value.manifestSha256 !== manifest.manifestSha256
    || !boundedText(value.processorVersion, 240)
    || !SHA256.test(String(value.sourceSha256 || ""))
  ) {
    throw new TypeError("Audio QC report identity is invalid");
  }
  const measurements = validateMeasurements(value.measurements);
  const expected = evaluateAudioQcMeasurements(measurements, manifest.policy);
  if (canonicalJson(value.quality) !== canonicalJson(expected)) {
    throw new TypeError("Audio QC report findings do not match measurements");
  }
  assertObject(value.resource, "Audio QC resource evidence");
  if (
    !nonNegativeInteger(value.resource.wallMs, 24 * 60 * 60 * 1_000)
    || !nonNegativeInteger(value.resource.maximumRssBytes, 64 * 1024 * 1024 * 1024)
    || !boundedText(value.resource.ffmpegVersion, 240)
    || !boundedText(value.resource.ffprobeVersion, 240)
  ) {
    throw new TypeError("Audio QC resource evidence is invalid");
  }
  return {
    schemaVersion: AUDIO_QC_REPORT_SCHEMA,
    runId: value.runId,
    manifestSha256: value.manifestSha256,
    processorVersion: value.processorVersion,
    sourceSha256: value.sourceSha256,
    measurements,
    quality: expected,
    resource: {
      wallMs: value.resource.wallMs,
      maximumRssBytes: value.resource.maximumRssBytes,
      ffmpegVersion: value.resource.ffmpegVersion,
      ffprobeVersion: value.resource.ffprobeVersion
    }
  };
}

export async function audioQcReportSha256(report, manifest) {
  const validated = await validateAudioQcReport(report, manifest);
  return sha256Hex(canonicalJson(validated));
}

function validateAudioQcManifestBody(value, {
  expectedHost,
  expectedBucket
} = {}) {
  if (
    value.schemaVersion !== AUDIO_QC_MANIFEST_SCHEMA
    || !validIdentifier(value.runId)
    || !validIdentifier(value.episodeId)
    || !validIdentifier(value.showId)
  ) {
    throw new TypeError("Audio QC manifest identity is invalid");
  }
  assertObject(value.source, "Audio QC source");
  const expectedPrefix =
    `podcasts/${value.showId}/${value.episodeId}/source_audio/`;
  if (
    (expectedBucket && value.source.bucketName !== expectedBucket)
    || !boundedText(value.source.bucketName, 120)
    || !safeObjectKey(value.source.objectKey)
    || !value.source.objectKey.startsWith(expectedPrefix)
    || !positiveInteger(value.source.objectBytes, MAXIMUM_SOURCE_BYTES)
    || !boundedText(value.source.etag, 240)
    || !SOURCE_MIME_TYPES.has(value.source.mimeType)
  ) {
    throw new TypeError("Audio QC source snapshot is invalid");
  }
  validateAudioQcPolicy(value.policy);
  let callback;
  try {
    callback = new URL(String(value.callbackUrl || ""));
  } catch {
    throw new TypeError("Audio QC callback URL is invalid");
  }
  if (
    callback.protocol !== "https:"
    || (expectedHost && callback.hostname !== expectedHost)
    || callback.pathname !== `/v1/processor/audio-qc/${value.runId}/complete`
    || callback.username
    || callback.password
    || callback.port
    || callback.search
    || callback.hash
  ) {
    throw new TypeError("Audio QC callback URL is invalid");
  }
}

function validateMeasurements(value) {
  assertObject(value, "Audio QC measurements");
  assertObject(value.silence, "Audio QC silence measurements");
  if (
    !positiveInteger(value.durationMs, MAXIMUM_DURATION_MS * 2)
    || !boundedText(value.codec, 80)
    || !boundedText(value.container, 120)
    || !positiveInteger(value.sampleRateHz, 768_000)
    || (
      value.bitDepth !== null
      && !positiveInteger(value.bitDepth, 64)
    )
    || !positiveInteger(value.channels, 32)
    || !boundedText(value.channelLayout, 120)
    || !nonNegativeInteger(value.averageBitrateBps, 100_000_000)
    || !boundedNumber(value.integratedLufs, -100, 10)
    || !boundedNumber(value.loudnessRangeLu, 0, 100)
    || !boundedNumber(value.truePeakDbtp, -100, 10)
    || !boundedNumber(value.samplePeakDbfs, -100, 10)
    || !nonNegativeInteger(value.clippedSamples, Number.MAX_SAFE_INTEGER)
    || !boundedNumber(value.dcOffset, -1, 1)
    || (
      value.channelImbalanceLu !== null
      && !boundedNumber(value.channelImbalanceLu, 0, 100)
    )
    || !nonNegativeInteger(value.silence.leadingMs, value.durationMs)
    || !nonNegativeInteger(value.silence.trailingMs, value.durationMs)
    || (
      value.silence.longestInternalMs !== null
      && !nonNegativeInteger(
        value.silence.longestInternalMs,
        value.durationMs
      )
    )
    || !Array.isArray(value.silence.regions)
    || value.silence.regions.length > 2_000
  ) {
    throw new TypeError("Audio QC measurements are invalid");
  }
  let previousEnd = 0;
  const regions = value.silence.regions.map((region) => {
    assertObject(region, "Audio QC silence region");
    if (
      !["leading", "internal", "trailing", "entire"].includes(region.kind)
      || !nonNegativeInteger(region.startMs, value.durationMs)
      || !positiveInteger(region.endMs, value.durationMs)
      || region.endMs <= region.startMs
      || region.startMs < previousEnd
      || region.durationMs !== region.endMs - region.startMs
    ) {
      throw new TypeError("Audio QC silence region is invalid");
    }
    previousEnd = region.endMs;
    return {
      kind: region.kind,
      startMs: region.startMs,
      endMs: region.endMs,
      durationMs: region.durationMs
    };
  });
  return {
    durationMs: value.durationMs,
    codec: value.codec,
    container: value.container,
    sampleRateHz: value.sampleRateHz,
    bitDepth: value.bitDepth,
    channels: value.channels,
    channelLayout: value.channelLayout,
    averageBitrateBps: value.averageBitrateBps,
    integratedLufs: value.integratedLufs,
    loudnessRangeLu: value.loudnessRangeLu,
    truePeakDbtp: value.truePeakDbtp,
    samplePeakDbfs: value.samplePeakDbfs,
    clippedSamples: value.clippedSamples,
    dcOffset: value.dcOffset,
    channelImbalanceLu: value.channelImbalanceLu,
    silence: {
      leadingMs: value.silence.leadingMs,
      trailingMs: value.silence.trailingMs,
      longestInternalMs: value.silence.longestInternalMs,
      regions
    }
  };
}

function finding({
  code,
  severity,
  startMs,
  endMs,
  measured,
  limit,
  unit,
  remediation
}) {
  return {
    code,
    severity,
    startMs: startMs ?? null,
    endMs: endMs ?? null,
    measured,
    limit,
    unit,
    remediation
  };
}

function canonicalJson(value) {
  return JSON.stringify(value);
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

function deepFreeze(value) {
  Object.freeze(value);
  Object.values(value).forEach((entry) => {
    if (entry && typeof entry === "object" && !Object.isFrozen(entry)) {
      deepFreeze(entry);
    }
  });
  return value;
}
