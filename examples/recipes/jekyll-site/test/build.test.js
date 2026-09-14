import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
test('built page uses template output and only its selected shared browser entry', () => {
  const html = readFileSync('_site/index.html', 'utf8');
  assert.match(html, /Example loading state/); assert.match(html, /role="status"/);
  assert.match(html, /src="\/assets\/a11y-live-browser.js"/);
  assert.equal(readFileSync('_site/assets/a11y-live-browser.js', 'utf8'), readFileSync('shared/dust-wave-platform/packages/site-shell/src/a11y-live-browser.js', 'utf8'));
  for (const path of ['shared', 'package.json', 'platform-commit.txt', 'test', 'Gemfile']) assert.equal(existsSync('_site/' + path), false);
});
