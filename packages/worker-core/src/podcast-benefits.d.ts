export const PODCAST_BENEFIT_CODE_LENGTH: 42;

export function isPodcastBenefitCode(value: unknown): boolean;

export function normalizePodcastBenefitCode(value: unknown): string;

export function generatePodcastBenefitCode(
  fillRandomValues?: (bytes: Uint8Array) => Uint8Array | void
): string;
