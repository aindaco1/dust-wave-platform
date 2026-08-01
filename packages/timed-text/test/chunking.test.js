import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTranscriptionChunkProcessorManifest,
  DEFAULT_TRANSCRIPTION_CHUNK_POLICY,
  MAXIMUM_TRANSCRIPTION_CHUNK_BYTES,
  mergeChunkTranscriptions,
  planTranscriptionChunks,
  validateTranscriptionChunkPlan,
  validateTranscriptionChunkProcessorManifest
} from "../src/chunking.js";
import {
  DEFAULT_CAPTION_SEGMENTATION_POLICY
} from "../src/transcription.js";

test("plans bounded chunks at the closest safe silence with overlap", () => {
  const plan = planTranscriptionChunks({
    sourceDurationMs: 28 * 60_000,
    silenceWindows: [
      { startsAtMs: 11 * 60_000, endsAtMs: 11 * 60_000 + 2_000 },
      { startsAtMs: 23 * 60_000, endsAtMs: 23 * 60_000 + 1_000 }
    ]
  });
  assert.equal(plan.chunks.length, 3);
  assert.deepEqual(plan.chunks[0], {
    index: 0,
    coreStartsAtMs: 0,
    coreEndsAtMs: 661_000,
    mediaStartsAtMs: 0,
    mediaEndsAtMs: 662_500,
    boundaryKind: "silence"
  });
  assert.equal(plan.chunks[1].mediaStartsAtMs, 659_500);
  assert.equal(plan.chunks[2].coreEndsAtMs, 28 * 60_000);
  assert.equal(plan.chunks[2].boundaryKind, "end");
  assert.deepEqual(
    validateTranscriptionChunkPlan(plan),
    plan
  );
});

test("falls back deterministically when no silence is safe", () => {
  const plan = planTranscriptionChunks({
    sourceDurationMs: 16 * 60_000,
    silenceWindows: []
  });
  assert.deepEqual(
    plan.chunks.map(({ coreStartsAtMs, coreEndsAtMs, boundaryKind }) => ({
      coreStartsAtMs,
      coreEndsAtMs,
      boundaryKind
    })),
    [
      {
        coreStartsAtMs: 0,
        coreEndsAtMs: 12 * 60_000,
        boundaryKind: "duration"
      },
      {
        coreStartsAtMs: 12 * 60_000,
        coreEndsAtMs: 16 * 60_000,
        boundaryKind: "end"
      }
    ]
  );
});

test("merges overlap by core ownership and conservative token dedupe", () => {
  const sourceDurationMs = 16 * 60_000;
  const plan = planTranscriptionChunks({
    sourceDurationMs,
    silenceWindows: []
  });
  const evidence = plan.chunks.map((chunk, index) => ({
      plan: {
        silenceWindows: plan.silenceWindows,
        chunk
      },
      response: index === 0
        ? {
            segments: [
              { start: 710, end: 715, text: "Una historia empieza." },
              {
                start: 715,
                end: 721.5,
                text: "La selva canta esta noche."
              }
            ]
          }
        : {
            segments: [
              {
                start: 0,
                end: 4,
                text: "La selva canta esta noche con nosotros."
              },
              { start: 4, end: 10, text: "Fin." }
            ]
          }
    }));
  const result = mergeChunkTranscriptions(
    evidence,
    {
      language: "es",
      sourceDurationMs
    }
  );
  assert.deepEqual(
    result.transcription.cues.map(({ textMarkdown }) => textMarkdown),
    [
      "Una historia empieza.",
      "La selva canta esta noche.",
      "con nosotros.",
      "Fin."
    ]
  );
  assert.equal(result.evidence.chunkCount, 2);
  assert.equal(result.evidence.deduplicatedTokenCount, 5);
  assert.equal(result.transcription.cues.at(-1).endsAtMs, 728_500);

  const captionResult = mergeChunkTranscriptions(evidence, {
    language: "es",
    sourceDurationMs,
    captionPolicy: DEFAULT_CAPTION_SEGMENTATION_POLICY
  });
  assert.equal(captionResult.evidence.deduplicatedTokenCount, 5);
  for (const cue of captionResult.transcription.cues) {
    const durationMs = cue.endsAtMs - cue.startsAtMs;
    assert.ok(durationMs >= 500);
    assert.ok(durationMs <= 10_000);
    assert.ok(cue.textMarkdown.length / (durationMs / 1_000) <= 25);
  }
});

test("rejects mutated plans and incomplete chunk evidence", () => {
  const plan = planTranscriptionChunks({
    sourceDurationMs: 16 * 60_000,
    silenceWindows: []
  });
  assert.throws(
    () => validateTranscriptionChunkPlan({
      ...plan,
      chunks: [{ ...plan.chunks[0], coreEndsAtMs: 700_000 }]
    }),
    /not deterministic/
  );
  assert.throws(
    () => mergeChunkTranscriptions([{
      plan: {
        silenceWindows: plan.silenceWindows,
        chunk: plan.chunks[0]
      },
      response: { segments: [{ start: 0, end: 1, text: "Hi" }] }
    }], {
      language: "en",
      sourceDurationMs: plan.sourceDurationMs,
      policy: DEFAULT_TRANSCRIPTION_CHUNK_POLICY
    }),
    /not deterministic|incomplete/
  );
});

test("builds a digest-bound staging processor manifest", async () => {
  const manifest = await buildTranscriptionChunkProcessorManifest({
    schemaVersion: "transcription-chunk-processor-v1",
    processorVersion: "ffmpeg-transcription-chunker-v1",
    runId: "chunks_fixture",
    jobId: "transcription_fixture",
    episodeId: "episode_fixture",
    showId: "show_fixture",
    workingMasterId: "master_fixture",
    language: "es",
    source: {
      objectKey: "podcasts/show_fixture/episode_fixture/source.wav",
      objectBytes: 25_000_000,
      etag: "\"source-etag\"",
      mimeType: "audio/wav",
      sha256: "a".repeat(64),
      durationMs: 1_200_000
    },
    policy: DEFAULT_TRANSCRIPTION_CHUNK_POLICY,
    output: {
      keyPrefix:
        "podcasts/show_fixture/episode_fixture/transcription/"
        + "transcription_fixture/chunk-audio",
      mimeType: "audio/mpeg",
      maximumObjectBytes: MAXIMUM_TRANSCRIPTION_CHUNK_BYTES,
      uploadUrlTemplate:
        "https://staging.example/v1/processor/chunks/{index}"
    },
    sourceUrl: "https://staging.example/v1/processor/source",
    callbackUrl: "https://staging.example/v1/processor/complete"
  });
  assert.match(manifest.manifestSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    await validateTranscriptionChunkProcessorManifest(manifest, {
      expectedHost: "staging.example",
      expectedOutputKeyPrefix: manifest.output.keyPrefix
    }),
    manifest
  );
  await assert.rejects(
    validateTranscriptionChunkProcessorManifest({
      ...manifest,
      callbackUrl: "https://attacker.example/complete"
    }, {
      expectedHost: "staging.example"
    }),
    /digest|host/
  );
});
