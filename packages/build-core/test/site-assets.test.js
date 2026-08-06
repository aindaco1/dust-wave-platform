import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  isMinifiableAssetPath,
  minifyAssetSource,
  minifySiteAssets
} from "../src/site-assets.js";

test("targets generated CSS and JavaScript assets only", () => {
  assert.equal(isMinifiableAssetPath("_site/assets/main.css"), true);
  assert.equal(isMinifiableAssetPath("_site/assets/js/campaign.js"), true);
  assert.equal(isMinifiableAssetPath("_site/assets/js/campaign.js.map"), false);
  assert.equal(isMinifiableAssetPath("_site/index.html"), false);
  assert.equal(isMinifiableAssetPath("_site/assets/vendor/library.js"), false);
});

test("minifies local identifiers without rewriting the public global", async () => {
  const source = `
    window.DustWaveExample = window.DustWaveExample || {};
    function verboseGlobalName(value) {
      return value ? 1 : 0;
    }
    window.DustWaveExample.verboseGlobalName = verboseGlobalName;
  `;
  const minified = await minifyAssetSource(
    source,
    "_site/assets/js/example.js"
  );

  assert.ok(minified.length < source.length);
  assert.match(minified, /window\.DustWaveExample/);
  assert.match(minified, /function verboseGlobalName\(/);
  assert.doesNotMatch(minified, /function verboseGlobalName\(value\)/);
});

test("rewrites only smaller generated assets", async (context) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "dustwave-assets-"));
  context.after(() => rm(tempDir, { recursive: true, force: true }));
  const siteDir = path.join(tempDir, "_site");
  await mkdir(path.join(siteDir, "assets/js"), { recursive: true });
  await mkdir(path.join(siteDir, "assets/vendor"), { recursive: true });

  const jsPath = path.join(siteDir, "assets/js/app.js");
  const cssPath = path.join(siteDir, "assets/main.css");
  const vendorPath = path.join(siteDir, "assets/vendor/library.js");
  await writeFile(
    jsPath,
    "window.DustWaveApp = window.DustWaveApp || {};\nwindow.DustWaveApp.ready = true;\n"
  );
  await writeFile(cssPath, ".example {\n  color: #ffffff;\n  margin: 0px;\n}\n");
  await writeFile(vendorPath, "function vendorName() {\n  return true;\n}\n");

  const summary = await minifySiteAssets({ siteDir, write: true });

  assert.equal(summary.filesChecked, 2);
  assert.equal(summary.minifiedCount, 2);
  assert.ok(summary.bytesSaved > 0);
  assert.doesNotMatch(await readFile(jsPath, "utf8"), /\n/);
  assert.match(await readFile(cssPath, "utf8"), /#fff/);
  assert.match(await readFile(vendorPath, "utf8"), /\n/);
});

test("fails explicitly when the generated asset directory is absent", async () => {
  await assert.rejects(
    minifySiteAssets({ siteDir: "does-not-exist" }),
    /Generated asset directory not found/
  );
});
