export interface BoundedBody {
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
}
/** Caller supplies a finite non-negative byte budget. Cancellation and stream failures propagate as documented. */
export function readBoundedBytes(response: BoundedBody, maxBytes: number): Promise<Uint8Array>;
export function readBoundedText(response: BoundedBody, maxBytes: number): Promise<string>;
/** Parses JSON without schema validation; the consumer must validate the returned shape. */
export function readBoundedJson<T = unknown>(response: BoundedBody, maxBytes: number): Promise<T>;
