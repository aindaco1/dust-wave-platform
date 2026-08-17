import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import {
  CHAPTER_CONTEXT_SCHEMA,
  CHAPTER_LIST_SCHEMA,
  DEFAULT_CHAPTER_CONTEXT_POLICY,
  chapterClock,
  compileChapterEntries,
  formatMarkdownChapters,
  formatYouTubeChapters,
  planChapterContext,
  validateChapterList
} from "../src/chapters.js";

function cues(count = 12, spacingMs = 15_000) {
  return Array.from({ length: count }, (_, index) => ({
    cueId: `cue_${String(index + 1).padStart(6, "0")}`,
    sourceWordId: `word_fixture_${index + 1}`,
    startsAtMs: index * spacingMs + (index === 0 ? 400 : 0),
    endsAtMs: index * spacingMs + 8_000,
    speakerId: `speaker-0${index % 2 + 1}`,
    text: `Reviewed cue ${index + 1} discusses a bounded episode topic.`
  }));
}

test("plans deterministic bounded chapter windows with supplied anchor IDs", () => {
  const source = cues(30, 20_000);
  const options = {
    durationMs: 610_000,
    mode: "questions",
    policy: {
      ...DEFAULT_CHAPTER_CONTEXT_POLICY,
      targetWindowDurationMs: 120_000,
      maximumWindowDurationMs: 180_000,
      maximumWindowCues: 8,
      maximumWindowCharacters: 800
    }
  };
  const first = planChapterContext(source, options);
  const second = planChapterContext(source, options);

  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, CHAPTER_CONTEXT_SCHEMA);
  assert.equal(first.mode, "questions");
  assert.ok(first.windows.length > 1);
  assert.equal(first.windows[0].records[0].startsAtMs, 0);
  assert.equal(first.windows[0].records[0].spokenStartsAtMs, 400);
  for (const window of first.windows) {
    assert.ok(window.records.length <= 8);
    assert.deepEqual(window.eligibleAnchorIds, window.records.map(({ anchorId }) => anchorId));
    assert.ok(window.records.reduce((sum, record) => sum + [...record.text].length, 0) <= 800);
  }
});

test("compiles supplied anchors into a strict YouTube-valid chapter list", () => {
  const context = planChapterContext(cues(), { durationMs: 180_000 });
  const entries = [0, 3, 7].map((index) => ({
    anchorId: context.windows.flatMap(({ records }) => records)[index].anchorId,
    title: ["Opening", "Production workflow", "Release and next steps"][index === 0 ? 0 : index === 3 ? 1 : 2]
  }));
  const result = compileChapterEntries(entries.reverse(), context);

  assert.equal(result.schemaVersion, CHAPTER_LIST_SCHEMA);
  assert.deepEqual(result.chapters.map(({ startsAtMs }) => startsAtMs), [0, 45_000, 105_000]);
  assert.equal(formatYouTubeChapters(result), [
    "00:00 - Opening",
    "00:45 - Production workflow",
    "01:45 - Release and next steps"
  ].join("\n"));
  assert.match(formatMarkdownChapters(result), /\| 00:45 \| Production workflow \|/u);
  assert.deepEqual(validateChapterList(structuredClone(result), context), result);
});

test("formats long-video clocks without rounding aligned milliseconds", () => {
  assert.equal(chapterClock(0, 4_000_000), "0:00:00");
  assert.equal(chapterClock(3_723_999, 4_000_000), "1:02:03");
  assert.equal(chapterClock(123_999, 500_000), "02:03");
});

test("rejects invented anchors, unsafe titles, duplicates, and short chapters", () => {
  const context = planChapterContext(cues(), { durationMs: 180_000 });
  const anchors = context.windows.flatMap(({ records }) => records.map(({ anchorId }) => anchorId));
  assert.throws(() => compileChapterEntries([
    { anchorId: anchors[0], title: "Opening" },
    { anchorId: "chapter_anchor_invented", title: "Invented" },
    { anchorId: anchors[4], title: "Ending" }
  ], context), /anchor is unknown/u);
  assert.throws(() => compileChapterEntries([
    { anchorId: anchors[0], title: "Opening" },
    { anchorId: anchors[0], title: "Duplicate" },
    { anchorId: anchors[4], title: "Ending" }
  ], context), /anchor is invalid/u);
  assert.throws(() => compileChapterEntries([
    { anchorId: anchors[0], title: "Opening" },
    { anchorId: anchors[1], title: "Bad\u202etitle" },
    { anchorId: anchors[4], title: "Ending" }
  ], context), /title is invalid/u);
  const closeSource = cues(5, 5_000).map((cue) => ({
    ...cue,
    endsAtMs: cue.startsAtMs + 3_000
  }));
  const close = planChapterContext(closeSource, { durationMs: 40_000 });
  const closeAnchors = close.windows[0].records.map(({ anchorId }) => anchorId);
  assert.throws(() => compileChapterEntries([
    { anchorId: closeAnchors[0], title: "Opening" },
    { anchorId: closeAnchors[1], title: "Too close" },
    { anchorId: closeAnchors[4], title: "Ending" }
  ], close), /too close/u);
});

test("rejects unknown context fields and tampered chapter evidence", () => {
  const context = planChapterContext(cues(), { durationMs: 180_000 });
  assert.throws(() => compileChapterEntries([
    { anchorId: context.windows[0].records[0].anchorId, title: "Opening" },
    { anchorId: context.windows[0].records[3].anchorId, title: "Middle" },
    { anchorId: context.windows[0].records[7].anchorId, title: "Ending" }
  ], { ...context, unexpected: true }), /unexpected fields/u);
  const compiled = compileChapterEntries([
    { anchorId: context.windows[0].records[0].anchorId, title: "Opening" },
    { anchorId: context.windows[0].records[3].anchorId, title: "Middle" },
    { anchorId: context.windows[0].records[7].anchorId, title: "Ending" }
  ], context);
  compiled.chapters[1].startsAtMs += 1_000;
  assert.throws(() => validateChapterList(compiled, context), /anchor evidence is invalid/u);

  const oversizedWindow = structuredClone(context);
  for (const record of oversizedWindow.windows[0].records) {
    record.text = "x".repeat(700);
  }
  assert.throws(() => compileChapterEntries([
    { anchorId: context.windows[0].records[0].anchorId, title: "Opening" },
    { anchorId: context.windows[0].records[3].anchorId, title: "Middle" },
    { anchorId: context.windows[0].records[7].anchorId, title: "Ending" }
  ], oversizedWindow), /window 1 timing is invalid/u);

  const driftingAnchor = structuredClone(context);
  driftingAnchor.windows[0].records[1].startsAtMs += 1;
  assert.throws(() => compileChapterEntries([
    { anchorId: context.windows[0].records[0].anchorId, title: "Opening" },
    { anchorId: context.windows[0].records[3].anchorId, title: "Middle" },
    { anchorId: context.windows[0].records[7].anchorId, title: "Ending" }
  ], driftingAnchor), /record 2 is invalid/u);
});

test("plans ten thousand cues in one bounded linear pass", () => {
  const source = cues(10_000, 8_000);
  const started = performance.now();
  const context = planChapterContext(source, { durationMs: 80_010_000 });
  const elapsed = performance.now() - started;

  assert.equal(context.windows.flatMap(({ records }) => records).length, 10_000);
  assert.ok(elapsed < 2_000, `chapter planning took ${elapsed.toFixed(2)} ms`);
});
