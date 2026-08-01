const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3,
  0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb,
  0xcd, 0xce, 0xcf
]);

export function imageDimensions(bytes, contentType) {
  if (!(bytes instanceof Uint8Array)) return null;
  if (contentType === 'image/png') return pngDimensions(bytes);
  if (contentType === 'image/jpeg') return jpegDimensions(bytes);
  return null;
}

function pngDimensions(bytes) {
  if (
    bytes.length < 24
    || ![137, 80, 78, 71, 13, 10, 26, 10]
      .every((value, index) => bytes[index] === value)
  ) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return validDimensions(width, height) ? { width, height } : null;
}

function jpegDimensions(bytes) {
  if (
    bytes.length < 4
    || bytes[0] !== 0xff
    || bytes[1] !== 0xd8
  ) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return validDimensions(width, height) ? { width, height } : null;
    }
    offset += 2 + length;
  }
  return null;
}

function validDimensions(width, height) {
  return Number.isSafeInteger(width)
    && Number.isSafeInteger(height)
    && width > 0
    && height > 0;
}
