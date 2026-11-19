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
  connected?: boolean;
}): string;
