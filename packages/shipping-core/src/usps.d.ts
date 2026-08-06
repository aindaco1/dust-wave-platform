export interface UspsConfig {
  enabled: boolean;
  apiBase: string;
  clientId: string;
  clientSecret: string;
  originCountry: string;
  originZip: string;
  timeoutMs: number;
  quoteCacheTtlMs: number;
  failureCooldownMs: number;
  rateLimitCooldownMs: number;
}

export interface UspsRateClient {
  quote(context: unknown, destination: unknown, shipment: unknown): Promise<unknown>;
  reset(): void;
}

export function createUspsRateClient(options: {
  resolveConfig(context: unknown): UspsConfig;
  domesticMailClasses: string[];
  internationalMailClasses: string[];
  fetchTarget?: typeof fetch;
  now?: () => number;
  maximumCacheEntries?: number;
}): UspsRateClient;
