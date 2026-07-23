import assert from "node:assert/strict";
import test from "node:test";

import { AdminApiClient, AdminApiError } from "../src/api-client.js";

test("sends credentials and an in-memory CSRF token without persisting it", async () => {
  const calls = [];
  const client = new AdminApiClient({
    baseUrl: "https://podcast.test/",
    csrfHeader: "x-podcast-csrf",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return Response.json({ updated: true });
    }
  });
  client.setCsrfToken("csrf-fixture");
  await client.request("/v1/admin/show", {
    method: "PATCH",
    body: { title: "Fixture" }
  });

  assert.equal(calls[0].url, "https://podcast.test/v1/admin/show");
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].init.headers.get("x-podcast-csrf"), "csrf-fixture");
  assert.deepEqual(JSON.parse(calls[0].init.body), { title: "Fixture" });
});

test("does not attach CSRF to public reads", async () => {
  let headers;
  const client = new AdminApiClient({
    baseUrl: "https://podcast.test",
    csrfHeader: "x-podcast-csrf",
    fetchImpl: async (_url, init) => {
      headers = init.headers;
      return Response.json({ ok: true });
    }
  });
  client.setCsrfToken("csrf-fixture");
  await client.request("/health");
  assert.equal(headers.has("x-podcast-csrf"), false);
});

test("returns bounded provider errors", async () => {
  const client = new AdminApiClient({
    baseUrl: "https://podcast.test",
    fetchImpl: async () => Response.json(
      { error: "forbidden", message: "Not permitted", ignored: "secret" },
      { status: 403 }
    )
  });
  await assert.rejects(
    () => client.request("/v1/admin/shows"),
    (error) => {
      assert(error instanceof AdminApiError);
      assert.equal(error.status, 403);
      assert.equal(error.code, "forbidden");
      assert.equal(error.message, "Not permitted");
      return true;
    }
  );
});
