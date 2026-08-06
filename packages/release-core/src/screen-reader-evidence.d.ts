export interface ScreenReaderEvidencePolicy {
  productLabel: string;
  tempPrefix: string;
  defaultExpectedPhrases: string[];
  defaultUrl?: string;
}
export function optionValue(args: string[], name: string, fallback?: string): string;
export function optionValues(args: string[], name: string): string[];
export function evaluateTranscriptExpectations(transcript: string, expectedPhrases: string[]): { ok: boolean; missing: string[]; matched: string[] };
export function runScreenReaderEvidence(policy: ScreenReaderEvidencePolicy, options?: Record<string, unknown>): {
  schemaVersion: 1;
  product: string;
  results: Array<{ status: string; label: string; detail: string }>;
  failCount: number;
  warnCount: number;
  skipCount: number;
  exitCode: number;
  help: boolean;
};
