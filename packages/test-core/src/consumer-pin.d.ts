export function assertConsumerPin(options: {
  root: string;
  submodulePath?: string;
  expectedCommit: string;
  expectedRemote?: string;
  /** Package directory to exact version, e.g. { 'worker-core': '0.14.0' }. */
  packages: Record<string, string>;
  lockfiles?: Array<{ path: string; packages: Record<string, string> }>;
}): void;
