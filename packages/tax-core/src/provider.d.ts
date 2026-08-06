export type NewMexicoStreetAddress = {
  streetNumber: string;
  preDirection: string;
  streetName: string;
  streetSuffix: string;
  postDirection: string;
};

export class TaxProviderError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status?: number);
}

export function lookupZipTax(options: {
  apiKey: string;
  address: string;
  apiBase?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  fetchTarget?: typeof fetch;
}): Promise<Record<string, unknown>>;

export function lookupNewMexicoGrt(options: {
  street: NewMexicoStreetAddress;
  city: string;
  postalCode: string;
  county?: string;
  apiBase?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  fetchTarget?: typeof fetch;
}): Promise<Record<string, unknown>>;

export function buildZipTaxAddress(destination: Record<string, unknown>): string;
export function parseNewMexicoStreetAddress(line1: unknown): NewMexicoStreetAddress | null;
export function normalizeTaxProviderSource(value: unknown): string;
