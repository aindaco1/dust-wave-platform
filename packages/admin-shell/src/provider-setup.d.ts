interface CardOptions {
  status: string;
  description?: string;
  title?: string;
  action?: string;
  buttonLabel?: string;
  csrfToken?: string;
}

type R2AccessOptions =
  | { storageAccess?: "read-only"; uploadConsent?: never }
  | { storageAccess: "uploads"; uploadConsent: string };

export function renderStripeCard(options: CardOptions & {
  checkAction?: string;
  resetHref?: string;
  existingOAuth?: boolean;
  resume?: boolean;
  ready?: boolean;
}): string;

export function renderR2Card(options: CardOptions & R2AccessOptions & {
  values?: {
    accountId?: string;
    bucket?: string;
    jurisdiction?: "default" | "eu" | "us" | "fedramp";
  };
  guideAction?: string;
  connected?: boolean;
}): string;

export function renderR2TokenForm(options: R2AccessOptions & {
  action: string;
  csrfToken?: string;
  accountId: string;
  bucket: string;
  jurisdiction?: "default" | "eu" | "us" | "fedramp";
}): string;
