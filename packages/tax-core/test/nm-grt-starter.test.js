import assert from "node:assert/strict";
import test from "node:test";

import {
  NM_GRT_STARTER_LOCATIONS,
  NM_GRT_STARTER_METADATA
} from "../src/nm-grt-starter.js";
import {
  renderNmGrtStarterModule,
  updateNmGrtStarter
} from "../src/nm-grt-updater.js";

test("preserves the independently characterized Pool and Store starter data", () => {
  assert.equal(NM_GRT_STARTER_METADATA.generatedAt, "2026-04-18");
  assert.equal(NM_GRT_STARTER_LOCATIONS.length, 5);
  assert.deepEqual(
    NM_GRT_STARTER_LOCATIONS.map(({ city, locationCode }) => ({
      city,
      locationCode
    })),
    [
      { city: "Albuquerque", locationCode: "02-100" },
      { city: "Santa Fe", locationCode: "01-123" },
      { city: "Los Alamos", locationCode: "32-032" },
      { city: "Espanola", locationCode: "17-215" },
      { city: "Taos", locationCode: "20-126" }
    ]
  );
});

test("renders deterministic source metadata when the date is injected", () => {
  const rendered = renderNmGrtStarterModule(
    [{ city: "Albuquerque" }],
    "https://example.test/",
    "2026-08-06"
  );
  assert.match(rendered, /"generatedAt": "2026-08-06"/);
  assert.match(rendered, /https:\/\/example\.test\/api\/by_address/);
  assert.match(rendered, /"city": "Albuquerque"/);
});

test("fails before writing when any public reference lookup fails", async () => {
  let writes = 0;
  await assert.rejects(
    updateNmGrtStarter({
      outputPath: "/not-written.js",
      fetchImpl: async () => ({ ok: false, status: 503 }),
      writeFileImpl: async () => { writes += 1; }
    }),
    /Lookup failed/
  );
  assert.equal(writes, 0);
});

test("requires an explicit consumer-owned output path", async () => {
  await assert.rejects(
    updateNmGrtStarter({}),
    /outputPath is required/
  );
});
