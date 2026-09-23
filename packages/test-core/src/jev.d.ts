export interface JevPolicy { minimumMargin: number; models: string[] }
export interface JevCase { id: string; candidate: string; reference?: string; requirements: Record<string, string> }
export interface JevRequest {
  model: 'typesafe/jev';
  input: { state: { candidate: string; reference?: string }; questions: Record<string, {
    type: 'choice'; instructions: string; criteria: Record<'pass' | 'fail' | 'uncertain', string>
  }> };
}
export interface JevResult {
  model: string;
  usage: { input_tokens: number; output_tokens: number };
  findings: Record<string, { choice: 'pass' | 'fail' | 'uncertain'; probabilities: Record<'pass' | 'fail' | 'uncertain', number>; margin: number; decision: 'pass' | 'fail' | 'review' }>;
}
export interface JevReport {
  schemaVersion: number; advisory: true; complete: boolean; releaseAccepted: false;
  questionCount: number; networkAttempts: number; policy: JevPolicy; error?: string;
  cases: Array<{ id: string; request: JevRequest; raw?: unknown; result?: JevResult; elapsedMs?: number; error?: string }>;
}
export function createJevRequest(candidate: string, requirements: Record<string, string>, options?: { reference?: string }): JevRequest;
export function judgeJevResponse(raw: unknown, questions: Record<string, unknown>, policy: JevPolicy): JevResult;
export function callCloudflareJev(payload: JevRequest, options: { accountId: string; token: string; fetchTarget?: typeof fetch; timeoutMs?: number }): Promise<unknown>;
export function evaluateJevCases(cases: JevCase[], options: { policy: JevPolicy; call?: (request: JevRequest) => Promise<unknown>; onProgress?: (report: JevReport) => Promise<void>; maxQuestions?: number }): Promise<JevReport>;
