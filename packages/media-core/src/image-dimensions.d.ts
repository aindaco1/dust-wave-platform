export type ImageDimensions = {
  width: number;
  height: number;
};

export function imageDimensions(
  bytes: Uint8Array,
  contentType: string
): ImageDimensions | null;

/** Read only the first PNG chunk. A null result requires the caller's normal decoder. */
export function readPngDimensions(file: Blob): Promise<ImageDimensions | null>;
