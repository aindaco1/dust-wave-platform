export function redactCommandArgs(args = [], options = {}) {
  const redactedIndexes = new Set(options.redactedIndexes || []);
  return args.map((arg, index) => {
    if (redactedIndexes.has(index)) return '[REDACTED]';
    const text = String(arg);
    if (/^(?:sk|rk|pk|whsec|re|ghp|github_pat|cf)-?[A-Za-z0-9_]/.test(text)) return '[REDACTED]';
    if (/^(?:authorization|token|secret|cookie|passphrase)=/i.test(text)) {
      return `${text.split('=')[0]}=[REDACTED]`;
    }
    return text;
  });
}

export function structuredCommandResult(result = {}, options = {}) {
  return {
    ok: result.status === 0,
    status: Number(result.status ?? 1),
    timedOut: result.timedOut === true,
    command: result.command || '',
    args: result.args || [],
    ...(options.includeOutput === true ? {
      stdout: String(result.stdout || ''),
      stderr: String(result.stderr || '')
    } : {}),
    error: result.status === 0 ? '' : String(result.error || result.stderr || '').trim().slice(0, 500)
  };
}
