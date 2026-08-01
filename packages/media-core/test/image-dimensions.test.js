import assert from 'node:assert/strict';
import test from 'node:test';

import { imageDimensions } from '../src/image-dimensions.js';

test('reads a PNG header without decoding image pixels', () => {
  assert.deepEqual(
    imageDimensions(pngHeader(3_000, 1_400), 'image/png'),
    { width: 3_000, height: 1_400 }
  );
  assert.equal(imageDimensions(new Uint8Array(24), 'image/png'), null);
});

test('reads baseline and progressive JPEG dimensions', () => {
  assert.deepEqual(
    imageDimensions(jpegHeader(0xc0, 3_000, 3_000), 'image/jpeg'),
    { width: 3_000, height: 3_000 }
  );
  assert.deepEqual(
    imageDimensions(jpegHeader(0xc2, 1_400, 1_400), 'image/jpeg'),
    { width: 1_400, height: 1_400 }
  );
});

test('fails closed for malformed, truncated, and unsupported input', () => {
  assert.equal(imageDimensions(new Uint8Array([0xff, 0xd8]), 'image/jpeg'), null);
  assert.equal(imageDimensions(pngHeader(10, 10), 'image/webp'), null);
  assert.equal(imageDimensions('not bytes', 'image/png'), null);
});

function pngHeader(width, height) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function jpegHeader(marker, width, height) {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, marker,
    0x00, 0x0b,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01,
    0x01, 0x11, 0x00
  ]);
}
