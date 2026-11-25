export function assertAbsoluteSiteUrl(value: string | null, siteBase: string, label: string, route: string, errors: string[]): URL | null;
export function sitemapAlternateLanguages(document: Document): Map<string, Set<string>>;
export function auditHreflang(document: Document, options: {
  route: string;
  siteBase: string;
  lang: string;
  expectedLanguages?: Iterable<string>;
}): string[];
