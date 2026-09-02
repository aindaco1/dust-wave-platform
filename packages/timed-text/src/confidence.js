const MAXIMUM_CUES = 10_000;
const MAXIMUM_TOKENS = 500_000;
const MAXIMUM_TEXT_LENGTH = 240;
const SPOKEN_TOKEN = /[\p{L}\p{N}]/u;

export const RECOGNITION_CONFIDENCE_SCHEMA =
  "timed-text-recognition-confidence-v1";
export const RECOGNITION_CONFIDENCE_POLICY_VERSION =
  "parakeet-spoken-token-minimum-v1";
export const DEFAULT_RECOGNITION_CONFIDENCE_THRESHOLDS = Object.freeze({
  ultraLowBelow: 0.5,
  lowBelow: 0.9,
  mediumBelow: 0.98
});

function normalizedThresholds(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Recognition confidence thresholds are invalid");
  }
  const keys = ["ultraLowBelow", "lowBelow", "mediumBelow"];
  if (Object.keys(value).length !== keys.length
      || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new TypeError("Recognition confidence thresholds are invalid");
  }
  const thresholds = Object.fromEntries(keys.map((key) => [key, Number(value[key])]));
  if (!keys.every((key) => Number.isFinite(thresholds[key]))
      || thresholds.ultraLowBelow <= 0
      || thresholds.ultraLowBelow >= thresholds.lowBelow
      || thresholds.lowBelow >= thresholds.mediumBelow
      || thresholds.mediumBelow > 1) {
    throw new TypeError("Recognition confidence thresholds are invalid");
  }
  return thresholds;
}

export function recognitionConfidenceTier(score, {
  thresholds = DEFAULT_RECOGNITION_CONFIDENCE_THRESHOLDS
} = {}) {
  if (score === null) return "unavailable";
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new TypeError("Recognition confidence score is invalid");
  }
  const policy = normalizedThresholds(thresholds);
  if (score < policy.ultraLowBelow) return "ultraLow";
  if (score < policy.lowBelow) return "low";
  if (score < policy.mediumBelow) return "medium";
  return "high";
}

function validateCues(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAXIMUM_CUES) {
    throw new TypeError("Recognition confidence cues are invalid");
  }
  let previousEnd = 0;
  const ids = new Set();
  return value.map((cue, index) => {
    if (!cue || typeof cue !== "object" || Array.isArray(cue)
        || typeof cue.id !== "string" || cue.id.length < 1 || cue.id.length > 120
        || ids.has(cue.id)
        || !Number.isSafeInteger(cue.startsAtMs)
        || !Number.isSafeInteger(cue.endsAtMs)
        || cue.startsAtMs < previousEnd || cue.endsAtMs <= cue.startsAtMs) {
      throw new TypeError(`Recognition confidence cue ${index + 1} is invalid`);
    }
    ids.add(cue.id);
    previousEnd = cue.endsAtMs;
    return {
      id: cue.id,
      startsAtMs: cue.startsAtMs,
      endsAtMs: cue.endsAtMs
    };
  });
}

function validateTokens(value) {
  if (!Array.isArray(value) || value.length > MAXIMUM_TOKENS) {
    throw new TypeError("Recognition confidence tokens are invalid");
  }
  let previousStart = -1;
  return value.map((token, index) => {
    if (!token || typeof token !== "object" || Array.isArray(token)
        || typeof token.text !== "string" || !token.text || token.text.length > MAXIMUM_TEXT_LENGTH
        || /[\p{Cc}]/u.test(token.text)
        || !Number.isSafeInteger(token.startsAtMs)
        || !Number.isSafeInteger(token.endsAtMs)
        || token.startsAtMs < 0 || token.startsAtMs < previousStart
        || token.endsAtMs <= token.startsAtMs
        || !Number.isFinite(token.confidence)
        || token.confidence < 0 || token.confidence > 1) {
      throw new TypeError(`Recognition confidence token ${index + 1} is invalid`);
    }
    previousStart = token.startsAtMs;
    return {
      text: token.text.normalize("NFC"),
      startsAtMs: token.startsAtMs,
      endsAtMs: token.endsAtMs,
      confidence: token.confidence
    };
  });
}

function roundedScore(value) {
  return Number(value.toFixed(6));
}

