export type RecognitionConfidenceTier =
  | "ultraLow"
  | "low"
  | "medium"
  | "high"
  | "unavailable";

export interface RecognitionConfidenceThresholds {
  ultraLowBelow: number;
  lowBelow: number;
  mediumBelow: number;
}

export interface RecognitionTokenEvidence {
  startsAtMs: number;
  endsAtMs: number;
  score: number;
}

export interface CueRecognitionConfidence {
  cueId: string;
  tier: RecognitionConfidenceTier;
  score: number | null;
  tokenCount: number;
  tokenEvidence: RecognitionTokenEvidence[];
}

export interface RecognitionConfidenceResult {
  schemaVersion: "timed-text-recognition-confidence-v1";
  policyVersion: "parakeet-spoken-token-minimum-v1";
  thresholds: RecognitionConfidenceThresholds;
  cues: CueRecognitionConfidence[];
}

export const RECOGNITION_CONFIDENCE_SCHEMA:
  "timed-text-recognition-confidence-v1";
export const RECOGNITION_CONFIDENCE_POLICY_VERSION:
  "parakeet-spoken-token-minimum-v1";
export const DEFAULT_RECOGNITION_CONFIDENCE_THRESHOLDS:
  Readonly<RecognitionConfidenceThresholds>;

export function recognitionConfidenceTier(
  score: number | null,
  options?: { thresholds?: RecognitionConfidenceThresholds }
): RecognitionConfidenceTier;

export function compileRecognitionConfidence(value: {
  cues: Array<{ id: string; startsAtMs: number; endsAtMs: number }>;
  tokens: Array<{
    text: string;
    startsAtMs: number;
    endsAtMs: number;
    confidence: number;
  }>;
  thresholds?: RecognitionConfidenceThresholds;
}): RecognitionConfidenceResult;
