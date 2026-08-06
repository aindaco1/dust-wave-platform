import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  isMinifiableAssetPath,
  minifyAssetSource,
  minifySiteAssets,
  normalizeAssetDirectories
} from "../src/site-assets.js";

test("targets generated CSS and JavaScript assets only", () => {
  assert.equal(isMinifiableAssetPath("_site/assets/main.css"), true);
  assert.equal(isMinifiableAssetPath("_site/assets/js/campaign.js"), true);
  assert.equal(isMinifiableAssetPath("_site/assets/js/campaign.js.map"), false);
  assert.equal(isMinifiableAssetPath("_site/index.html"), false);
  assert.equal(isMinifiableAssetPath("_site/assets/vendor/library.js"), false);
  assert.equal(
    isMinifiableAssetPath(
      "_site/shared/dust-wave-platform/packages/site-shell/src/header-nav.js",
      "_site",
      ["assets", "shared/dust-wave-platform/packages/site-shell/src"]
    ),
    true
  );
  assert.equal(
    isMinifiableAssetPath("_site/shared/unselected.js", "_site", ["assets"]),
    false
  );
  assert.equal(isMinifiableAssetPath("_site/vendor/library.js", "_site", ["vendor"]), false);
});

test("normalizes unique generated roots and rejects unsafe scope expansion", () => {
  assert.deepEqual(
    normalizeAssetDirectories(["./assets/", "assets", "shared/site-shell/src"]),
    ["assets", "shared/site-shell/src"]
  );

  for (const directory of ["", ".", "..", "assets/../private", "/tmp/assets", "assets//js"]) {
    assert.throws(() => normalizeAssetDirectories([directory]), /Unsafe generated asset directory/);
  }
  assert.throws(
    () => normalizeAssetDirectories(Array.from({ length: 17 }, (_, index) => `assets-${index}`)),
    /At most 16/
  );
  const unsafeValue = "../sk_live_must_not_be_reflected";
  assert.throws(
    () => normalizeAssetDirectories([unsafeValue]),
    (error) => !error.message.includes(unsafeValue)
  );
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

test("rewrites every explicitly allowlisted generated root and no other root", async (context) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "dustwave-multi-root-assets-"));
  context.after(() => rm(tempDir, { recursive: true, force: true }));
  const siteDir = path.join(tempDir, "_site");
  const sharedDir = path.join(
    siteDir,
    "shared/dust-wave-platform/packages/site-shell/src"
  );
  await mkdir(path.join(siteDir, "assets/js"), { recursive: true });
  await mkdir(sharedDir, { recursive: true });
  await mkdir(path.join(siteDir, "unselected"), { recursive: true });

  const assetPath = path.join(siteDir, "assets/js/app.js");
  const sharedPath = path.join(sharedDir, "header-nav.js");
  const unselectedPath = path.join(siteDir, "unselected/app.js");
  const source = "window.DustWaveApp = window.DustWaveApp || {};\nwindow.DustWaveApp.ready = true;\n";
  await writeFile(assetPath, source);
  await writeFile(sharedPath, source);
  await writeFile(unselectedPath, source);

  const assetDirectories = [
    "assets",
    "shared/dust-wave-platform/packages/site-shell/src"
  ];
  const summary = await minifySiteAssets({ siteDir, assetDirectories, write: true });

  assert.deepEqual(summary.assetDirectories, assetDirectories);
  assert.equal(summary.filesChecked, 2);
  assert.equal(summary.minifiedCount, 2);
  assert.doesNotMatch(await readFile(assetPath, "utf8"), /\n/);
  assert.doesNotMatch(await readFile(sharedPath, "utf8"), /\n/);
  assert.equal(await readFile(unselectedPath, "utf8"), source);
});

test("CLI accepts repeatable generated-root flags", async (context) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "dustwave-assets-cli-"));
  context.after(() => rm(tempDir, { recursive: true, force: true }));
  const siteDir = path.join(tempDir, "_site");
  const sharedDirectory = "shared/dust-wave-platform/packages/site-shell/src";
  await mkdir(path.join(siteDir, "assets"), { recursive: true });
  await mkdir(path.join(siteDir, sharedDirectory), { recursive: true });
  await writeFile(
    path.join(siteDir, "assets/app.js"),
    "window.DustWaveCli = window.DustWaveCli || {};\nwindow.DustWaveCli.ready = true;\n"
  );
  await writeFile(
    path.join(siteDir, sharedDirectory, "header-nav.js"),
    "window.DustWaveShell = window.DustWaveShell || {};\nwindow.DustWaveShell.ready = true;\n"
  );

  const cliPath = fileURLToPath(new URL("../bin/minify-site-assets.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [
    cliPath,
    "--site-dir",
    siteDir,
    "--write",
    "--asset-dir",
    "assets",
    `--asset-dir=${sharedDirectory}`
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.deepEqual(summary.assetDirectories, ["assets", sharedDirectory]);
  assert.equal(summary.filesChecked, 2);
  assert.equal(summary.minifiedCount, 2);
});

test("fails explicitly when the generated asset directory is absent", async () => {
  await assert.rejects(
    minifySiteAssets({ siteDir: "does-not-exist" }),
    /Generated asset directory not found/
  );
});

test("fails explicitly when any selected generated root is absent", async (context) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "dustwave-missing-root-"));
  context.after(() => rm(tempDir, { recursive: true, force: true }));
  const siteDir = path.join(tempDir, "_site");
  await mkdir(path.join(siteDir, "assets"), { recursive: true });

  await assert.rejects(
    minifySiteAssets({ siteDir, assetDirectories: ["assets", "shared/site-shell"] }),
    /Generated asset directory not found.*shared\/site-shell/
  );
});

test("rejects a generated root that resolves outside the built site", async (context) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "dustwave-symlink-root-"));
  context.after(() => rm(tempDir, { recursive: true, force: true }));
  const siteDir = path.join(tempDir, "_site");
  const outsideDir = path.join(tempDir, "outside");
  await mkdir(siteDir, { recursive: true });
  await mkdir(outsideDir, { recursive: true });
  await writeFile(path.join(outsideDir, "private.js"), "window.privateValue = true;\n");
  await symlink(outsideDir, path.join(siteDir, "assets"), "dir");

  await assert.rejects(
    minifySiteAssets({ siteDir, assetDirectories: ["assets"], write: true }),
    /must remain inside the generated site/
  );
  assert.match(await readFile(path.join(outsideDir, "private.js"), "utf8"), /\n/);
});
