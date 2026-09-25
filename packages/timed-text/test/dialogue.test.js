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
  assert.deepEqual(reflowDialogueCues(input, {
    durationMs: 15_000,
    boundaryDecisions: [{ afterCueIndex: 0, action: "merge" }]
  }), input);
});

test("applies advisory boundary decisions without bypassing hard bounds", () => {
  const input = [
    cue(0, 1_000, "A complete thought."),
    cue(1_100, 2_000, "Another complete thought."),
  ];

  assert.deepEqual(reflowDialogueCues(input, {
    durationMs: 3_000,
    boundaryDecisions: [{ afterCueIndex: 0, action: "merge" }]
  }), [cue(0, 2_000, "A complete thought. Another complete thought.")]);
  assert.deepEqual(reflowDialogueCues([
    cue(0, 500, "A fragment"),
    cue(600, 1_500, "that would normally merge."),
  ], {
    durationMs: 2_000,
    boundaryDecisions: [{ afterCueIndex: 0, action: "keep" }]
  }), [
    cue(0, 500, "A fragment"),
    cue(600, 1_500, "that would normally merge."),
  ]);
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
  assert.throws(() => reflowDialogueCues([
    ...input,
    cue(1_100, 1_900, "Another safe cue."),
  ], {
    durationMs: 2_000,
    boundaryDecisions: [{ afterCueIndex: 0, action: "rewrite" }]
  }), /boundary decision 1/);
});

test("looks ahead before a greedy merge strands a short ending at a hard limit", () => {
  for (const [input, policy] of [
    [[cue(0, 400, "Please keep"), cue(400, 800, "the words"), cue(800, 1200, "together.")],
      { ...DEFAULT_DIALOGUE_REFLOW_POLICY, orphanWordCount: 1, targetWordsPerCue: 3, maximumWordsPerCue: 4 }],
    [[cue(0, 400, "Keep our"), cue(400, 800, "words"), cue(800, 1200, "together.")],
      { ...DEFAULT_DIALOGUE_REFLOW_POLICY, orphanWordCount: 1, maximumCharactersPerCue: 20 }],
    [[cue(0, 400, "Please keep"), cue(400, 800, "the words"), cue(800, 1200, "together.")],
      { ...DEFAULT_DIALOGUE_REFLOW_POLICY, orphanWordCount: 1, maximumCueDurationMs: 1000 }]
  ]) {
    const snapshot = structuredClone(input);
    const output = reflowDialogueCues(input, { durationMs: 1200, policy });
    assert.deepEqual(output, [input[0], { ...input[1], endsAtMs: 1200,
      textMarkdown: input[1].textMarkdown + " " + input[2].textMarkdown }]);
    assert.deepEqual(input, snapshot);
  }
});

test("orphan avoidance preserves explicit keeps, pauses, speakers and short openings", () => {
  const policy = { ...DEFAULT_DIALOGUE_REFLOW_POLICY, orphanWordCount: 1, targetWordsPerCue: 3, maximumWordsPerCue: 4 };
  const input = [cue(0, 400, "Please keep"), cue(400, 800, "the words"), cue(800, 1200, "together.")];
  for (const [cues, boundaryDecisions] of [
    [input, [{ afterCueIndex: 1, action: "keep" }]],
    [[...input.slice(0, 2), { ...input[2], speakerLabel: "speaker-02" }], []],
    [[...input.slice(0, 2), { ...input[2], startsAtMs: 1800, endsAtMs: 2200 }], []]
  ]) {
    const output = reflowDialogueCues(cues, { durationMs: 2200, policy, boundaryDecisions });
    assert.deepEqual(output.map((row) => row.textMarkdown), ["Please keep the words", "together."]);
    assert.deepEqual(output.at(-1), cues.at(-1));
  }
  const opening = [cue(0, 400, "Please"), cue(400, 800, "keep all these words"), cue(800, 1200, "together.")];
  assert.deepEqual(reflowDialogueCues(opening, { durationMs: 1200,
    policy: { ...policy, maximumWordsPerCue: 5 } }).map((row) => row.textMarkdown),
    ["Please keep all these words", "together."]);
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
