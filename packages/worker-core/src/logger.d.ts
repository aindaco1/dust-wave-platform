export type ScopedConsole = {
  child(scope: string): ScopedConsole;
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

export function createScopedConsoleFactory(options: {
  productName: string;
  runtimeName?: string;
  consoleTarget?: Console;
  now?: () => Date;
}): {
  getScopedConsole(
    owner: object | null | undefined,
    scope?: string,
    config?: {
      consoleLoggingEnabled?: boolean;
      verboseConsoleLogging?: boolean;
    }
  ): ScopedConsole;
};
