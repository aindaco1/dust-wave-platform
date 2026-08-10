import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CAPTION_SEGMENTATION_POLICY,
  DEFAULT_TIMED_WORD_GROUPING_POLICY,
  groupTimedWords,
  normalizeEnglishEditorialWords,
  normalizeSegmentTranscription
} from "../src/transcription.js";

test("normalizes conservative English editorial forms with source spans", () => {
  const result = normalizeEnglishEditorialWords([
    "in", "twenty", "twenty", "four,", "i", "said", "i'm", "ready.",
    "there", "were", "twenty", "four", "people."
  ]);

  assert.deepEqual(result, [
    { text: "In", sourceStartIndex: 0, sourceEndIndex: 0 },
    { text: "2024,", sourceStartIndex: 1, sourceEndIndex: 3 },
    { text: "I", sourceStartIndex: 4, sourceEndIndex: 4 },
    { text: "said", sourceStartIndex: 5, sourceEndIndex: 5 },
    { text: "I'm", sourceStartIndex: 6, sourceEndIndex: 6 },
    { text: "ready.", sourceStartIndex: 7, sourceEndIndex: 7 },
    { text: "There", sourceStartIndex: 8, sourceEndIndex: 8 },
    { text: "were", sourceStartIndex: 9, sourceEndIndex: 9 },
    { text: "twenty", sourceStartIndex: 10, sourceEndIndex: 10 },
    { text: "four", sourceStartIndex: 11, sourceEndIndex: 11 },
    { text: "people.", sourceStartIndex: 12, sourceEndIndex: 12 }
  ]);
});

test("normalizes supported year forms but leaves ambiguous short numbers alone", () => {
  assert.deepEqual(
    normalizeEnglishEditorialWords([
      "nineteen", "ninety", "nine;", "two", "thousand", "and", "four,",
      "twenty", "oh", "five.", "twenty", "five", "items."
    ]).map(({ text }) => text),
    ["1999;", "2004,", "2005.", "Twenty", "five", "items."]
  );
});

test("sentence capitalization preserves established mixed-case words", () => {
  assert.deepEqual(
    normalizeEnglishEditorialWords(["iphone", "works.", "iPhone", "works."])
      .map(({ text }) => text),
    ["Iphone", "works.", "iPhone", "works."]
  );
});

test("groups timed words deterministically without an avoidable singleton tail", () => {
  const words = Array.from({ length: 13 }, (_, index) => ({
    text: `word${index + 1}`,
    startsAtMs: index * 220,
    endsAtMs: index * 220 + 160
  }));
  const policy = {
    ...DEFAULT_TIMED_WORD_GROUPING_POLICY,
    minimumWordsPerCue: 3,
    targetWordsPerCue: 5,
    maximumWordsPerCue: 6,
    maximumCandidateWords: 6
  };

  const first = groupTimedWords(words, { durationMs: 4_000, policy });
  const second = groupTimedWords(words, { durationMs: 4_000, policy });

  assert.deepEqual(first, second);
  assert.ok(first.every(({ textMarkdown }) => textMarkdown.split(" ").length > 1));
  assert.equal(
    first.map(({ textMarkdown }) => textMarkdown).join(" "),
    words.map(({ text }) => text).join(" ")
  );
});

test("honors pauses and explicit speaker boundaries while grouping", () => {
  const cues = groupTimedWords([
    { text: "One", startsAtMs: 0, endsAtMs: 200 },
    { text: "short", startsAtMs: 240, endsAtMs: 440 },
    { text: "thought", startsAtMs: 480, endsAtMs: 700 },
    { text: "New", startsAtMs: 760, endsAtMs: 930, boundaryBefore: true },
    { text: "speaker.", startsAtMs: 970, endsAtMs: 1_200 },
    { text: "After", startsAtMs: 2_100, endsAtMs: 2_300 },
    { text: "a", startsAtMs: 2_340, endsAtMs: 2_430 },
    { text: "pause.", startsAtMs: 2_470, endsAtMs: 2_700 }
  ], {
    durationMs: 3_000,
    policy: DEFAULT_TIMED_WORD_GROUPING_POLICY
  });

  assert.deepEqual(cues.map(({ textMarkdown }) => textMarkdown), [
    "One short thought",
    "New speaker.",
    "After a pause."
  ]);
});

test("rejects unsafe editorial words and incomplete grouping policies", () => {
  assert.throws(
    () => normalizeEnglishEditorialWords(["safe", "bad\u202evalue"]),
    /word 2 is invalid/
  );
  assert.throws(() => groupTimedWords([
    { text: "Safe", startsAtMs: 0, endsAtMs: 100 }
  ], {
    durationMs: 100,
    policy: { ...DEFAULT_TIMED_WORD_GROUPING_POLICY, maximumCandidateWords: 0 }
  }), /maximumCandidateWords is invalid/);
});

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
