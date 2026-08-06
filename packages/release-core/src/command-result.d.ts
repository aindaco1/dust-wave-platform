export function redactCommandArgs(
  args?: unknown[],
  options?: { redactedIndexes?: number[] }
): string[];

export function structuredCommandResult(
  result?: {
    status?: number | null;
    timedOut?: boolean;
    command?: unknown;
    args?: unknown[];
    stdout?: unknown;
    stderr?: unknown;
    error?: unknown;
  },
  options?: { includeOutput?: boolean }
): {
  ok: boolean;
  status: number;
  timedOut: boolean;
  command: unknown;
  args: unknown[];
  stdout?: string;
  stderr?: string;
  error: string;
};
