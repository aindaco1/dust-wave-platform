import assert from "node:assert/strict";
import test from "node:test";

import {
  compileRecognitionConfidence,
  DEFAULT_RECOGNITION_CONFIDENCE_THRESHOLDS,
  recognitionConfidenceTier,
  RECOGNITION_CONFIDENCE_POLICY_VERSION,
  RECOGNITION_CONFIDENCE_SCHEMA
} from "../src/confidence.js";

const cues = [
  { id: "cue_000001", startsAtMs: 0, endsAtMs: 1_000 },
  { id: "cue_000002", startsAtMs: 1_200, endsAtMs: 2_000 }
];

test("compiles conservative spoken-token evidence without retaining token text", () => {
  const result = compileRecognitionConfidence({
    cues,
    tokens: [
      { text: "Hello", startsAtMs: 100, endsAtMs: 300, confidence: 0.99 },
      { text: ",", startsAtMs: 300, endsAtMs: 320, confidence: 0.1 },
      { text: "world", startsAtMs: 330, endsAtMs: 600, confidence: 0.72 },
      { text: "again", startsAtMs: 1_250, endsAtMs: 1_600, confidence: 0.995 }
    ]
  });

  assert.equal(result.schemaVersion, RECOGNITION_CONFIDENCE_SCHEMA);
  assert.equal(result.policyVersion, RECOGNITION_CONFIDENCE_POLICY_VERSION);
  assert.deepEqual(result.thresholds, DEFAULT_RECOGNITION_CONFIDENCE_THRESHOLDS);
  assert.equal(result.cues[0].score, 0.72);
  assert.equal(result.cues[0].tier, "low");
  assert.equal(result.cues[0].tokenCount, 2);
  assert.equal(result.cues[0].tokenEvidence.some((token) => "text" in token), false);
  assert.equal(result.cues[1].tier, "high");
});

test("uses unavailable when no bounded spoken token overlaps a cue", () => {
  const result = compileRecognitionConfidence({
    cues,
    tokens: [
      { text: ".", startsAtMs: 100, endsAtMs: 120, confidence: 1 },
      { text: "gap", startsAtMs: 1_050, endsAtMs: 1_100, confidence: 0.2 }
    ]
  });
  assert.deepEqual(result.cues.map(({ tier }) => tier), ["unavailable", "unavailable"]);
  assert.deepEqual(result.cues.map(({ score }) => score), [null, null]);
});

test("assigns a boundary-crossing token to the cue with greatest overlap", () => {
  const result = compileRecognitionConfidence({
    cues: [
      { id: "left", startsAtMs: 0, endsAtMs: 500 },
      { id: "right", startsAtMs: 500, endsAtMs: 1_000 }
    ],
    tokens: [
      { text: "crossing", startsAtMs: 450, endsAtMs: 700, confidence: 0.4 }
    ]
  });
  assert.deepEqual(result.cues.map(({ tokenCount }) => tokenCount), [0, 1]);
});

test("freezes every tier boundary", () => {
  assert.equal(recognitionConfidenceTier(0.499999), "ultraLow");
  assert.equal(recognitionConfidenceTier(0.5), "low");
  assert.equal(recognitionConfidenceTier(0.899999), "low");
  assert.equal(recognitionConfidenceTier(0.9), "medium");
  assert.equal(recognitionConfidenceTier(0.979999), "medium");
  assert.equal(recognitionConfidenceTier(0.98), "high");
  assert.equal(recognitionConfidenceTier(null), "unavailable");
});

test("rejects malformed thresholds, cue order, and token scores", () => {
  assert.throws(() => compileRecognitionConfidence({
    cues,
    tokens: [],
    thresholds: { ultraLowBelow: 0.9, lowBelow: 0.5, mediumBelow: 0.98 }
  }), /thresholds/);
  assert.throws(() => compileRecognitionConfidence({
    cues: [cues[1], cues[0]], tokens: []
  }), /cue 2/);
  assert.throws(() => compileRecognitionConfidence({
    cues,
    tokens: [{ text: "bad", startsAtMs: 0, endsAtMs: 10, confidence: 2 }]
  }), /token 1/);
  for (const text of ["", "bad\u0000token"]) {
    assert.throws(() => compileRecognitionConfidence({
      cues,
      tokens: [{ text, startsAtMs: 0, endsAtMs: 10, confidence: 0.5 }]
    }), /token 1/);
  }
});

test("compiles the maximum cue count in one bounded pass", () => {
  const cues = Array.from({ length: 10_000 }, (_, index) => ({
    id: `cue_${String(index + 1).padStart(6, "0")}`,
    startsAtMs: index * 10,
    endsAtMs: (index + 1) * 10
  }));
  const tokens = cues.map((cue) => ({
    text: "word",
    startsAtMs: cue.startsAtMs,
    endsAtMs: cue.endsAtMs,
    confidence: 0.99
  }));
  const started = performance.now();
  const result = compileRecognitionConfidence({ cues, tokens });
  const elapsed = performance.now() - started;
  assert.equal(result.cues.length, 10_000);
  assert.ok(result.cues.every(({ tier }) => tier === "high"));
  assert.ok(elapsed < 2_000, `expected bounded confidence compilation, observed ${elapsed}ms`);
});

test("bounds adversarial tokens spanning the full cue range", () => {
  const cues = Array.from({ length: 10_000 }, (_, index) => ({
    id: `cue_${String(index + 1).padStart(6, "0")}`,
    startsAtMs: index * 2,
    endsAtMs: index * 2 + (index === 5_000 ? 2 : 1)
  }));
  const tokens = Array.from({ length: 10_000 }, () => ({
    text: "word",
    startsAtMs: 0,
    endsAtMs: 20_000,
    confidence: 0.4
  }));
  const started = performance.now();
  const result = compileRecognitionConfidence({ cues, tokens });
  const elapsed = performance.now() - started;
  assert.equal(result.cues[5_000].tokenCount, 10_000);
  assert.equal(result.cues[5_000].tier, "ultraLow");
  assert.equal(result.cues.reduce((total, cue) => total + cue.tokenCount, 0), 10_000);
  assert.ok(elapsed < 2_000, `expected bounded overlap lookup, observed ${elapsed}ms`);
});
