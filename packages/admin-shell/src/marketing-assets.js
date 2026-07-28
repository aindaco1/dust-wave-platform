const MARKETING_URL_MAX_LENGTH = 2048;
const MARKETING_VALUE_MAX_LENGTH = 160;
const MARKETING_SHARE_CARD_IMAGE_MAX_LENGTH = 4_000_024;

export function normalizeMarketingReferralCode(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function safeMarketingFilename(value, fallback = "marketing") {
  const normalizedFallback = String(fallback || "marketing")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "marketing";
  return String(value || normalizedFallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || normalizedFallback;
}

export function buildTaggedMarketingUrl({
  canonicalUrl,
  source = "",
  medium = "",
  campaign = "",
  content = "",
  ref = "",
  allowedOrigins = []
}) {
  const url = parseMarketingUrl(canonicalUrl);
  const origins = new Set(
    Array.from(allowedOrigins || [], (value) => {
      try {
        return new URL(String(value)).origin;
      } catch {
        return "";
      }
    }).filter(Boolean)
  );
  if (origins.size > 0 && !origins.has(url.origin)) {
    throw new TypeError("canonicalUrl origin is not allowed");
  }
  const values = {
    utm_source: normalizeMarketingValue(source, "source"),
    utm_medium: normalizeMarketingValue(medium, "medium"),
    utm_campaign: normalizeMarketingValue(campaign, "campaign"),
    utm_content: normalizeMarketingValue(content, "content"),
    ref: normalizeMarketingReferralCode(ref)
  };
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  const result = url.toString();
  if (result.length > MARKETING_URL_MAX_LENGTH) {
    throw new RangeError("Tagged marketing URL is too long");
  }
  return result;
}

export function createMarketingQr(
  value,
  qrFactory = globalThis.qrcode
) {
  const text = String(value ?? "").trim();
  if (!text || typeof qrFactory !== "function") return null;
  if (text.length > MARKETING_URL_MAX_LENGTH) {
    throw new RangeError("QR value is too long");
  }
  const qr = qrFactory(0, "M");
  qr.addData(text);
  qr.make();
  return qr;
}

export function qrSvgMarkup(
  qr,
  { cellSize = 8, margin = 4, label = "Marketing QR code" } = {}
) {
  assertQr(qr);
  const cell = boundedInteger(cellSize, "cellSize", 1, 64);
  const quietZone = boundedInteger(margin, "margin", 0, 16);
  const moduleCount = qr.getModuleCount();
  const size = (moduleCount + quietZone * 2) * cell;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${escapeAttribute(label)}">`,
    '<rect width="100%" height="100%" fill="#fff"/>'
  ];
  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (!qr.isDark(row, column)) continue;
      parts.push(
        `<rect x="${(column + quietZone) * cell}" y="${(row + quietZone) * cell}" width="${cell}" height="${cell}" fill="#000"/>`
      );
    }
  }
  parts.push("</svg>");
  return parts.join("");
}

export function drawQrCanvas(
  qr,
  canvas,
  { cellSize = 8, margin = 4 } = {}
) {
  assertQr(qr);
  if (!canvas || typeof canvas.getContext !== "function") {
    throw new TypeError("A canvas-like target is required");
  }
  const cell = boundedInteger(cellSize, "cellSize", 1, 64);
  const quietZone = boundedInteger(margin, "margin", 0, 16);
  const moduleCount = qr.getModuleCount();
  const size = (moduleCount + quietZone * 2) * cell;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new TypeError("A 2D canvas context is required");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#000";
  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (qr.isDark(row, column)) {
        context.fillRect(
          (column + quietZone) * cell,
          (row + quietZone) * cell,
          cell,
          cell
        );
      }
    }
  }
  return { width: size, height: size };
}

