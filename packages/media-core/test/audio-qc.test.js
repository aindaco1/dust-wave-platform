import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDIO_QC_REPORT_SCHEMA,
  audioQcReportSha256,
  buildAudioQcManifest,
  DEFAULT_AUDIO_QC_POLICY,
  evaluateAudioQcMeasurements,
  validateAudioQcManifest,
  validateAudioQcPolicy,
  validateAudioQcReport
} from "../src/audio-qc.js";

const measurements = {
  durationMs: 60_000,
  codec: "flac",
  container: "flac",
  sampleRateHz: 48_000,
  bitDepth: 24,
  channels: 1,
  channelLayout: "mono",
  averageBitrateBps: 768_000,
  integratedLufs: -19,
  loudnessRangeLu: 4.2,
  truePeakDbtp: -2,
  samplePeakDbfs: -2.1,
  clippedSamples: 0,
  dcOffset: 0.001,
  channelImbalanceLu: null,
  silence: {
    leadingMs: 500,
    trailingMs: 750,
    longestInternalMs: null,
    regions: [
      {
        kind: "leading",
        startMs: 0,
        endMs: 500,
        durationMs: 500
      },
      {
        kind: "trailing",
        startMs: 59_250,
        endMs: 60_000,
        durationMs: 750
      }
    ]
  }
};

async function manifest() {
  return buildAudioQcManifest({
    schemaVersion: "audio-qc-job-v1",
    runId: "qc_123",
    episodeId: "episode_123",
    showId: "show_123",
    source: {
      bucketName: "dustwave-media-staging",
      objectKey:
        "podcasts/show_123/episode_123/source_audio/upload_123-source.flac",
      objectBytes: 12_345,
      etag: "\"etag-123\"",
      mimeType: "audio/flac"
    },
    policy: { ...DEFAULT_AUDIO_QC_POLICY },
    callbackUrl:
      "https://dust-wave-podcast-staging.jogo.workers.dev/"
      + "v1/processor/audio-qc/qc_123/complete"
  });
}

test("builds and validates an exact isolated-staging manifest", async () => {
  const value = await manifest();
  assert.match(value.manifestSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    await validateAudioQcManifest(value, {
      expectedHost: "dust-wave-podcast-staging.jogo.workers.dev",
      expectedBucket: "dustwave-media-staging"
    }),
    value
  );
  await assert.rejects(
    validateAudioQcManifest(
      {
        ...value,
        source: { ...value.source, objectBytes: 12_346 }
      },
      {
        expectedHost: "dust-wave-podcast-staging.jogo.workers.dev",
        expectedBucket: "dustwave-media-staging"
      }
    ),
    /digest/
  );
});

test("accepts only the exact immutable enhancement derivative path", async () => {
  const value = await manifest();
  const derivativeId = "derivative_123";
  const derivativeKey =
    "podcasts/show_123/episode_123/audio_enhancement_derivatives/"
    + `${derivativeId}/${derivativeId}.mp3`;
  const derivative = await buildAudioQcManifest({
    ...value,
    source: {
      ...value.source,
      objectKey: derivativeKey,
      mimeType: "audio/mpeg"
    }
  });

  assert.equal(derivative.source.objectKey, derivativeKey);
  await assert.rejects(
    buildAudioQcManifest({
      ...value,
      source: {
        ...value.source,
        objectKey:
          "podcasts/show_123/episode_123/"
          + "audio_enhancement_derivatives/derivative_123/other.mp3",
        mimeType: "audio/mpeg"
      }
    }),
    /source snapshot/
  );
});

test("rejects unsafe source paths, callbacks, and policy values", async () => {
  const value = await manifest();
  await assert.rejects(
    buildAudioQcManifest({
      ...value,
      source: { ...value.source, objectKey: "../secret.flac" }
    }),
    /source snapshot/
  );
  await assert.rejects(
    buildAudioQcManifest({
      ...value,
      callbackUrl: "https://example.com/v1/processor/audio-qc/qc_123/complete"
    }).then((candidate) =>
      validateAudioQcManifest(candidate, {
        expectedHost: "dust-wave-podcast-staging.jogo.workers.dev"
      })
    ),
    /callback/
  );
  assert.throws(
    () => validateAudioQcPolicy({
      ...DEFAULT_AUDIO_QC_POLICY,
      maximumTruePeakDbtp: 1
    }),
    /policy/
  );
});

test("evaluates clean mono measurements deterministically", () => {
  assert.deepEqual(
    evaluateAudioQcMeasurements(measurements, DEFAULT_AUDIO_QC_POLICY),
    {
      targetIntegratedLufs: -19,
      blockerCount: 0,
      warningCount: 0,
      passed: true,
      findings: []
    }
  );
});

test("reports bounded ordered warnings and blockers", () => {
  const result = evaluateAudioQcMeasurements(
    {
      ...measurements,
      sampleRateHz: 22_050,
      channels: 3,
      channelLayout: "3.0",
      integratedLufs: -10,
      truePeakDbtp: 0.2,
      samplePeakDbfs: 0,
      clippedSamples: 12,
      dcOffset: 0.05,
      channelImbalanceLu: 4,
      silence: {
        leadingMs: 3_000,
        trailingMs: 4_000,
        longestInternalMs: 8_000,
        regions: [
          {
            kind: "leading",
            startMs: 0,
            endMs: 3_000,
            durationMs: 3_000
          },
          {
            kind: "internal",
            startMs: 20_000,
            endMs: 28_000,
            durationMs: 8_000
          },
          {
            kind: "trailing",
            startMs: 56_000,
            endMs: 60_000,
            durationMs: 4_000
          }
        ]
      }
    },
    DEFAULT_AUDIO_QC_POLICY
  );
  assert.equal(result.blockerCount, 1);
  assert.equal(result.warningCount, 9);
  assert.equal(result.passed, false);
  assert.deepEqual(
    result.findings.map(({ code }) => code),
    [
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
    ]
  );
});

test("validates report identity, findings, and a stable digest", async () => {
  const job = await manifest();
  const report = {
    schemaVersion: AUDIO_QC_REPORT_SCHEMA,
    runId: job.runId,
    manifestSha256: job.manifestSha256,
    processorVersion: "dustwave-audio-qc-1",
    sourceSha256: "a".repeat(64),
    measurements,
    quality: evaluateAudioQcMeasurements(
      measurements,
      DEFAULT_AUDIO_QC_POLICY
    ),
    resource: {
      wallMs: 2_000,
      maximumRssBytes: 128_000_000,
      ffmpegVersion: "ffmpeg version 8.1.1",
      ffprobeVersion: "ffprobe version 8.1.1"
    }
  };
  assert.deepEqual(await validateAudioQcReport(report, job), report);
  assert.match(await audioQcReportSha256(report, job), /^[a-f0-9]{64}$/);
  await assert.rejects(
    validateAudioQcReport({
      ...report,
      quality: { ...report.quality, warningCount: 1 }
    }, job),
    /findings/
  );
});
