import assert from "node:assert/strict";
import test from "node:test";

import { PasswordlessAdminSession } from "../src/passwordless-session.js";

test("keeps the rotated session CSRF token only in the injected client", async () => {
  const calls = [];
  const client = {
    request: async (path, options) => {
      calls.push({ path, options });
      return { authenticated: true, csrfToken: "rotated-fixture" };
    },
    setCsrfToken: (value) => calls.push({ setCsrfToken: value }),
    clearCsrfToken: () => calls.push({ clear: true })
  };
  const session = new PasswordlessAdminSession({ client });
  const result = await session.restore();

  assert.equal(result.authenticated, true);
  assert.equal(calls[0].path, "/v1/admin/session");
  assert.deepEqual(calls[1], { setCsrfToken: "rotated-fixture" });
});

test("reads the magic token from a URL fragment without accepting oversized input", () => {
  const client = {
    request: async () => ({}),
    setCsrfToken() {},
    clearCsrfToken() {}
  };
  const session = new PasswordlessAdminSession({ client });
  assert.equal(session.tokenFromFragment("#magic-link=fixture-token"), "fixture-token");
  assert.equal(session.tokenFromFragment(`#magic-link=${"x".repeat(257)}`), "");
});
