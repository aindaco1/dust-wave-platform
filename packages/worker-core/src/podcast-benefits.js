const PODCAST_BENEFIT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PODCAST_BENEFIT_CODE_REGEX =
  /^DW-POD-[A-HJ-NP-Z2-9]{8}(?:-[A-HJ-NP-Z2-9]{8}){3}$/;

export const PODCAST_BENEFIT_CODE_LENGTH = 42;

export function isPodcastBenefitCode(value) {
  return PODCAST_BENEFIT_CODE_REGEX.test(
    String(value ?? '').trim().toUpperCase()
  );
}

export function normalizePodcastBenefitCode(value) {
  const code = String(value ?? '').trim().toUpperCase();
  if (!PODCAST_BENEFIT_CODE_REGEX.test(code)) {
    throw new TypeError('Podcast benefit code is invalid');
  }
  return code;
}

export function generatePodcastBenefitCode(
  fillRandomValues = (bytes) => crypto.getRandomValues(bytes)
) {
  if (typeof fillRandomValues !== 'function') {
    throw new TypeError('fillRandomValues must be a function');
  }
  const bytes = new Uint8Array(32);
  const filled = fillRandomValues(bytes);
  if (filled !== undefined && filled !== bytes) {
    throw new TypeError('fillRandomValues must fill the provided byte array');
  }
  const characters = Array.from(
    bytes,
    (byte) => PODCAST_BENEFIT_ALPHABET[byte & 31]
  );
  const groups = [];
  for (let index = 0; index < characters.length; index += 8) {
    groups.push(characters.slice(index, index + 8).join(''));
  }
  return `DW-POD-${groups.join('-')}`;
}
