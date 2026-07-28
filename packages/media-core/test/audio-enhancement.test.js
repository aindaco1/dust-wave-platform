import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDIO_ENHANCEMENT_REPORT_SCHEMA,
  audioEnhancementReportSha256,
  buildAudioEnhancementManifest,
  validateAudioEnhancementManifest,
  validateAudioEnhancementRecipe,
  validateAudioEnhancementReport
} from "../src/audio-enhancement.js";

async function manifest() {
  return buildAudioEnhancementManifest({
    schemaVersion: "audio-enhancement-job-v1",
    jobId: "enhance_123",
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
    qualityControl: {
      runId: "qc_123",
      reportSha256: "a".repeat(64),
      sourceSha256: "b".repeat(64),
      durationMs: 60_000,
      blockerCount: 0
    },
    recipe: {
      schemaVersion: "audio-enhancement-recipe-v1",
      presetId: "dialogue-gentle-v1",
      previewStartMs: 5_000,
      previewDurationMs: 45_000,
      targetIntegratedLufs: -19,
      maximumTruePeakDbtp: -1
    },
    outputs: {
      original: {
        objectKey:
          "podcasts/show_123/episode_123/audio_enhancement/"
          + "enhance_123/enhance_123-original.mp3",
        mimeType: "audio/mpeg"
      },
      enhanced: {
        objectKey:
          "podcasts/show_123/episode_123/audio_enhancement/"
          + "enhance_123/enhance_123-enhanced.mp3",
        mimeType: "audio/mpeg"
      }
    },
    callbackUrl:
      "https://dust-wave-podcast-staging.jogo.workers.dev/"
      + "v1/processor/audio-enhancements/enhance_123/complete"
  });
}

test("builds a digest-bound isolated-staging A/B manifest", async () => {
  const value = await manifest();
  assert.match(value.manifestSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    await validateAudioEnhancementManifest(value, {
      expectedHost: "dust-wave-podcast-staging.jogo.workers.dev",
      expectedBucket: "dustwave-media-staging"
    }),
    value
  );
  await assert.rejects(
    validateAudioEnhancementManifest({
      ...value,
      recipe: { ...value.recipe, previewDurationMs: 44_000 }
    }),
    /digest/
  );
});

test("rejects unbounded recipes and any preview past source duration", () => {
  assert.throws(
    () => validateAudioEnhancementRecipe({
      schemaVersion: "audio-enhancement-recipe-v1",
      presetId: "arbitrary-shell-filter",
      previewStartMs: 0,
      previewDurationMs: 45_000,
      targetIntegratedLufs: -19,
      maximumTruePeakDbtp: -1
    }),
    /recipe/
  );
  assert.throws(
    () => validateAudioEnhancementRecipe({
      schemaVersion: "audio-enhancement-recipe-v1",
      presetId: "loudness-only-v1",
      previewStartMs: 30_000,
      previewDurationMs: 45_000,
      targetIntegratedLufs: -19,
      maximumTruePeakDbtp: -1
    }, { sourceDurationMs: 60_000 }),
    /recipe/
  );
});

test("validates exact A/B output evidence and a stable report digest", async () => {
  const job = await manifest();
  const report = {
    schemaVersion: AUDIO_ENHANCEMENT_REPORT_SCHEMA,
    jobId: job.jobId,
    manifestSha256: job.manifestSha256,
    processorVersion: "dustwave-audio-enhancement-1",
    sourceSha256: job.qualityControl.sourceSha256,
    outputs: {
      original: {
        objectKey: job.outputs.original.objectKey,
        objectBytes: 1_000_000,
        sha256: "c".repeat(64),
        mimeType: "audio/mpeg",
        durationMs: 45_000
      },
      enhanced: {
        objectKey: job.outputs.enhanced.objectKey,
        objectBytes: 1_000_000,
        sha256: "d".repeat(64),
        mimeType: "audio/mpeg",
        durationMs: 45_000
      }
    },
    resource: {
      wallMs: 2_000,
      maximumRssBytes: 128_000_000,
      ffmpegVersion: "ffmpeg version 8.1.1",
      ffprobeVersion: "ffprobe version 8.1.1"
    }
  };
  assert.deepEqual(
    await validateAudioEnhancementReport(report, job),
    report
  );
  assert.match(
    await audioEnhancementReportSha256(report, job),
    /^[a-f0-9]{64}$/
  );
  await assert.rejects(
    validateAudioEnhancementReport({
      ...report,
      outputs: {
        ...report.outputs,
        enhanced: {
          ...report.outputs.enhanced,
          objectKey: report.outputs.original.objectKey
        }
      }
    }, job),
    /output/
  );
});
