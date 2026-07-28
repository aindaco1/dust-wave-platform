import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generatePodcastBenefitCode,
  isPodcastBenefitCode,
  normalizePodcastBenefitCode,
  PODCAST_BENEFIT_CODE_LENGTH
} from '../src/podcast-benefits.js';

test('normalizes the shared Pool and Podcast code contract', () => {
  const code = 'DW-POD-ABCDEFGH-JKLMNPQR-STUVWXYZ-23456789';
  assert.equal(normalizePodcastBenefitCode(`  ${code.toLowerCase()}  `), code);
  assert.equal(isPodcastBenefitCode(code), true);
  assert.equal(isPodcastBenefitCode('DW-POD-AAAAAAAA-AAAAAAAA-AAAAAAAA-AAAAAAA0'), false);
  assert.equal(PODCAST_BENEFIT_CODE_LENGTH, 42);
  assert.throws(
    () => normalizePodcastBenefitCode('not-a-benefit-code'),
    /Podcast benefit code is invalid/
  );
});

test('generates four unbiased high-entropy code groups', () => {
  const code = generatePodcastBenefitCode((bytes) => {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = index;
    }
  });
  assert.equal(
    code,
    'DW-POD-ABCDEFGH-JKLMNPQR-STUVWXYZ-23456789'
  );
  assert.equal(code.length, PODCAST_BENEFIT_CODE_LENGTH);
  assert.equal(isPodcastBenefitCode(code), true);
});

test('rejects a random source that replaces the destination buffer', () => {
  assert.throws(
    () => generatePodcastBenefitCode(() => new Uint8Array(32)),
    /fill the provided byte array/
  );
});
