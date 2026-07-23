export class AdminApiError extends Error {
  constructor(message, { status = 0, code = "request_failed", details } = {}) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class AdminApiClient {
  #baseUrl;
  #csrfHeader;
  #csrfToken = "";
  #fetch;

  constructor({
    baseUrl,
    csrfHeader = "x-dustwave-csrf",
    fetchImpl
  } = {}) {
    if (!baseUrl) throw new TypeError("baseUrl is required");
    const resolvedFetch = fetchImpl || globalThis.fetch;
    if (typeof resolvedFetch !== "function") throw new TypeError("fetchImpl is required");
    this.#baseUrl = String(baseUrl).replace(/\/+$/, "");
    this.#csrfHeader = String(csrfHeader);
    this.#fetch = resolvedFetch.bind(globalThis);
  }

  setCsrfToken(value) {
    this.#csrfToken = String(value || "");
  }

  clearCsrfToken() {
    this.#csrfToken = "";
  }

  async request(path, {
    method = "GET",
    body,
    headers,
    signal,
    csrf = !["GET", "HEAD", "OPTIONS"].includes(String(method).toUpperCase())
  } = {}) {
    const requestHeaders = new Headers(headers);
    if (body !== undefined && !requestHeaders.has("content-type")) {
      requestHeaders.set("content-type", "application/json");
    }
    if (csrf && this.#csrfToken) {
      requestHeaders.set(this.#csrfHeader, this.#csrfToken);
    }
    const response = await this.#fetch(`${this.#baseUrl}${normalizePath(path)}`, {
      method,
      credentials: "include",
      headers: requestHeaders,
      ...(body === undefined
        ? {}
        : { body: requestHeaders.get("content-type")?.includes("application/json")
          ? JSON.stringify(body)
          : body }),
      signal
    });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("json")
      ? await response.json().catch(() => ({}))
      : await response.text();
    if (!response.ok) {
      const object = payload && typeof payload === "object" ? payload : {};
      throw new AdminApiError(
        String(object.message || object.error || response.statusText || "Request failed"),
        {
          status: response.status,
          code: String(object.error || "request_failed"),
          details: object
        }
      );
    }
    return payload;
  }
}

function normalizePath(path) {
  const value = String(path || "");
  return value.startsWith("/") ? value : `/${value}`;
}
