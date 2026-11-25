// RFC 5545 TEXT values; apply only to text properties, never to a whole line.
export function escapeIcsText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|[\r\n]/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

export function foldIcsLine(line) {
  let result = '';
  let start = 0;
  let offset = 0;
  let bytes = 0;
  for (const character of line) {
    const code = character.codePointAt(0);
    const width = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes + width > 75) {
      result += line.slice(start, offset) + '\r\n ';
      start = offset;
      bytes = 1; // The continuation space counts towards the next 75 octets.
    }
    bytes += width;
    offset += character.length;
  }
  return result + line.slice(start);
}
