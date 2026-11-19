interface CardOptions {
  status: string;
  description?: string;
  title?: string;
  action?: string;
  buttonLabel?: string;
  csrfToken?: string;
}

export function renderStripeCard(options: CardOptions & {
  checkAction?: string;
  resetHref?: string;
  existingOAuth?: boolean;
  resume?: boolean;
  ready?: boolean;
}): string;

export function renderR2Card(options: CardOptions & {
  values?: {
    accountId?: string;
    bucket?: string;
    jurisdiction?: "default" | "eu" | "us" | "fedramp";
  };
  guideAction?: string;
  connected?: boolean;
}): string;

export function renderR2TokenForm(options: {
  action: string;
  csrfToken?: string;
  accountId: string;
  bucket: string;
  jurisdiction?: "default" | "eu" | "us" | "fedramp";
}): string;
