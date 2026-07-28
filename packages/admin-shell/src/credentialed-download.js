const DEFAULT_MAXIMUM_BYTES = 16 * 1024 * 1024;
const MAXIMUM_ERROR_BYTES = 64 * 1024;
const DEFAULT_CONTENT_TYPES = Object.freeze([
  "text/csv",
  "application/csv",
  "application/octet-stream"
]);

export class AdminDownloadError extends Error {
  constructor(message, {
    status = 0,
    code = "download_failed",
    details
  } = {}) {
    super(message);
    this.name = "AdminDownloadError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.data = details;
  }
}

export async function requestCredentialedBlob(url, {
  fetchImpl,
  method = "GET",
  headers,
  signal,
  maximumBytes = DEFAULT_MAXIMUM_BYTES,
  allowedContentTypes = DEFAULT_CONTENT_TYPES
} = {}) {
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (normalizedMethod !== "GET") {
    throw new TypeError("Credentialed downloads require GET");
  }
  if (
    !Number.isSafeInteger(maximumBytes)
    || maximumBytes < 1
    || maximumBytes > 256 * 1024 * 1024
  ) {
    throw new RangeError("maximumBytes is out of range");
  }
  const resolvedFetch = fetchImpl || globalThis.fetch;
  if (typeof resolvedFetch !== "function") {
    throw new TypeError("fetchImpl is required");
  }
  const response = await resolvedFetch.call(globalThis, String(url), {
    method: normalizedMethod,
    credentials: "include",
    headers: new Headers(headers),
    signal
  });
  if (!response.ok) {
    const details = await readErrorDetails(response);
    throw new AdminDownloadError(
      String(
        details.message
        || details.error
        || response.statusText
        || "Download failed"
      ),
      {
        status: response.status,
        code: String(details.error || "download_failed"),
        details
      }
    );
  }
  const contentType = normalizedContentType(
    response.headers.get("content-type")
  );
  const allowed = new Set(
    allowedContentTypes.map(normalizedContentType).filter(Boolean)
  );
  if (!contentType || !allowed.has(contentType)) {
    await response.body?.cancel().catch(() => {});
    throw new AdminDownloadError("Unexpected download content type", {
      status: response.status,
      code: "download_content_type_invalid"
    });
  }
  const declaredLength = boundedContentLength(
    response.headers.get("content-length")
  );
  if (declaredLength !== null && declaredLength > maximumBytes) {
    await response.body?.cancel().catch(() => {});
    throw new AdminDownloadError("Download is too large", {
      status: response.status,
      code: "download_too_large"
    });
  }
  const bytes = await readBoundedResponse(response, maximumBytes);
  return {
    blob: new Blob([bytes], { type: contentType }),
    filename: filenameFromContentDisposition(
      response.headers.get("content-disposition")
    ),
    contentType,
    size: bytes.byteLength
  };
}

export function filenameFromContentDisposition(value) {
  const disposition = String(value || "");
  const encoded = disposition.match(
    /(?:^|;)\s*filename\*=UTF-8''([^;]+)/i
  );
  if (encoded) {
    try {
      return safeDownloadFilename(decodeURIComponent(encoded[1].trim()));
    } catch {
      return "";
    }
  }
  const quoted = disposition.match(/(?:^|;)\s*filename="([^"]*)"/i);
  if (quoted) return safeDownloadFilename(quoted[1]);
  const plain = disposition.match(/(?:^|;)\s*filename=([^;]+)/i);
  return plain ? safeDownloadFilename(plain[1].trim()) : "";
}

export function triggerBlobDownload(result, fallbackFilename, {
  documentRef = globalThis.document,
  urlApi = globalThis.URL,
  schedule = globalThis.setTimeout
} = {}) {
  if (!(result?.blob instanceof Blob)) {
    throw new TypeError("A Blob download result is required");
  }
  if (!documentRef?.body || typeof documentRef.createElement !== "function") {
    throw new TypeError("A browser document is required");
  }
  if (
    typeof urlApi?.createObjectURL !== "function"
    || typeof urlApi?.revokeObjectURL !== "function"
  ) {
    throw new TypeError("A browser URL API is required");
  }
  const filename = safeDownloadFilename(result.filename)
    || safeDownloadFilename(fallbackFilename)
    || "download";
  const objectUrl = urlApi.createObjectURL(result.blob);
  const link = documentRef.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  documentRef.body.append(link);
  link.click();
  link.remove();
  const revoke = () => urlApi.revokeObjectURL(objectUrl);
  if (typeof schedule === "function") schedule(revoke, 0);
  else revoke();
  return filename;
}

export function safeDownloadFilename(value) {
  const filename = String(value || "").normalize("NFC").trim();
  if (
    !filename
    || filename.length > 128
    || filename === "."
    || filename === ".."
    || filename.includes("..")
    || /[\/\\\u0000-\u001f\u007f]/u.test(filename)
    || /[.\s]$/u.test(filename)
    || !/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(filename)
  ) {
    return "";
  }
  return filename;
}

async function readErrorDetails(response) {
  try {
    const bytes = await readBoundedResponse(response, MAXIMUM_ERROR_BYTES);
    const text = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

async function readBoundedResponse(response, maximumBytes) {
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maximumBytes) {
      throw new AdminDownloadError("Download is too large", {
        status: response.status,
        code: "download_too_large"
      });
    }
    return bytes;
  }
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const bytes = value instanceof Uint8Array
        ? value
        : new Uint8Array(value);
      total += bytes.byteLength;
      if (total > maximumBytes) {
        await reader.cancel().catch(() => {});
        throw new AdminDownloadError("Download is too large", {
          status: response.status,
          code: "download_too_large"
        });
      }
      chunks.push(bytes);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function normalizedContentType(value) {
  return String(value || "").split(";", 1)[0].trim().toLowerCase();
}

function boundedContentLength(value) {
  if (value === null || value === "") return null;
  if (!/^\d+$/.test(value)) return null;
  const length = Number(value);
  return Number.isSafeInteger(length) ? length : null;
}
