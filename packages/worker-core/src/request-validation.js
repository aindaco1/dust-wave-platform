export class RequestValidationError extends Error {
  constructor(message, code = 'invalid_request', status = 400) {
    super(message);
    this.name = 'RequestValidationError';
    this.code = code;
    this.status = status;
  }
}

export async function readBoundedText(
  request,
  maximumBytes,
  bodyName = 'Request body'
) {
  return new TextDecoder().decode(
    await readBoundedBytes(request, maximumBytes, bodyName)
  );
}

export async function readBoundedBytes(
  request,
  maximumBytes,
  bodyName = 'Request body'
) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0) {
    throw new TypeError('maximumBytes must be a non-negative integer');
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (
      Number.isSafeInteger(declaredLength)
      && declaredLength >= 0
      && declaredLength > maximumBytes
    ) {
      throw new RequestValidationError(
        `${bodyName} is too large`,
        'body_too_large',
        413
      );
    }
  }

  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        try {
          await reader.cancel('body_too_large');
        } catch {
          // Preserve the stable validation error if upstream cancellation fails.
        }
        throw new RequestValidationError(
          `${bodyName} is too large`,
          'body_too_large',
          413
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bodyBytes;
}

export async function readJsonObject(request, maximumBytes = 1_000_000) {
  const text = await readBoundedText(request, maximumBytes);
  const value = parseJson(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestValidationError('A JSON object is required');
  }
  return value;
}

export async function readOptionalJsonObject(request, maximumBytes = 10_000) {
  const text = await readBoundedText(request, maximumBytes);
  if (!text.trim()) return {};
  const value = parseJson(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestValidationError('A JSON object is required');
  }
  return value;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function requiredText(value, field, maximumLength = 500) {
  const text = String(value ?? '').trim();
  if (!text) throw new RequestValidationError(`${field} is required`);
  if (text.length > maximumLength) {
    throw new RequestValidationError(`${field} is too long`);
  }
  return text;
}

export function optionalText(value, field, maximumLength = 10_000) {
  const text = String(value ?? '').trim();
  if (text.length > maximumLength) {
    throw new RequestValidationError(`${field} is too long`);
  }
  return text;
}

export function validSlug(value, field = 'slug') {
  const slug = requiredText(value, field, 120).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new RequestValidationError(`${field} must be URL-safe`);
  }
  return slug;
}

export function validIdentifier(value, field = 'id') {
  const id = requiredText(value, field, 160);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) {
    throw new RequestValidationError(`${field} is invalid`);
  }
  return id;
}

export function validDateTime(value, field) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new RequestValidationError(`${field} must be an ISO date-time`);
  }
  return date.toISOString();
}

export function safeFilename(value) {
  const filename = requiredText(value, 'filename', 180)
    .normalize('NFKC')
    .replace(/[^A-Za-z0-9._ -]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  if (filename === '.' || filename === '..') {
    throw new RequestValidationError('filename is invalid');
  }
  return filename;
}

export function positiveInteger(
  value,
  field,
  maximum = Number.MAX_SAFE_INTEGER
) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0 || number > maximum) {
    throw new RequestValidationError(`${field} must be a positive integer`);
  }
  return number;
}

export function boundedPageSize(
  value,
  defaultValue = 50,
  maximum = 100,
  field = 'limit'
) {
  if (value === null || value === '') return defaultValue;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new RequestValidationError(
      `${field} must be between 1 and ${maximum}`
    );
  }
  return parsed;
}

export function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(
    String(value ?? '').trim().toLowerCase()
  );
}
