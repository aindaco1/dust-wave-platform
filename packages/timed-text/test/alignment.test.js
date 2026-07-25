import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAlignmentTranscriptProjection,
  buildAlignmentProcessorManifest,
  canonicalAlignmentSha256,
  MAXIMUM_ALIGNMENT_RESULT_BYTES,
  validateAlignmentProcessorManifest,
  validateAlignmentRunnerResult
} from "../src/alignment.js";

const adapter = {
  name: "whisperx",
  version: "3.8.6",
  model: "default",
  modelVersion: "default-en-es-v1",
  settingsVersion: "align-v1",
  runnerDigest: `sha256:${"a".repeat(64)}`
};

test("builds deterministic bilingual lexical words from reviewed cues", async () => {
  const projection = await buildProjection();
  assert.equal(projection.wordCount, 5);
  assert.deepEqual(
    projection.cues.flatMap((cue) => cue.words.map(({ text }) => text)),
    ["Ópera", "en", "la", "Selva", "can't"]
  );
  assert.match(projection.projectionSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(projection, await buildProjection());
});

test("validates exact runner identity, timing, and canonical digest", async () => {
  const projection = await buildProjection();
  const candidateWords = projection.cues.flatMap((cue) =>
    cue.words.map((word, index) => ({
      wordId: word.wordId,
      cueId: cue.cueId,
      text: word.text,
      startsAtMs: cue.startsAtMs + index * 100,
      endsAtMs: cue.startsAtMs + index * 100 + 80,
      confidence: 0.95,
      timingOrigin: "forced_alignment",
      unalignedReason: null
    }))
  );
  const manifest = {
    schemaVersion: "2",
    jobId: "alignment_job_fixture",
    alignmentRevisionId: "alignment_revision_fixture",
    language: "es",
    sourceAudioSha256: "b".repeat(64),
    transcriptContentSha256: projection.contentSha256,
    transcriptProjectionSha256: projection.projectionSha256,
    adapter,
    candidateWords,
    projectionIssues: [],
    resource: {
      inputDurationMinutes: 0.05,
      wallClockMinutes: 0.01,
      peakMemoryMb: 120,
      runner: "python-3.12"
    }
  };
  const value = {
    manifest,
    manifestSha256: await canonicalAlignmentSha256(manifest)
  };
  const validated = await validateAlignmentRunnerResult(value, {
    jobId: "alignment_job_fixture",
    alignmentRevisionId: "alignment_revision_fixture",
    sourceAudioSha256: "b".repeat(64),
    sourceDurationMs: 3_000,
    projection,
    adapter
  });
  assert.equal(validated.quality.alignedWordCount, 5);
  assert.equal(validated.quality.structurallyEligible, true);

  value.manifest.candidateWords[0].wordId = "word_changed";
  await assert.rejects(
    validateAlignmentRunnerResult(value, {
      jobId: "alignment_job_fixture",
      alignmentRevisionId: "alignment_revision_fixture",
      sourceAudioSha256: "b".repeat(64),
      sourceDurationMs: 3_000,
      projection,
      adapter
    }),
    /candidate word/
  );
});

test("retains explained omissions but never passes interpolated timing", async () => {
  const projection = await buildAlignmentTranscriptProjection({
    transcriptId: "transcript_fixture",
    contentSha256: "c".repeat(64),
    language: "en",
    cues: [{
      id: "cue_1",
      startsAtMs: 0,
      endsAtMs: 60_000,
      textMarkdown: "one two three four"
    }]
  });
  const candidateWords = projection.cues[0].words.map((word, index) => ({
    wordId: word.wordId,
    cueId: "cue_1",
    text: word.text,
    startsAtMs: index === 3 ? null : index * 500,
    endsAtMs: index === 3 ? null : index * 500 + 400,
    confidence: index === 3 ? null : 0.9,
    timingOrigin: index === 3
      ? null
      : index === 2
        ? "interpolated"
        : "forced_alignment",
    unalignedReason: index === 3 ? "adapter_omitted_word" : null
  }));
  const manifest = {
    schemaVersion: "2",
    jobId: "alignment_job_fixture",
    alignmentRevisionId: "alignment_revision_fixture",
    language: "en",
    sourceAudioSha256: "d".repeat(64),
    transcriptContentSha256: projection.contentSha256,
    transcriptProjectionSha256: projection.projectionSha256,
    adapter,
    candidateWords,
    projectionIssues: [],
    resource: {
      inputDurationMinutes: 1,
      wallClockMinutes: 0.1,
      peakMemoryMb: 100,
      runner: "python-3.12"
    }
  };
  const result = await validateAlignmentRunnerResult({
    manifest,
    manifestSha256: await canonicalAlignmentSha256(manifest)
  }, {
    jobId: "alignment_job_fixture",
    alignmentRevisionId: "alignment_revision_fixture",
    sourceAudioSha256: "d".repeat(64),
    sourceDurationMs: 60_000,
    projection,
    adapter
  });
  assert.equal(result.quality.interpolatedWordCount, 1);
  assert.equal(result.quality.unalignedWordCount, 1);
  assert.equal(result.quality.structurallyEligible, false);
});

test("binds staging processor URLs, source, projection, and runner revision", async () => {
  const projection = await buildProjection();
  const manifest = await buildAlignmentProcessorManifest({
    schemaVersion: "alignment-processor-v1",
    processorVersion: "dustwave-alignment-workflow-v1",
    jobId: "alignment_job_fixture",
    alignmentRevisionId: "alignment_revision_fixture",
    episodeId: "episode_fixture",
    showId: "show_fixture",
    transcriptId: "transcript_fixture",
    workingMasterId: "master_fixture",
    language: "es",
    source: {
      objectKey: "podcasts/show_fixture/episode_fixture/source.wav",
      objectBytes: 20_000_000,
      etag: "source-etag",
      mimeType: "audio/wav",
      sha256: "b".repeat(64),
      durationMs: 3_000
    },
    transcript: projection,
    adapter,
    runner: {
      repository: "aindaco1/dust-wave-alignment-runner",
      revision: "c".repeat(40)
    },
    output: {
      maximumResultBytes: MAXIMUM_ALIGNMENT_RESULT_BYTES
    },
    sourceUrl:
      "https://podcast-staging.example/v1/processor/alignments/job/source",
    callbackUrl:
      "https://podcast-staging.example/v1/processor/alignments/job/complete"
  });
  assert.deepEqual(
    await validateAlignmentProcessorManifest(manifest, {
      expectedHost: "podcast-staging.example",
      expectedRunnerRevision: "c".repeat(40)
    }),
    manifest
  );
  await assert.rejects(
    validateAlignmentProcessorManifest({
      ...manifest,
      sourceUrl: "https://attacker.example/source"
    }, {
      expectedHost: "podcast-staging.example"
    }),
    /digest|host/
  );
});

function buildProjection() {
  return buildAlignmentTranscriptProjection({
    transcriptId: "transcript_fixture",
    contentSha256: "c".repeat(64),
    language: "es",
    cues: [
      {
        id: "cue_1",
        startsAtMs: 0,
        endsAtMs: 1_500,
        textMarkdown: "¡<u>Ópera</u> en la Selva!"
      },
      {
        id: "cue_2",
        startsAtMs: 1_500,
        endsAtMs: 3_000,
        textMarkdown: "**can't**"
      }
    ]
  });
}
