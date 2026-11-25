// WCAG relative luminance for opaque sRGB hex colors.
function luminance(color) {
  if (typeof color !== 'string') return null;
  let hex = color.trim();
  if (/^#[0-9a-f]{3}$/i.test(hex)) hex = hex.replace(/[0-9a-f]/gi, digit => digit + digit);
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const channels = [1, 3, 5].map(start => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function firstReadableTextColor(background, foregrounds) {
  const surface = luminance(background);
  if (surface === null) return null;
  for (const color of foregrounds) {
    const ink = luminance(color);
    if (ink === null) continue;
    const ratio = (Math.max(surface, ink) + 0.05) / (Math.min(surface, ink) + 0.05);
    if (ratio >= 4.5) return color;
  }
  return null;
}
