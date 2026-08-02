export const DEFAULT_STRIPE_API_VERSION: string;

export class StripeApiError extends Error {
  type: string;
  code: string;
  declineCode: string;
  statusCode: number;
  requestId: string;
  objectId: string;
  retryable: boolean;
}

export interface StripeRequestOptions {
  idempotencyKey?: string;
  stripeVersion?: string;
}

export interface StripeClientOptions {
  baseUrl?: string;
  stripeVersion?: string;
  userAgent?: string;
  onRequest?: (event: Record<string, unknown>) => void | Promise<void>;
}

type StripeObject = Record<string, unknown> & { id?: string; object?: string };
type StripeOperation = (
  data?: Record<string, unknown>,
  options?: StripeRequestOptions
) => Promise<StripeObject>;
type StripeRetrieveOperation = (
  id: string,
  options?: StripeRequestOptions
) => Promise<StripeObject>;
type StripeUpdateOperation = (
  id: string,
  data?: Record<string, unknown>,
  options?: StripeRequestOptions
) => Promise<StripeObject>;
type StripeDeleteOperation = (
  id: string,
  data?: Record<string, unknown>,
  options?: StripeRequestOptions
) => Promise<StripeObject>;

export interface StripeClient {
  products: { create: StripeOperation; retrieve: StripeRetrieveOperation };
  prices: { create: StripeOperation; retrieve: StripeRetrieveOperation };
  taxRates: { create: StripeOperation; retrieve: StripeRetrieveOperation };
  checkout: {
    sessions: {
      create: StripeOperation;
      retrieve: StripeRetrieveOperation;
      expire: StripeRetrieveOperation;
    };
  };
  billingPortal: { sessions: { create: StripeOperation } };
  customers: {
    create: StripeOperation;
    update: StripeUpdateOperation;
    retrieve: StripeRetrieveOperation;
    delete: StripeDeleteOperation;
  };
  paymentMethods: { attach: StripeUpdateOperation };
  subscriptions: {
    create: StripeOperation;
    update: StripeUpdateOperation;
    retrieve: StripeRetrieveOperation;
    cancel: StripeDeleteOperation;
  };
  invoices: {
    list: StripeOperation;
    retrieve: StripeRetrieveOperation;
    pay: StripeUpdateOperation;
  };
  invoicePayments: { list: StripeOperation };
  refunds: {
    create: StripeOperation;
    retrieve: StripeRetrieveOperation;
  };
  testHelpers: {
    testClocks: {
      create: StripeOperation;
      retrieve: StripeRetrieveOperation;
      advance: StripeUpdateOperation;
      delete: StripeRetrieveOperation;
    };
  };
}

export function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  options?: { toleranceSeconds?: number; nowSeconds?: number }
): Promise<{ valid: boolean; timestamp?: number; error?: string }>;

export function createStripeClient(
  secretKey: string,
  options?: StripeClientOptions
): StripeClient;
