export async function fetchWithTimeout(
  input,
  init,
  timeoutMs,
  { fetchTarget = globalThis.fetch } = {}
) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('timeoutMs must be a positive integer');
  }
  if (init.signal) {
    throw new TypeError('fetchWithTimeout manages its own abort signal');
  }
  if (typeof fetchTarget !== 'function') {
    throw new TypeError('fetchTarget must be a function');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchTarget(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
