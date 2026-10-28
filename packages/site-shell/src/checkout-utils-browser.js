(function(scope) {
  'use strict';
  if (scope.DustWaveCheckoutUtils) return;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MAX_EMAIL_LENGTH = 254;
  function isValidEmail(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(value);
  }
  function isPostalComplete(country, postal) {
    const value = String(postal || '').trim();
    return Boolean(value) && (String(country || '').toUpperCase() !== 'US' || /^\d{5}(?:-\d{4})?$/.test(value));
  }
  // Call clear on input, then sync after updating readiness. No payment policy
  // or automatic retry: the consumer owns run(), including error recovery.
  function createDebouncedAction({ ready, run, delay = 350, schedule = setTimeout, cancel = clearTimeout }) {
    let timer = null;
    function clear() { if (timer !== null) cancel(timer); timer = null; }
    return { clear, sync() {
      if (!ready()) { clear(); return; }
      if (timer !== null) return;
      timer = schedule(() => { timer = null; if (ready()) run(); }, delay);
    } };
  }
  // Incrementing generations also reject an A -> B -> A response race.
  function createLatestCheck({ request, changed, delay = 350, schedule = setTimeout, cancel = clearTimeout }) {
    let generation = 0, timer = null;
    let state = { signature: '', pending: false, results: {} };
    function reset() {
      generation++;
      if (timer !== null) cancel(timer);
      timer = null;
      state = { signature: '', pending: false, results: {} };
    }
    return { get state() { return state; }, reset, update(signature, payload) {
      if (state.signature === signature) return state;
      reset();
      if (payload === null) { state = { signature, pending: false, results: {} }; return state; }
      const current = generation;
      state = { signature, pending: true, results: {} };
      timer = schedule(async () => {
        timer = null;
        let results = {};
        try { results = await request(payload); } catch (_error) {
          // An unavailable lookup is not evidence of invalid input. The
          // consumer's canonical submission must still validate it.
        }
        if (current !== generation) return;
        state = { signature, pending: false, results };
        changed(state);
      }, delay);
      return state;
    } };
  }
  function readDetailsSignature(fields, context = {}) {
    return JSON.stringify({ fields: Array.from(fields, (field) => field.type === 'checkbox' ? field.checked : field.value), ...context });
  }
  function createPaymentReveal() {
    let revealed = false;
    return { reset() { revealed = false; }, reveal(container, target, reducedMotion = false) {
      if (revealed || !container || !target || !container.contains(target)) return false;
      revealed = true;
      container.scrollTo({ top: container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top,
        behavior: reducedMotion ? 'auto' : 'smooth' });
      return true;
    } };
  }
  scope.DustWaveCheckoutUtils = Object.freeze({ EMAIL_PATTERN, MAX_EMAIL_LENGTH, isValidEmail, isPostalComplete,
    createDebouncedAction, createLatestCheck, readDetailsSignature, createPaymentReveal });
})(typeof window !== 'undefined' ? window : globalThis);
