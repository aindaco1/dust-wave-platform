// Headers are ready immediately. The body honors the fetch signal during transfer.
export function delayedJson(value, signal, delayMs = 50) {
  return new Response(new ReadableStream({
    start(controller) {
      const abort = () => {
        clearTimeout(timer);
        controller.error(signal.reason);
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', abort);
        controller.enqueue(new TextEncoder().encode(JSON.stringify(value)));
        controller.close();
      }, delayMs);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    }
  }));
}