export function shareCardSvgMarkup({
  brand,
  eyebrow,
  title,
  summary = "",
  footer = "",
  artworkDataUrl = "",
  accent = "#ffd54d",
  language = "en"
}) {
  const normalized = {
    brand: normalizeShareCardText(brand, "brand", 32),
    eyebrow: normalizeShareCardText(eyebrow, "eyebrow", 56),
    title: normalizeShareCardText(title, "title", 160),
    summary: normalizeShareCardText(summary, "summary", 320, true),
    footer: normalizeShareCardText(footer, "footer", 32, true)
  };
  if (!normalized.brand || !normalized.eyebrow || !normalized.title) {
    throw new TypeError("brand, eyebrow, and title are required");
  }
  const normalizedAccent = normalizeShareCardColor(accent);
  const locale = String(language || "en").toLowerCase().startsWith("es")
    ? "es"
    : "en";
  const artwork = normalizeShareCardArtwork(artworkDataUrl);
  const eyebrowLines = wrapShareCardText(
    normalized.eyebrow.toLocaleUpperCase(locale),
    28,
    2
  );
  const titleLines = wrapShareCardText(
    normalized.title.toLocaleUpperCase(locale),
    13,
    3
  );
  const summaryLines = wrapShareCardText(normalized.summary, 32, 3);
  const titleFontSize = titleLines.length >= 3 ? 46 : titleLines.length === 2 ? 56 : 68;
  const titleLineHeight = titleFontSize + 4;
  const titleY = 255;
  const summaryY = titleY + (titleLines.length - 1) * titleLineHeight + 68;
  const summaryLineHeight = 34;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeAttribute(normalized.title)}">
  <defs>
    <linearGradient id="share-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090909"/>
      <stop offset="60%" stop-color="#151515"/>
      <stop offset="100%" stop-color="#241f12"/>
    </linearGradient>
    <clipPath id="share-artwork-clip">
      <rect x="52" y="52" width="526" height="526" rx="28" ry="28"/>
    </clipPath>
  </defs>
  <rect width="1200" height="630" fill="url(#share-bg)"/>
  <rect x="52" y="52" width="526" height="526" rx="28" ry="28" fill="#202020"/>
  ${artwork ? `<image href="${escapeAttribute(artwork)}" x="52" y="52" width="526" height="526" preserveAspectRatio="xMidYMid slice" clip-path="url(#share-artwork-clip)"/>` : ""}
  <rect x="52" y="52" width="526" height="526" rx="28" ry="28" fill="none" stroke="${normalizedAccent}" stroke-width="4"/>
  <text x="628" y="94" fill="${normalizedAccent}" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" letter-spacing="3">${escapeAttribute(normalized.brand.toLocaleUpperCase(locale))}</text>
  <text x="628" y="155" fill="#d8d8d8" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" letter-spacing="1.5">${eyebrowLines.map((line, index) => `<tspan x="628" dy="${index === 0 ? 0 : 28}">${escapeAttribute(line)}</tspan>`).join("")}</text>
  <text x="628" y="${titleY}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="${titleFontSize}" font-weight="800">${titleLines.map((line, index) => `<tspan x="628" dy="${index === 0 ? 0 : titleLineHeight}">${escapeAttribute(line)}</tspan>`).join("")}</text>
  ${summaryLines.length ? `<text x="628" y="${summaryY}" fill="#d0d0d0" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="400">${summaryLines.map((line, index) => `<tspan x="628" dy="${index === 0 ? 0 : summaryLineHeight}">${escapeAttribute(line)}</tspan>`).join("")}</text>` : ""}
  <rect x="628" y="548" width="84" height="5" rx="2.5" fill="${normalizedAccent}"/>
  ${normalized.footer ? `<text x="732" y="559" fill="#b8b8b8" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="600">${escapeAttribute(normalized.footer)}</text>` : ""}
</svg>`;
}

function parseMarketingUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? "").trim());
  } catch {
    throw new TypeError("canonicalUrl must be an absolute URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new TypeError("canonicalUrl must use http or https");
  }
  return url;
}

function normalizeShareCardText(value, field, maximum, optional = false) {
  const raw = String(value ?? "");
  if (/[\u0000-\u001f\u007f]/.test(raw)) {
    throw new TypeError(`${field} contains unsupported control characters`);
  }
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text && optional) return "";
  if (text.length > maximum) {
    throw new RangeError(`${field} is too long`);
  }
  return text;
}

function normalizeShareCardColor(value) {
  const color = String(value || "").trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(color)) {
    throw new TypeError("accent must be a six-digit hex color");
  }
  return color;
}

function normalizeShareCardArtwork(value) {
  const artwork = String(value || "").trim();
  if (!artwork) return "";
  if (artwork.length > MARKETING_SHARE_CARD_IMAGE_MAX_LENGTH) {
    throw new RangeError("artworkDataUrl is too long");
  }
  if (!/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(artwork)) {
    throw new TypeError("artworkDataUrl must be a base64 PNG, JPEG, or WebP image");
  }
  return artwork;
}

function wrapShareCardText(value, maxCharsPerLine, maxLines) {
  const words = String(value || "").split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const lines = [];
  let current = "";
  let wordIndex = 0;
  while (wordIndex < words.length && lines.length < maxLines) {
    const word = words[wordIndex];
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      wordIndex += 1;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
      continue;
    }
    lines.push(word.slice(0, maxCharsPerLine));
    words[wordIndex] = word.slice(maxCharsPerLine);
    if (!words[wordIndex]) wordIndex += 1;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (wordIndex < words.length && lines.length > 0) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = `${lines[lastIndex].slice(0, maxCharsPerLine - 1).trimEnd()}…`;
  }
  return lines;
}

function normalizeMarketingValue(value, field) {
  const text = String(value ?? "").trim();
  if (/[\u0000-\u001f\u007f]/.test(text)) {
    throw new TypeError(`${field} contains unsupported control characters`);
  }
  if (text.length > MARKETING_VALUE_MAX_LENGTH) {
    throw new RangeError(`${field} is too long`);
  }
  return text;
}

function assertQr(qr) {
  if (
    !qr
    || typeof qr.getModuleCount !== "function"
    || typeof qr.isDark !== "function"
  ) {
    throw new TypeError("A generated QR matrix is required");
  }
}

function boundedInteger(value, field, minimum, maximum) {
  const number = Number(value);
  if (
    !Number.isSafeInteger(number)
    || number < minimum
    || number > maximum
  ) {
    throw new RangeError(
      `${field} must be an integer from ${minimum} to ${maximum}`
    );
  }
  return number;
}

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
