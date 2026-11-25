import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHTML } from 'linkedom';
import { auditHreflang } from '../src/hreflang.js';

test('undeclared single-language pages may omit links, declared translations must appear', () => {
  const { document } = parseHTML('<html lang="en"><head></head></html>');
  const options = { route: '/', siteBase: 'https://example.org', lang: 'en' };
  assert.deepEqual(auditHreflang(document, options), []);
  assert.deepEqual(auditHreflang(document, { ...options, expectedLanguages: ['en', 'es', 'x-default'] }), [
    '/: hreflang alternates missing self language', '/: hreflang alternates missing x-default', '/: hreflang alternates missing es'
  ]);
});

test('existing links retain language and canonical URL diagnostics', () => {
  const { document } = parseHTML(`<html><head>
    <link rel="alternate" hreflang="es" href="/es/">
    <link rel="alternate" hreflang="x-default" href="https://outside.test/?v=1">
  </head></html>`);
  assert.deepEqual(auditHreflang(document, { route: '/es/', siteBase: 'https://example.org', lang: 'es' }), [
    '/es/: hreflang es is not an absolute URL',
    '/es/: hreflang x-default points outside https://example.org',
    '/es/: hreflang x-default should not include query strings or fragments'
  ]);
});
