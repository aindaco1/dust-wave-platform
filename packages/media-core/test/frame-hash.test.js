import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeFrameHashAspectRatios } from '../src/frame-hash.js';

const frameHash = (ratio = '1/1') => `#format: frame checksums
#version: 2
#hash: SHA256
#tb 0: 1/25
#dimensions 0: 1000x563
#sar 0: ${ratio}
0, 0, 0, 1, 2252000, 5c7cd2e352ecb2ad17d1b5eb7c691aaa383b17385a91df45feae9193946963a4
`;

test('equivalent PNG density ratios retain identical pixel and timing evidence', () => {
  assert.equal(normalizeFrameHashAspectRatios(frameHash('11811/11811')), frameHash());
  assert.equal(normalizeFrameHashAspectRatios(frameHash('32/30')), frameHash('16/15'));
  assert.equal(normalizeFrameHashAspectRatios(frameHash('0/11811')), frameHash('0/1'));
});

test('real aspect, pixel, dimensions, and animation changes remain distinguishable', () => {
  const baseline = normalizeFrameHashAspectRatios(frameHash());
  for (const changed of [frameHash('2/1'), frameHash().replace('1000x563', '563x1000'),
    frameHash().replace('5c7cd2', '6c7cd2'), frameHash().replace('0, 0, 0, 1,', '0, 0, 0, 2,'),
    frameHash() + '0, 1, 1, 1, 2252000, additional-frame\n']) {
    assert.notEqual(normalizeFrameHashAspectRatios(changed), baseline);
  }
});

test('malformed or absent evidence fails closed', () => {
  for (const input of [null, '', frameHash('1/0'), frameHash('-1/1'), frameHash('1/nope'),
    frameHash('1.5/1'), frameHash('1/'.padEnd(25, '2')), 'x'.repeat(8 * 1024 * 1024 + 1)]) {
    assert.throws(() => normalizeFrameHashAspectRatios(input), TypeError);
  }
});
