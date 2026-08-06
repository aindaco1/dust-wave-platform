export const DEFAULT_PLATFORM_TIME_ZONE: "America/Denver";

export interface TimeZoneOption {
  value: string;
  label: string;
}

export function getSupportedTimeZones(): readonly string[];
export function getTimeZoneOptions(): TimeZoneOption[];
export function isSupportedTimeZone(value: unknown): boolean;
export function normalizeTimeZone(value: unknown, fallback?: string): string;
