export type AuditSeverity = 'info' | 'low' | 'moderate' | 'high' | 'critical';
export interface AuditCommandResult {
  stdout: string;
  stderr?: string;
  status: number | null;
  signal?: string | null;
  error?: unknown;
  timedOut?: boolean;
}
export type AuditResult = {
  state: 'passed' | 'findings';
  report: { metadata: { vulnerabilities: Record<AuditSeverity | 'total', number> }; vulnerabilities: Record<string, unknown> };
} | { state: 'incomplete'; retryable: boolean; reason: string };
export function classifyAuditResult(result: AuditCommandResult, minimumSeverity?: AuditSeverity): AuditResult;
export function auditDependencies(options: {
  cwd: string;
  scope: 'production' | 'full';
  label?: string;
  minimumSeverity?: AuditSeverity;
  runCommandFn: (command: string, args: string[], options: { cwd: string; timeoutMs: number; killSignal: 'SIGKILL' }) => AuditCommandResult | Promise<AuditCommandResult>;
  sleepFn?: (delayMs: number) => unknown;
  log?: (message: string) => void;
}): Promise<AuditResult>;
