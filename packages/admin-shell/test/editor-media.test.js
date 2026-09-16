import assert from 'node:assert/strict';
import test from 'node:test';
import { DOMParser } from 'linkedom';
import { createImagePreviewCache, imageThumbnail, applyPreviewMedia, isEmptyTextBlock, normalizeImageAccessibility } from '../src/editor-media.js';

test('newly uploaded images retain tab-local previews through server-path changes and cleanup', () => {
  const revoked = [];
  let sequence = 0;
  const cache = createImagePreviewCache({ URL: {
    createObjectURL: () => `blob:${++sequence}`,
    revokeObjectURL: value => revoked.push(value)
  } });
  cache.remember('/images/new.jpg', { type: 'image/jpeg' });
  assert.equal(cache.get('/images/new.jpg').previewUrl, 'blob:1');
  assert.equal(cache.get('/images/other.jpg'), undefined);
  cache.remember('/images/new.jpg', { type: 'image/jpeg' });
  assert.deepEqual(revoked, ['blob:1']);
  cache.clear();
  assert.deepEqual(revoked, ['blob:1', 'blob:2']);
  assert.equal(cache.has('/images/new.jpg'), false);
  assert.throws(() => cache.remember('/video.mp4', { type: 'video/mp4' }), TypeError);
});

test('sandbox thumbnails stay bounded, cached and tolerate undecodable media', async () => {
  let decodes = 0;
  let dimensions;
  const options = {
    Image: class { naturalWidth = 2000; naturalHeight = 1000; async decode() { decodes++; } },
    document: { createElement: () => ({ getContext: () => ({ drawImage: (...args) => { dimensions = args.slice(-2); } }), toDataURL: () => 'data:image/webp;base64,YQ==' }) }
  };
  const media = { previewUrl: 'blob:preview' };
  assert.equal(await imageThumbnail(media, options), 'data:image/webp;base64,YQ==');
  assert.equal(await imageThumbnail(media, options), 'data:image/webp;base64,YQ==');
  assert.deepEqual(dimensions, [960, 480]);
  assert.equal(decodes, 1);
  assert.equal(await imageThumbnail({ previewUrl: 'blob:bad' }, { Image: class { async decode() { throw Error('bad image'); } } }), '');
});

test('opaque preview substitution never requires blob access or alters unrelated media', () => {
  const html = '<html><body><img src="/new.png"><img src="/old.png"><video><source src="/new.mp4"></video></body></html>';
  const replacements = new Map([['/new.png', 'data:image/png;base64,YQ=='], ['/new.mp4', '']]);
  const rendered = applyPreviewMedia(html, replacements, { DOMParser, pendingText: 'Save to play', placeholderClass: 'pending' });
  assert.match(rendered, /data:image\/png;base64,YQ==/);
  assert.match(rendered, /src="\/old.png"/);
  assert.match(rendered, /Save to play/);
  assert.doesNotMatch(rendered, /<video|blob:/);
  assert.match(html, /src="\/new.png"/);
});

test('blank placeholders are omitted without swallowing unsafe or meaningful blocks', () => {
  assert.equal(isEmptyTextBlock({ type: 'text', body: ' ', align: 'left' }), true);
  for (const value of [{ type: 'text', body: 'Story' }, { type: 'text', html: '<script>bad()</script>' }, { type: 'image', src: '' }, null]) assert.equal(isEmptyTextBlock(value), false);
});

test('alt text is advisory and decorative state is never inferred from an empty value', () => {
  assert.deepEqual(normalizeImageAccessibility({ alt: '' }), { alt: '', decorative: false, notices: ['recommended'] });
  assert.deepEqual(normalizeImageAccessibility({ alt: 'ignored', decorative: true }), { alt: '', decorative: true, notices: ['normalized'] });
  const result = normalizeImageAccessibility({ alt: '<b>A</b>'.repeat(400) });
  assert.equal(result.alt.length, 300);
  assert.doesNotMatch(result.alt, /<|>/);
  assert.deepEqual(result.notices, ['normalized']);
});
