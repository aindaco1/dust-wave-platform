export type ImageDimensions = {
  width: number;
  height: number;
};

export function imageDimensions(
  bytes: Uint8Array,
  contentType: string
): ImageDimensions | null;