function earlierLongestCue(leftIndex, rightIndex, cues) {
  if (leftIndex < 0) return rightIndex;
  if (rightIndex < 0) return leftIndex;
  const left = cues[leftIndex];
  const right = cues[rightIndex];
  const leftDuration = left.endsAtMs - left.startsAtMs;
  const rightDuration = right.endsAtMs - right.startsAtMs;
  return rightDuration > leftDuration ? rightIndex : leftIndex;
}

function durationRangeIndex(cues) {
  let leafCount = 1;
  while (leafCount < cues.length) leafCount *= 2;
  const tree = Array(leafCount * 2).fill(-1);
  for (let index = 0; index < cues.length; index += 1) {
    tree[leafCount + index] = index;
  }
  for (let index = leafCount - 1; index > 0; index -= 1) {
    tree[index] = earlierLongestCue(tree[index * 2], tree[index * 2 + 1], cues);
  }
  return (lowerBound, upperBound) => {
    let left = lowerBound + leafCount;
    let right = upperBound + leafCount;
    let best = -1;
    while (left < right) {
      if (left % 2 === 1) {
        best = earlierLongestCue(best, tree[left], cues);
        left += 1;
      }
      if (right % 2 === 1) {
        right -= 1;
        best = earlierLongestCue(best, tree[right], cues);
      }
      left = Math.floor(left / 2);
      right = Math.floor(right / 2);
    }
    return best;
  };
}

function firstCueStartingAtOrAfter(cues, value, lowerBound) {
  let left = lowerBound;
  let right = cues.length;
  while (left < right) {
    const middle = left + Math.floor((right - left) / 2);
    if (cues[middle].startsAtMs < value) left = middle + 1;
    else right = middle;
  }
  return left;
}

function tokenOverlap(cue, token) {
  return Math.max(0, Math.min(cue.endsAtMs, token.endsAtMs)
    - Math.max(cue.startsAtMs, token.startsAtMs));
}

export function compileRecognitionConfidence({
  cues,
  tokens,
  thresholds = DEFAULT_RECOGNITION_CONFIDENCE_THRESHOLDS
}) {
  const boundedCues = validateCues(cues);
  const boundedTokens = validateTokens(tokens);
  const policy = normalizedThresholds(thresholds);
  const assigned = boundedCues.map(() => []);
  const longestCueInRange = durationRangeIndex(boundedCues);
  let cueIndex = 0;

  for (const token of boundedTokens) {
    if (!SPOKEN_TOKEN.test(token.text)) continue;
    while (cueIndex < boundedCues.length
        && boundedCues[cueIndex].endsAtMs <= token.startsAtMs) {
      cueIndex += 1;
    }
    const overlapEnd = firstCueStartingAtOrAfter(
      boundedCues,
      token.endsAtMs,
      cueIndex
    );
    let bestIndex = -1;
    let bestOverlap = 0;
    const consider = (candidate) => {
      if (candidate < cueIndex || candidate >= overlapEnd) return;
      const overlap = tokenOverlap(boundedCues[candidate], token);
      if (overlap > bestOverlap
          || (overlap === bestOverlap && overlap > 0
            && (bestIndex < 0 || candidate < bestIndex))) {
        bestIndex = candidate;
        bestOverlap = overlap;
      }
    };
    consider(cueIndex);
    consider(overlapEnd - 1);
    if (cueIndex + 1 < overlapEnd - 1) {
      consider(longestCueInRange(cueIndex + 1, overlapEnd - 1));
    }
    if (bestIndex >= 0) {
      assigned[bestIndex].push({
        startsAtMs: token.startsAtMs,
        endsAtMs: token.endsAtMs,
        score: roundedScore(token.confidence)
      });
    }
  }

  return {
    schemaVersion: RECOGNITION_CONFIDENCE_SCHEMA,
    policyVersion: RECOGNITION_CONFIDENCE_POLICY_VERSION,
    thresholds: policy,
    cues: boundedCues.map((cue, index) => {
      const tokenEvidence = assigned[index];
      const score = tokenEvidence.length
        ? roundedScore(tokenEvidence.reduce(
            (minimum, token) => Math.min(minimum, token.score),
            1
          ))
        : null;
      return {
        cueId: cue.id,
        tier: recognitionConfidenceTier(score, { thresholds: policy }),
        score,
        tokenCount: tokenEvidence.length,
        tokenEvidence
      };
    })
  };
}
