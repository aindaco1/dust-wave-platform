import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_TIMED_TEXT_PRESENTATION_POLICY,
  planTimedTextPresentation,
  TIMED_TEXT_PRESENTATION_POLICY_VERSION
} from "../src/presentation.js";

function words(texts, {
  speaker = "speaker-01",
  sourceCueId = "cue-000001",
  start = 0,
  step = 300,
  width = 120
} = {}) {
  return texts.map((text, index) => ({
    wordId: `word-${String(index + 1).padStart(6, "0")}`,
    text,
    startsAtMs: start + index * step,
    endsAtMs: start + index * step + 220,
    speakerId: speaker,
    sourceCueId,
    displayWidth: width
  }));
}

function policy(overrides = {}) {
  return { ...DEFAULT_TIMED_TEXT_PRESENTATION_POLICY, ...overrides };
}

test("preserves every timed word while producing at most two measured lines", () => {
  const input = words([
    "This", "is", "a", "measured", "presentation", "that", "must", "remain", "readable."
  ], { width: 150 });
  const plan = planTimedTextPresentation(input, {
    durationMs: 4_000,
    policy: policy({ maximumLineWidth: 650, spaceWidth: 30 })
  });

  assert.equal(plan.policyVersion, TIMED_TEXT_PRESENTATION_POLICY_VERSION);
  assert.equal(plan.report.wordCount, input.length);
  assert.ok(plan.cues.every((cue) => cue.lineWidths.length <= 2));
  assert.ok(plan.cues.every((cue) => cue.lineWidths.every((width) => width <= 650)));
  assert.deepEqual(
    plan.cues.flatMap((cue) => input.slice(cue.wordStartIndex, cue.wordEndIndex + 1).map(({ wordId }) => wordId)),
    input.map(({ wordId }) => wordId)
  );
});

test("prefers punctuation and syntax-aware line boundaries", () => {
  const input = words(["We", "need", "three", "things:", "speed,", "trust,", "and", "clarity."], {
    width: 105
  });
  const plan = planTimedTextPresentation(input, {
    durationMs: 3_000,
    policy: policy({
      targetWordsPerCue: 8,
      maximumWordsPerCue: 8,
      maximumCandidateWords: 8,
      maximumLineWidth: 500,
      spaceWidth: 25
    })
  });

  assert.equal(plan.cues.length, 1);
  assert.deepEqual(plan.cues[0].lineBreakBeforeWordIndexes, [4]);
});

test("prefers sentence-ending questions and exclamations as visual cue boundaries", () => {
  const input = words(["Are", "we", "ready?", "Yes!", "Ship", "it."], { width: 120 });
  const plan = planTimedTextPresentation(input, {
    durationMs: 3_000,
    policy: policy({
      minimumWordsPerCue: 2,
      targetWordsPerCue: 3,
      maximumWordsPerCue: 5,
      maximumCandidateWords: 5,
      maximumLineWidth: 1_000
    })
  });

  assert.equal(plan.cues[0].wordEndIndex, 2);
});

test("never crosses speaker, explicit, or long-pause boundaries", () => {
  const input = words(["One.", "Two.", "Three.", "Four."], { step: 300 });
  input[1].speakerId = "speaker-02";
  input[2].speakerId = "speaker-02";
  input[2].boundaryBefore = true;
  input[3].speakerId = "speaker-02";
  input[3].startsAtMs = 2_000;
  input[3].endsAtMs = 2_220;
  const plan = planTimedTextPresentation(input, {
    durationMs: 3_000,
    policy: policy({ maximumLineWidth: 2_000, maximumGapMs: 500 })
  });

  assert.deepEqual(plan.cues.map(({ wordStartIndex, wordEndIndex }) => (
    [wordStartIndex, wordEndIndex]
  )), [[0, 0], [1, 1], [2, 2], [3, 3]]);
});

test("accepts an effective acoustic gap when nonvisual words remain in the timing stream", () => {
  const input = words(["Before", "after."], { step: 1_200 });
  input[1].gapBeforeMs = 250;
  const plan = planTimedTextPresentation(input, {
    durationMs: 2_000,
    policy: policy({ maximumLineWidth: 2_000, maximumGapMs: 900 })
  });

  assert.equal(plan.cues.length, 1);
});

test("reports fast, short, and overlong presentation exceptions", () => {
  const input = words(["Supercalifragilisticexpialidocious"], { width: 2_000, step: 200 });
  const plan = planTimedTextPresentation(input, {
    durationMs: 1_000,
    policy: policy({ maximumLineWidth: 500 })
  });

  assert.equal(plan.report.overlongWordCount, 1);
  assert.equal(plan.report.fastCueCount, 1);
  assert.equal(plan.report.shortCueCount, 1);
  assert.ok(plan.report.maximumLineWidth > 500);
});

test("rejects unknown fields and unsafe text or identifiers", () => {
  const input = words(["Safe."]);
  assert.throws(() => planTimedTextPresentation([
    { ...input[0], unexpected: true }
  ], { durationMs: 1_000, policy: policy() }), /word 1/);
  assert.throws(() => planTimedTextPresentation([
    { ...input[0], text: "unsafe\u202e" }
  ], { durationMs: 1_000, policy: policy() }), /word 1/);
  assert.throws(() => planTimedTextPresentation([
    { ...input[0], wordId: "../word" }
  ], { durationMs: 1_000, policy: policy() }), /word 1/);
});

test("keeps the bounded planner performant for a 10,000-word transcript", () => {
  const input = words(Array.from({ length: 10_000 }, (_, index) => (
    index % 12 === 11 ? "word." : "word"
  )), { step: 250, width: 55 });
  const started = performance.now();
  const plan = planTimedTextPresentation(input, {
    durationMs: 2_500_000,
    policy: policy({ maximumLineWidth: 800, spaceWidth: 20 })
  });
  const elapsedMs = performance.now() - started;

  assert.equal(plan.report.wordCount, 10_000);
  assert.ok(elapsedMs < 5_000, `planner took ${elapsedMs.toFixed(1)} ms`);
});
