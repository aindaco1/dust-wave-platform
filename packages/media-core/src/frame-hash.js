/**
 * Canonicalize FFmpeg framehash sample aspect ratios without discarding any
 * decoded-frame, geometry, or timing evidence. PNG optimizers can reduce a
 * density ratio such as 11811/11811 to 1/1 without changing the image.
 * The caller owns decoding, hashing, comparison, and publication policy.
 */
export function normalizeFrameHashAspectRatios(frameHash) {
  if (typeof frameHash !== 'string' || frameHash.length > 8 * 1024 * 1024) {
    throw new TypeError('Expected bounded FFmpeg framehash text');
  }
  let count = 0;
  const normalized = frameHash.replace(/^#sar (\d+): ([^\r\n]+)$/gm, (_line, stream, ratio) => {
    const match = /^(\d{1,20})\/(\d{1,20})$/.exec(ratio);
    if (!match || BigInt(match[2]) === 0n) throw new TypeError('Invalid sample aspect ratio');
    const numerator = BigInt(match[1]);
    const denominator = BigInt(match[2]);
    let a = numerator;
    let b = denominator;
    while (b) [a, b] = [b, a % b];
    count += 1;
    return `#sar ${stream}: ${numerator / a}/${denominator / a}`;
  });
  if (!count) throw new TypeError('Missing sample aspect ratio');
  return normalized;
}
