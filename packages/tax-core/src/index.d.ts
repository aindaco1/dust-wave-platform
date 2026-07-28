export interface TaxDestination {
  country: string;
  postalCode: string;
  state: string;
  city: string;
  line1: string;
  line2: string;
}

export type TaxDestinationResult =
  | { valid: true; destination: TaxDestination }
  | { valid: false; destination: null; error: string };

export interface ManualTaxInput {
  subtotalCents: number;
  shippingCents?: number;
  ratePartsPerMillion: number;
  shippingTaxable?: boolean;
  taxBehavior?: "exclusive" | "inclusive";
}

export interface ManualTaxResult {
  subtotalCents: number;
  shippingCents: number;
  taxableSubtotalCents: number;
  taxableShippingCents: number;
  shippingTaxed: boolean;
  ratePartsPerMillion: number;
  effectiveRate: number;
  taxBehavior: "exclusive" | "inclusive";
  taxCents: number;
  totalCents: number;
}

export function normalizeDestinationCountry(value: unknown): string;
export function normalizeDestinationPostalCode(
  value: unknown,
  country?: string
): string;
export function normalizeTaxDestination(value: unknown): TaxDestinationResult;
export function calculateManualTax(input: ManualTaxInput): ManualTaxResult;
