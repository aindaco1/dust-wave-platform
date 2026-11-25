import assert from 'node:assert/strict';
import test from 'node:test';
import { firstReadableTextColor } from '../src/color-contrast.js';

test('selects the first foreground reaching 4.5:1, preserving the caller’s palette order', () => {
  const palette = ['#ffffff', '#111111', '#000000'];
  assert.equal(firstReadableTextColor('#101215', palette), '#ffffff');
  assert.equal(firstReadableTextColor(' #999 ', palette), '#111111');
  assert.equal(firstReadableTextColor('#777777', palette), '#000000');
  assert.equal(firstReadableTextColor('#FFF', ['#badbad', '#ABC', '#123']), '#123');
  assert.equal(firstReadableTextColor('#777', ['#fff', '#111']), null);
  assert.equal(firstReadableTextColor('transparent', palette), null);
  assert.equal(firstReadableTextColor('#000', ['invalid', '#AbC']), '#AbC');
});
