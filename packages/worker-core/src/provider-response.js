// Internal. Each adapter decides which status and body work belongs to one network attempt.
export async function fetchProviderResponse(input, init, timeoutMs, fetchTarget, consume) {
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
    const response = await fetchTarget(input, {
      ...init,
      signal: controller.signal
    });
    return await consume(response, controller.signal);
  } catch (error) {
    controller.signal.throwIfAborted();
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
