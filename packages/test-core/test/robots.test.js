import assert from 'node:assert/strict';
import test from 'node:test';
import { hasCanonicalSitemap } from '../src/robots.js';

test('requires the complete active canonical directive on its own line', () => {
  const origin = 'https://example.org';
  const line = `Sitemap: ${origin}/sitemap.xml`;
  assert.ok(hasCanonicalSitemap(`User-agent: *\r\n  ${line}\t\r\n`, origin));
  for (const body of ['', `# ${line}`, `${line}.old`, `${line}?v=2`, line.toLowerCase()]) {
    assert.equal(hasCanonicalSitemap(body, origin), false);
  }
});
