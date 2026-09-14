import { readBoundedStream } from './bounded-stream.js';

export async function readBoundedBytes(response, maxBytes) {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw new Error(`Response declared ${declared} bytes; cap is ${maxBytes}`);
  }
  return readBoundedStream(response.body, maxBytes, {
    overflow() { throw new Error(`Response exceeded ${maxBytes} byte cap`); },
    async cleanup(reader) { await reader.cancel().catch(() => undefined); }
  });
}

export async function readBoundedText(response, maxBytes) {
  return new TextDecoder().decode(await readBoundedBytes(response, maxBytes));
}

export async function readBoundedJson(response, maxBytes) {
  return JSON.parse(await readBoundedText(response, maxBytes));
}
