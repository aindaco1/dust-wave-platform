export function assertAbsoluteSiteUrl(value, siteBase, label, route, errors) {
  if (!value) {
    errors.push(`${route}: missing ${label}`);
    return null;
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    errors.push(`${route}: ${label} is not an absolute URL`);
    return null;
  }
  if (parsed.origin !== siteBase) {
    errors.push(`${route}: ${label} points outside ${siteBase}`);
  }
  if (parsed.search || parsed.hash) {
    errors.push(`${route}: ${label} should not include query strings or fragments`);
  }
  return parsed;
}

// Consumers use their sitemap to declare which HTML pages have translations.
export function sitemapAlternateLanguages(document) {
  const pages = new Map();
  for (const entry of document.getElementsByTagName('url')) {
    const location = entry.querySelector('loc')?.textContent.trim();
    if (!location) continue;
    const languages = new Set();
    for (const link of entry.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'link')) {
      const language = link.getAttribute('hreflang');
      if (language && link.getAttribute('rel') === 'alternate') languages.add(language);
    }
    if (languages.size > 0) pages.set(location, languages);
  }
  return pages;
}

export function auditHreflang(document, { route, siteBase, lang, expectedLanguages = [] }) {
  const links = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]'));
  const required = new Set(expectedLanguages);
  if (links.length === 0 && required.size === 0) return [];

  const errors = [];
  const languages = new Set(links.map(link => link.getAttribute('hreflang')));
  if (!languages.has(lang)) errors.push(`${route}: hreflang alternates missing self language`);
  if (!languages.has('x-default')) errors.push(`${route}: hreflang alternates missing x-default`);
  required.delete(lang);
  required.delete('x-default');
  for (const language of required) {
    if (!languages.has(language)) errors.push(`${route}: hreflang alternates missing ${language}`);
  }
  for (const link of links) {
    assertAbsoluteSiteUrl(link.getAttribute('href'), siteBase, `hreflang ${link.getAttribute('hreflang')}`, route, errors);
  }
  return errors;
}
