import assert from "node:assert/strict";
import test from "node:test";

import {
  AdminDownloadError,
  filenameFromContentDisposition,
  requestCredentialedBlob,
  safeDownloadFilename,
  triggerBlobDownload
} from "../src/credentialed-download.js";

test("downloads a bounded credentialed CSV with an allowlisted filename", async () => {
  let request;
  const csv = "eventId,status\r\nevt_1,matched\r\n";
  const result = await requestCredentialedBlob(
    "https://podcast.test/v1/admin/billing/tax-evidence?format=csv",
    {
      fetchImpl: async (url, init) => {
        request = { url, init };
        return new Response(csv, {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition":
              'attachment; filename="podcast-tax-evidence.csv"'
          }
        });
      },
      headers: { accept: "text/csv" },
      maximumBytes: 1024
    }
  );

  assert.equal(request.url, "https://podcast.test/v1/admin/billing/tax-evidence?format=csv");
  assert.equal(request.init.credentials, "include");
  assert.equal(request.init.headers.get("accept"), "text/csv");
  assert.equal(result.filename, "podcast-tax-evidence.csv");
  assert.equal(result.contentType, "text/csv");
  assert.equal(result.size, new TextEncoder().encode(csv).byteLength);
  assert.equal(await result.blob.text(), csv);
});

test("rejects oversized streamed downloads and cancels the body", async () => {
  let canceled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(700));
      controller.enqueue(new Uint8Array(700));
    },
    cancel() {
      canceled = true;
    }
  });

  await assert.rejects(
    () => requestCredentialedBlob("https://pool.test/admin/report.csv", {
      fetchImpl: async () => new Response(body, {
        headers: { "content-type": "text/csv" }
      }),
      maximumBytes: 1024
    }),
    (error) => {
      assert(error instanceof AdminDownloadError);
      assert.equal(error.code, "download_too_large");
      return true;
    }
  );
  assert.equal(canceled, true);
});

test("rejects HTML success responses before creating a Blob", async () => {
  await assert.rejects(
    () => requestCredentialedBlob("https://store.test/admin/export.csv", {
      fetchImpl: async () => new Response("<html>login</html>", {
        headers: { "content-type": "text/html" }
      })
    }),
    (error) => {
      assert(error instanceof AdminDownloadError);
      assert.equal(error.code, "download_content_type_invalid");
      return true;
    }
  );
});

test("preserves bounded JSON failure details without provider text", async () => {
  await assert.rejects(
    () => requestCredentialedBlob("https://store.test/admin/export.csv", {
      fetchImpl: async () => Response.json(
        { error: "forbidden", message: "Not permitted" },
        { status: 403 }
      )
    }),
    (error) => {
      assert(error instanceof AdminDownloadError);
      assert.equal(error.status, 403);
      assert.equal(error.code, "forbidden");
      assert.equal(error.message, "Not permitted");
      assert.deepEqual(error.details, {
        error: "forbidden",
        message: "Not permitted"
      });
      return true;
    }
  );
});

test("parses RFC 5987 filenames and rejects path-shaped names", () => {
  assert.equal(
    filenameFromContentDisposition(
      "attachment; filename*=UTF-8''evidencia-fiscal-%C3%B3pera.csv"
    ),
    "evidencia-fiscal-ópera.csv"
  );
  assert.equal(
    filenameFromContentDisposition(
      'attachment; filename="../../private.csv"'
    ),
    ""
  );
  assert.equal(safeDownloadFilename("podcast-tax.csv"), "podcast-tax.csv");
  assert.equal(safeDownloadFilename(".env"), "");
});

test("triggers a download with an injected browser boundary and revokes its URL", () => {
  const events = [];
  const link = {
    click() {
      events.push("click");
    },
    remove() {
      events.push("remove");
    }
  };
  const documentRef = {
    body: {
      append(node) {
        assert.equal(node, link);
        events.push("append");
      }
    },
    createElement(tag) {
      assert.equal(tag, "a");
      return link;
    }
  };
  const urlApi = {
    createObjectURL(blob) {
      assert(blob instanceof Blob);
      events.push("create");
      return "blob:fixture";
    },
    revokeObjectURL(value) {
      assert.equal(value, "blob:fixture");
      events.push("revoke");
    }
  };

  const filename = triggerBlobDownload(
    { blob: new Blob(["csv"]), filename: "" },
    "fallback.csv",
    {
      documentRef,
      urlApi,
      schedule(callback, delay) {
        assert.equal(delay, 0);
        callback();
      }
    }
  );

  assert.equal(filename, "fallback.csv");
  assert.equal(link.href, "blob:fixture");
  assert.equal(link.download, "fallback.csv");
  assert.deepEqual(events, ["create", "append", "click", "remove", "revoke"]);
});
