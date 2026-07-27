import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDIO_ENHANCEMENT_DERIVATIVE_REPORT_SCHEMA,
  audioEnhancementDerivativeReportSha256,
  buildAudioEnhancementDerivativeManifest,
  validateAudioEnhancementDerivativeManifest,
  validateAudioEnhancementDerivativeRecipe,
  validateAudioEnhancementDerivativeReport
} from "../src/audio-enhancement-derivative.js";

const ORIGIN = "https://dust-wave-podcast-staging.jogo.workers.dev";

async function manifest() {
  const jobId = "derivative_123";
  const base = `${ORIGIN}/v1/processor/audio-enhancement-derivatives/${jobId}`;
  return buildAudioEnhancementDerivativeManifest({
    schemaVersion: "audio-enhancement-derivative-job-v1",
    jobId,
    selectedPreviewId: "preview_123",
    episodeId: "episode_123",
    showId: "show_123",
    source: {
      workingMasterId: "master_123",
      bucketName: "dustwave-media-staging",
      objectKey:
        "podcasts/show_123/episode_123/source_audio/source.flac",
      objectBytes: 12_345,
      etag: "\"etag-123\"",
      mimeType: "audio/flac",
      sha256: "a".repeat(64),
      durationMs: 60_000
    },
    qualityControl: {
      runId: "qc_123",
      reportSha256: "b".repeat(64),
      blockerCount: 0
    },
    selection: {
      previewManifestSha256: "c".repeat(64),
      previewReportSha256: "d".repeat(64),
      previewEnhancedSha256: "e".repeat(64)
    },
    recipe: {
      schemaVersion: "audio-enhancement-derivative-recipe-v1",
      presetId: "dialogue-gentle-v1",
      targetIntegratedLufs: -19,
      maximumTruePeakDbtp: -1
    },
    output: {
      objectKey:
        "podcasts/show_123/episode_123/audio_enhancement_derivatives/"
        + `${jobId}/${jobId}.mp3`,
      mimeType: "audio/mpeg",
      recommendedPartBytes: 32 * 1024 * 1024
    },
    endpoints: {
      source: `${base}/source`,
      partTemplate: `${base}/parts/{partNumber}`,
      uploadComplete: `${base}/upload-complete`,
      evidenceComplete: `${base}/complete`
    }
  });
}

test("binds a full-length render to master, QC, and preview evidence", async () => {
  const value = await manifest();
  assert.match(value.manifestSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    await validateAudioEnhancementDerivativeManifest(value, {
      expectedHost: "dust-wave-podcast-staging.jogo.workers.dev",
      expectedBucket: "dustwave-media-staging"
    }),
    value
  );
  await assert.rejects(
    validateAudioEnhancementDerivativeManifest({
      ...value,
      selection: {
        ...value.selection,
        previewEnhancedSha256: "f".repeat(64)
      }
    }),
    /digest/
  );
});

test("allows only curated full-length recipes", () => {
  assert.deepEqual(
    validateAudioEnhancementDerivativeRecipe({
      schemaVersion: "audio-enhancement-derivative-recipe-v1",
      presetId: "loudness-only-v1",
      targetIntegratedLufs: -19,
      maximumTruePeakDbtp: -1
    }),
    {
      schemaVersion: "audio-enhancement-derivative-recipe-v1",
      presetId: "loudness-only-v1",
      targetIntegratedLufs: -19,
      maximumTruePeakDbtp: -1
    }
  );
  assert.throws(
    () => validateAudioEnhancementDerivativeRecipe({
      schemaVersion: "audio-enhancement-derivative-recipe-v1",
      presetId: "shell-filter",
      targetIntegratedLufs: -19,
      maximumTruePeakDbtp: -1
    }),
    /recipe/
  );
});

test("validates exact output and stable renderer evidence", async () => {
  const job = await manifest();
  const report = {
    schemaVersion: AUDIO_ENHANCEMENT_DERIVATIVE_REPORT_SCHEMA,
    jobId: job.jobId,
    manifestSha256: job.manifestSha256,
    processorVersion: "dustwave-audio-enhancement-derivative-1",
    sourceSha256: job.source.sha256,
    output: {
      objectKey: job.output.objectKey,
      objectBytes: 1_440_000,
      sha256: "f".repeat(64),
      mimeType: "audio/mpeg",
      durationMs: 60_000,
      audioCodec: "mp3",
      sampleRateHz: 48_000,
      fullyDecoded: true
    },
    resource: {
      wallMs: 2_000,
      maximumRssBytes: 128_000_000,
      ffmpegVersion: "ffmpeg version 8.1.1",
      ffprobeVersion: "ffprobe version 8.1.1"
    }
  };
  assert.deepEqual(
    await validateAudioEnhancementDerivativeReport(report, job),
    report
  );
  assert.match(
    await audioEnhancementDerivativeReportSha256(report, job),
    /^[a-f0-9]{64}$/
  );
  await assert.rejects(
    validateAudioEnhancementDerivativeReport({
      ...report,
      output: { ...report.output, fullyDecoded: false }
    }, job),
    /output/
  );
});
