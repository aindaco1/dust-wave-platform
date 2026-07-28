export interface MarketingQr {
  addData(value: string): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, column: number): boolean;
}

export type MarketingQrFactory = (
  typeNumber: number,
  errorCorrectionLevel: "M"
) => MarketingQr;

export interface CanvasLike {
  width: number;
  height: number;
  getContext(contextId: "2d"): {
    fillStyle: string;
    fillRect(
      x: number,
      y: number,
      width: number,
      height: number
    ): void;
  } | null;
}

export function normalizeMarketingReferralCode(value: unknown): string;

export function safeMarketingFilename(
  value: unknown,
  fallback?: string
): string;

export function buildTaggedMarketingUrl(input: {
  canonicalUrl: string | URL;
  source?: unknown;
  medium?: unknown;
  campaign?: unknown;
  content?: unknown;
  ref?: unknown;
  allowedOrigins?: Iterable<string | URL>;
}): string;

export function createMarketingQr(
  value: unknown,
  qrFactory?: MarketingQrFactory
): MarketingQr | null;

export function qrSvgMarkup(
  qr: MarketingQr,
  options?: {
    cellSize?: number;
    margin?: number;
    label?: string;
  }
): string;

export function drawQrCanvas(
  qr: MarketingQr,
  canvas: CanvasLike,
  options?: {
    cellSize?: number;
    margin?: number;
  }
): { width: number; height: number };

export function shareCardSvgMarkup(input: {
  brand: unknown;
  eyebrow: unknown;
  title: unknown;
  summary?: unknown;
  footer?: unknown;
  artworkDataUrl?: unknown;
  accent?: unknown;
  language?: unknown;
}): string;

