import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CAPTION_SEGMENTATION_POLICY,
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

test("segments provider timing into deterministic readable caption cues", () => {
  const segments = [
    { start: 0, end: 0.2, text: "A" },
    { start: 0.2, end: 4, text: "very short opening phrase." },
    {
      start: 4,
      end: 16,
      text: "This deliberately long segment contains enough words to require "
        + "a deterministic split without changing the provider text at all."
    },
    {
      start: 16,
      end: 18,
      text: "This compressed provider segment would otherwise exceed the "
        + "reading-speed gate."
    },
    {
      start: 18,
      end: 24,
      text: "A slower neighboring segment provides safe timing for a balanced "
        + "caption boundary."
    }
  ];
  const options = {
    language: "en",
    durationMs: 24_000,
    captionPolicy: DEFAULT_CAPTION_SEGMENTATION_POLICY
  };
  const first = normalizeSegmentTranscription({ segments }, options);
  const second = normalizeSegmentTranscription({ segments }, options);

  assert.deepEqual(first, second);
  assert.equal(
    compactText(first.cues.map(({ textMarkdown }) => textMarkdown).join(" ")),
    compactText(segments.map(({ text }) => text).join(" "))
  );
  assert.equal(first.cues[0].startsAtMs, 0);
  assert.equal(first.cues.at(-1).endsAtMs, 24_000);
  for (const [index, cue] of first.cues.entries()) {
    const durationMs = cue.endsAtMs - cue.startsAtMs;
    assert.ok(durationMs >= 500);
    assert.ok(durationMs <= 10_000);
    assert.ok(cue.textMarkdown.length <= 160);
    assert.ok(
      cue.textMarkdown.length / (durationMs / 1_000) <= 25
    );
    assert.equal(cue.id, `cue_${String(index + 1).padStart(6, "0")}`);
    if (index > 0) {
      assert.ok(cue.startsAtMs >= first.cues[index - 1].endsAtMs);
    }
  }
});

test("rejects incomplete or unsafe caption segmentation policies", () => {
  assert.throws(() => normalizeSegmentTranscription({
    segments: [{ start: 0, end: 1, text: "Safe caption" }]
  }, {
    language: "en",
    durationMs: 1_000,
    captionPolicy: {
      ...DEFAULT_CAPTION_SEGMENTATION_POLICY,
      maximumCharactersPerSecond: 0
    }
  }), /maximumCharactersPerSecond is invalid/);
});

function compactText(value) {
  return value.replace(/\s+/g, " ").trim();
}
