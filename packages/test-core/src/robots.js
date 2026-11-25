export function hasCanonicalSitemap(robotsText, siteBase) {
  const directive = `Sitemap: ${siteBase}/sitemap.xml`;
  return String(robotsText || '').split(/\r?\n/).some(line => line.trim() === directive);
}
