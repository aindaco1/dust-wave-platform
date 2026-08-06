export type ProviderEvidenceStatus = 'PASS' | 'FAIL' | 'WARN' | 'SKIP';

export interface ProviderEvidenceEntry {
  status: ProviderEvidenceStatus;
  label: string;
  detail: string;
}

export interface ProviderEvidence {
  schemaVersion: 1;
  generatedAt: string;
  strict: boolean;
  cloudflareDnsOnly: boolean;
  usedDevVars: boolean;
  status: 'fail' | 'warning' | 'incomplete' | 'pass';
  failCount: number;
  warnCount: number;
  skipCount: number;
  results: ProviderEvidenceEntry[];
  containsCredentials: false;
  containsCustomerData: false;
}

export function buildProviderEvidence(
  entries?: unknown,
  options?: {
    generatedAt?: unknown;
    strict?: boolean;
    cloudflareDnsOnly?: boolean;
    usedDevVars?: boolean;
  }
): ProviderEvidence;
export function providerEvidenceShouldFail(evidence?: Partial<ProviderEvidence>): boolean;
