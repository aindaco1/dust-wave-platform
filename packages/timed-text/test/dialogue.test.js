import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DIALOGUE_REFLOW_POLICY, reflowDialogueCues
} from "../src/dialogue.js";

function cue(startsAtMs, endsAtMs, textMarkdown, speakerLabel = "speaker-01") {
  return { startsAtMs, endsAtMs, textMarkdown, speakerLabel };
}

test("reflows bounded same-speaker fragments without mutating the source", () => {
  const input = [
    cue(0, 800, "Because we"),
    cue(900, 2_400, "just got hit by KOB four."),
    cue(2_600, 4_200, "That was the largest station."),
  ];
  const snapshot = structuredClone(input);

  assert.deepEqual(reflowDialogueCues(input, { durationMs: 5_000 }), [
    cue(0, 4_200, "Because we just got hit by KOB four. That was the largest station."),
  ]);
  assert.deepEqual(input, snapshot);
});

test("preserves speaker changes, long pauses, and readability bounds", () => {
  const input = [
    cue(0, 1_000, "Are you ready?", "speaker-01"),
    cue(1_050, 1_800, "Yes, I am.", "speaker-02"),
    cue(3_000, 4_000, "After a long pause", "speaker-02"),
    cue(4_050, 14_000, "this complete thought contains enough words to exceed the safe duration bound.", "speaker-02"),
  ];

  assert.deepEqual(reflowDialogueCues(input, { durationMs: 15_000 }), input);
});

test("rejects unknown fields and invalid injected policies", () => {
  const input = [cue(0, 1_000, "Safe text.")];
  assert.throws(() => reflowDialogueCues([
    { ...input[0], unsafe: true }
  ], { durationMs: 2_000 }), /cue 1/);
  assert.throws(() => reflowDialogueCues(input, {
    durationMs: 2_000,
    policy: { ...DEFAULT_DIALOGUE_REFLOW_POLICY, maximumMergeGapMs: -1 }
  }), /maximumMergeGapMs/);
});

test("reflows the maximum cue count in one bounded pass", () => {
  const input = Array.from({ length: 10_000 }, (_, index) => (
    cue(index * 2, index * 2 + 1, `word${index}`)
  ));
  const result = reflowDialogueCues(input, { durationMs: 20_000 });

  assert.ok(result.length < input.length / 10);
  assert.equal(
    result.reduce((count, item) => count + item.textMarkdown.split(" ").length, 0),
    input.length
  );
});
