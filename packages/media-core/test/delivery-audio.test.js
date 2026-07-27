import assert from "node:assert/strict";
import test from "node:test";

import {
  DELIVERY_AUDIO_PROFILE,
  DELIVERY_AUDIO_REPORT_SCHEMA,
  buildDeliveryAudioManifest,
  deliveryAudioReportSha256,
  playerPeaksSha256,
  validateDeliveryAudioManifest,
  validateDeliveryAudioReport,
  validatePlayerPeaksDocument
} from "../src/delivery-audio.js";

const ORIGIN = "https://dust-wave-podcast-staging.jogo.workers.dev";

async function manifest() {
  const jobId = "delivery_123";
  const base = `${ORIGIN}/v1/processor/delivery-audio-jobs/${jobId}`;
  return buildDeliveryAudioManifest({
    schemaVersion: "podcast-delivery-audio-job-v1",
    jobId,
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
    profile: {
      id: DELIVERY_AUDIO_PROFILE,
      codec: "mp3",
      sampleRateHz: 44_100,
      channels: 2,
      bitrateKbps: 128,
      writeXing: false
    },
    output: {
      objectKey:
        `podcasts/show_123/episode_123/delivery_audio/${jobId}/`
        + `${jobId}.mp3`,
      mimeType: "audio/mpeg",
      recommendedPartBytes: 32 * 1024 * 1024
    },
    peaks: {
      objectKey:
        `podcasts/show_123/episode_123/delivery_audio/${jobId}/`
        + `${jobId}-peaks.json`,
      schemaVersion: "dustwave-player-peaks-v1",
      mimeType: "application/json",
      maximumLength: 8_192
    },
    endpoints: {
      source: `${base}/source`,
      partTemplate: `${base}/parts/{partNumber}`,
      uploadComplete: `${base}/upload-complete`,
      evidenceComplete: `${base}/complete`
    }
  });
}

function peaks() {
  return {
    schemaVersion: "dustwave-player-peaks-v1",
    version: 2,
    channels: 1,
    sample_rate: 16_000,
    samples_per_pixel: 4_000,
    bits: 8,
    length: 2,
    data: [-10, 20, -30, 40]
  };
}

test("binds normalized delivery audio and peaks to one master", async () => {
  const value = await manifest();
  assert.match(value.manifestSha256, /^[a-f0-9]{64}$/);
  assert.equal(
    await validateDeliveryAudioManifest(value, {
      expectedHost: "dust-wave-podcast-staging.jogo.workers.dev",
      expectedBucket: "dustwave-media-staging"
    }),
    value
  );
  await assert.rejects(
    validateDeliveryAudioManifest({
      ...value,
      profile: { ...value.profile, bitrateKbps: 192 }
    }),
    /profile/
  );
});

test("validates bounded WaveSurfer-compatible peaks", async () => {
  assert.deepEqual(validatePlayerPeaksDocument(peaks()), peaks());
  assert.match(await playerPeaksSha256(peaks()), /^[a-f0-9]{64}$/);
  assert.throws(
    () => validatePlayerPeaksDocument({
      ...peaks(),
      data: [-129, 20, -30, 40]
    }),
    /peaks/
  );
});

test("validates exact render and reusable peaks evidence", async () => {
  const job = await manifest();
  const peaksDocument = peaks();
  const peaksText = JSON.stringify(peaksDocument);
  const report = {
    schemaVersion: DELIVERY_AUDIO_REPORT_SCHEMA,
    jobId: job.jobId,
    manifestSha256: job.manifestSha256,
    processorVersion: "dustwave-delivery-audio-1",
    sourceSha256: job.source.sha256,
    audio: {
      objectKey: job.output.objectKey,
      objectBytes: 960_000,
      sha256: "b".repeat(64),
      mimeType: "audio/mpeg",
      durationMs: 60_003,
      streamProfile: DELIVERY_AUDIO_PROFILE,
      audioCodec: "mp3",
      sampleRateHz: 44_100,
      channels: 2,
      bitrateKbps: 128,
      frameBytes: 960_000,
      frameCount: 2_297,
      id3v2Bytes: 0,
      id3v1Bytes: 0,
      fullyDecoded: true
    },
    peaks: {
      objectKey: job.peaks.objectKey,
      schemaVersion: "dustwave-player-peaks-v1",
      sha256: await playerPeaksSha256(peaksDocument),
      objectBytes: new TextEncoder().encode(peaksText).byteLength,
      mimeType: "application/json",
      channels: 1,
      sampleRateHz: 16_000,
      samplesPerPixel: peaksDocument.samples_per_pixel,
      bits: 8,
      length: peaksDocument.length,
      dataPointCount: peaksDocument.data.length
    },
    resource: {
      wallMs: 2_000,
      maximumRssBytes: 128_000_000,
      ffmpegVersion: "ffmpeg version 8.1.1",
      ffprobeVersion: "ffprobe version 8.1.1"
    }
  };
  assert.deepEqual(
    await validateDeliveryAudioReport(report, job),
    report
  );
  assert.match(
    await deliveryAudioReportSha256(report, job),
    /^[a-f0-9]{64}$/
  );
});
