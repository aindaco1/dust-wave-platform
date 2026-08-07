import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { createProductVideoStageHtml } from '../src/capture.js';

test('stage markup escapes consumer values and contains no product identity', () => {
  const html = createProductVideoStageHtml({
    iframeUrl: 'http://127.0.0.1:4010/?value="unsafe"&next=<x>',
    shell: { width: 1_480, height: 960, radius: 24 },
    title: 'Demo <capture>'
  });
  assert.match(html, /value=&quot;unsafe&quot;&amp;next=&lt;x&gt;/u);
  assert.match(html, /Demo &lt;capture&gt;/u);
  assert.equal(/pool|store|podcast/iu.test(html), false);
  assert.match(html, /id="product-video-frame"/u);
});

test('capture and render CLIs expose help without requiring Playwright or FFmpeg', () => {
  for (const script of ['capture-product-video.mjs', 'render-product-video.mjs']) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(`../bin/${script}`, import.meta.url)), '--help'], {
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage: dustwave-product-video-/u);
  }
});
