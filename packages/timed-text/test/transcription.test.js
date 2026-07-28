import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeSegmentTranscription
} from "../src/transcription.js";

test("normalizes provider segments into deterministic bilingual artifacts", () => {
  const result = normalizeSegmentTranscription({
    text: "Belleza y alegría. Beauty and joy.",
    words: [{ word: "Belleza", start: 0, end: 0.4 }],
    segments: [
      { start: 0, end: 1.25, text: " Belleza y alegría. " },
      {
        start: 1.25,
        end: 2.5,
        text: "Beauty <script> and joy.\u202e"
      }
    ]
  }, {
    language: "es",
    durationMs: 2_500
  });

  assert.equal(result.schemaVersion, "timed-text-v1");
  assert.equal(result.timingPrecision, "segment");
  assert.deepEqual(result.cues, [
    {
      id: "cue_000001",
      startsAtMs: 0,
      endsAtMs: 1_250,
      speakerLabel: "",
      speakerConfirmed: false,
      textMarkdown: "Belleza y alegría."
    },
    {
      id: "cue_000002",
      startsAtMs: 1_250,
      endsAtMs: 2_500,
      speakerLabel: "",
      speakerConfirmed: false,
      textMarkdown: "Beauty ‹script› and joy."
    }
  ]);
  assert.match(result.webVtt, /00:00:01\.250 --> 00:00:02\.500/);
  assert.match(result.srt, /00:00:01,250 --> 00:00:02,500/);
  assert.equal(
    result.plainText,
    "Belleza y alegría.\nBeauty ‹script› and joy."
  );
  assert.equal("words" in result.cues[0], false);
});

test("rejects missing, overlapping, oversized, and out-of-range segments", () => {
  assert.throws(
    () => normalizeSegmentTranscription(
      { segments: [] },
      { language: "es", durationMs: 1_000 }
    ),
    /no bounded segments/
  );
  assert.throws(
    () => normalizeSegmentTranscription({
      segments: [
        { start: 0, end: 1, text: "Uno" },
        { start: 0.999, end: 2, text: "Dos" }
      ]
    }, {
      language: "es",
      durationMs: 2_000
    }),
    /timing is invalid/
  );
  assert.throws(
    () => normalizeSegmentTranscription({
      segments: [{ start: 0, end: 3, text: "Too long" }]
    }, {
      language: "en",
      durationMs: 2_000
    }),
    /timing is invalid/
  );
  assert.throws(
    () => normalizeSegmentTranscription({
      segments: [{ start: 0, end: 1, text: "x".repeat(2_001) }]
    }, {
      language: "en",
      durationMs: 1_000
    }),
    /missing or too long/
  );
});
