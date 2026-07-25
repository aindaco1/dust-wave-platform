const MARKETING_URL_MAX_LENGTH = 2048;
const MARKETING_VALUE_MAX_LENGTH = 160;

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
