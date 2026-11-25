/** Advisory prefix detection on the supplied view. Other or incomplete signatures return null. */
export function detectImageType(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null;

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
