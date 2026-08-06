export interface CachePolicyTarget {
  id?: string;
  base: 'site' | 'worker';
  path: string;
  status: number;
  type?: 'private' | 'public';
  minimumMaxAge?: number;
}

export interface CachePolicyCheck {
  id: string;
  status: number;
  cacheControl: string;
  cfCacheStatus: string;
  ok: boolean;
  failures: string[];
}

export function evaluateCachePolicyTarget(target?: CachePolicyTarget, response?: Record<string, unknown>): CachePolicyCheck;
export function collectCachePolicyEvidence(options: {
  config: { cachePolicy?: CachePolicyTarget[] };
  siteBase: string;
  workerBase: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}): Promise<{
  schemaVersion: 1;
  generatedAt: string;
  ok: boolean;
  checks: CachePolicyCheck[];
  containsCredentials: false;
  containsCustomerData: false;
}>;
