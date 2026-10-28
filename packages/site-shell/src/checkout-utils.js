import './checkout-utils-browser.js';
const utils = (typeof window !== 'undefined' ? window : globalThis).DustWaveCheckoutUtils;
export const { EMAIL_PATTERN, MAX_EMAIL_LENGTH, isValidEmail, isPostalComplete,
  createDebouncedAction, createLatestCheck, readDetailsSignature, createPaymentReveal } = utils;
