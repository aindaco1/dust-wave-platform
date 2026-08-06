export const SHIPPING_OPTION_STANDARD: "standard";
export const SHIPPING_OPTION_SIGNATURE_REQUIRED: "signature_required";
export const SHIPPING_OPTION_ADULT_SIGNATURE_REQUIRED: "adult_signature_required";

export type ShippingResult<T> = { valid: true } & T | { valid: false; error: string };
export type ShippingPolicy = {
  originCountry: string;
  fallbackFeeCents?: number;
  freeShipping?: boolean;
  configuredOptions?: unknown[];
};

export function normalizeShippingProfile(shipping: unknown, label?: string): ShippingResult<{ shipping: Record<string, unknown> }>;
export function getTierShippingProfile(tier?: Record<string, any>): ShippingResult<{ shipping: Record<string, any> | null }>;
export function getSupportItemShippingProfile(item?: Record<string, any>): ShippingResult<{ shipping: Record<string, any> | null }>;
export function getAddOnShippingProfile(item?: Record<string, any>): ShippingResult<{ shipping: Record<string, any> | null }>;
export function summarizeShipmentSelection(
  tierSelection?: Record<string, any>,
  supportItems?: unknown[],
  context?: Record<string, any> | null,
  bundleAddOns?: unknown[]
): ShippingResult<{ shipment: Record<string, any> }>;
export function summarizePhysicalSelectionWithoutMetadata(
  tierSelection?: Record<string, any>,
  supportItems?: unknown[],
  context?: Record<string, any> | null,
  bundleAddOns?: unknown[]
): ShippingResult<{ shipment: Record<string, any> }>;
export function isShippingMetadataError(error: unknown): boolean;
export function buildFallbackShippingQuote(policy: ShippingPolicy, destination: Record<string, any>, shipment: Record<string, any>): Record<string, any>;
export function buildManualDomesticRateQuote(destination: Record<string, any>, shipment: Record<string, any>): ShippingResult<{ quote: Record<string, any> }>;
export function buildFreeShippingQuote(policy: ShippingPolicy, destination: Record<string, any>, shipment: Record<string, any>): Record<string, any>;
export function getAvailableShippingOptions(
  policy: ShippingPolicy,
  destination?: Record<string, any>,
  shipment?: Record<string, any>,
  baseShippingCents?: number
): Array<Record<string, any>>;
export function resolveSelectedShippingOption(options?: Array<Record<string, any>>, selected?: unknown, defaultOption?: unknown): string;
export function getSelectedShippingOptionDetails(options?: Array<Record<string, any>>, selected?: unknown, defaultOption?: unknown): Record<string, any> | null;
export function buildStandardOnlyShippingOptions(shipment: Record<string, any>, shippingCents: unknown): Array<Record<string, any>>;
