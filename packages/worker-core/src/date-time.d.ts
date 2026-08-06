export interface PlatformTimeZoneEnvironment {
  PLATFORM_TIMEZONE?: unknown;
}

export interface TimeZoneParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timeZone: string;
}

export type DateInput = Date | string | number;
export type TimeZoneEnvironmentOrValue = PlatformTimeZoneEnvironment | string;

export function getPlatformTimeZone(env?: PlatformTimeZoneEnvironment): string;
export function getTimeZoneParts(date?: DateInput, timeZone?: string): TimeZoneParts;
export function getPlatformTimeParts(env?: PlatformTimeZoneEnvironment, date?: DateInput): TimeZoneParts;
export function getTimeZoneDateKey(date?: DateInput, timeZone?: string): string;
export function getPlatformDateKey(env?: PlatformTimeZoneEnvironment, date?: DateInput): string;
export function dateAtTimeInTimeZone(
  dateString: unknown,
  timeZone?: string,
  hour?: number,
  minute?: number,
  second?: number
): Date;
export function platformDateStart(dateString: unknown, envOrTimeZone?: TimeZoneEnvironmentOrValue): Date;
export function platformDateEnd(dateString: unknown, envOrTimeZone?: TimeZoneEnvironmentOrValue): Date;
export function isPlatformDatePast(
  dateString: unknown,
  envOrTimeZone?: TimeZoneEnvironmentOrValue,
  now?: Date
): boolean;
export function formatInPlatformTimeZone(
  env?: PlatformTimeZoneEnvironment,
  date?: DateInput,
  options?: Intl.DateTimeFormatOptions & { locale?: string }
): string;
export function isInPlatformDailyWindow(
  env?: PlatformTimeZoneEnvironment,
  date?: DateInput,
  options?: { hour?: number; minuteWindow?: number }
): boolean;
