export class RequestValidationError extends Error {
  status: number;
  code: string;
  constructor(message: string, code?: string, status?: number);
}

export function readBoundedText(
  request: Request,
  maximumBytes: number,
  bodyName?: string
): Promise<string>;

export function readBoundedBytes(
  request: Request,
  maximumBytes: number,
  bodyName?: string
): Promise<Uint8Array>;

export function readJsonObject(
  request: Request,
  maximumBytes?: number
): Promise<Record<string, unknown>>;

export function readOptionalJsonObject(
  request: Request,
  maximumBytes?: number
): Promise<Record<string, unknown>>;

export function requiredText(
  value: unknown,
  field: string,
  maximumLength?: number
): string;

export function optionalText(
  value: unknown,
  field: string,
  maximumLength?: number
): string;

export function validSlug(value: unknown, field?: string): string;
export function validIdentifier(value: unknown, field?: string): string;
export function validDateTime(value: unknown, field: string): string | null;
export function safeFilename(value: unknown): string;

export function positiveInteger(
  value: unknown,
  field: string,
  maximum?: number
): number;

export function boundedPageSize(
  value: string | null,
  defaultValue?: number,
  maximum?: number,
  field?: string
): number;

export function isTruthy(value: unknown): boolean;
