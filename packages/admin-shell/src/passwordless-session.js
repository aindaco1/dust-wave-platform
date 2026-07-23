export class PasswordlessAdminSession {
  #client;
  #endpoints;

  constructor({
    client,
    endpoints = {
      start: "/v1/admin/auth/start",
      exchange: "/v1/admin/auth/exchange",
      session: "/v1/admin/session",
      logout: "/v1/admin/logout"
    }
  } = {}) {
    if (!client) throw new TypeError("client is required");
    this.#client = client;
    this.#endpoints = endpoints;
  }

  async start({ email, turnstileToken = "", preferredLanguage = "en" }) {
    return this.#client.request(this.#endpoints.start, {
      method: "POST",
      csrf: false,
      body: { email, turnstileToken, preferredLanguage }
    });
  }

  async exchange(token) {
    const result = await this.#client.request(this.#endpoints.exchange, {
      method: "POST",
      csrf: false,
      body: { token }
    });
    this.#client.setCsrfToken(result.csrfToken);
    return result;
  }

  async restore() {
    const result = await this.#client.request(this.#endpoints.session, { csrf: false });
    this.#client.setCsrfToken(result.csrfToken);
    return result;
  }

  async logout() {
    const result = await this.#client.request(this.#endpoints.logout, {
      method: "POST"
    });
    this.#client.clearCsrfToken();
    return result;
  }

  tokenFromFragment(fragment = globalThis.location?.hash || "") {
    const parameters = new URLSearchParams(String(fragment).replace(/^#/, ""));
    const token = parameters.get("magic-link") || "";
    return token.length <= 256 ? token : "";
  }

  clearFragment(historyObject = globalThis.history, locationObject = globalThis.location) {
    if (!historyObject?.replaceState || !locationObject) return;
    historyObject.replaceState(
      null,
      "",
      `${locationObject.pathname || "/"}${locationObject.search || ""}`
    );
  }
}
