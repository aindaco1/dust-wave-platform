import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PACKAGE_URL = new URL("../package.json", import.meta.url);

const EXPECTED_EXPORTS = {
  "./styles/base": "./styles/_base.scss",
  "./styles/buttons": "./styles/_buttons.scss",
  "./styles/content-blocks": "./styles/_content-blocks.scss",
  "./styles/modal": "./styles/_modal.scss",
  "./styles/utilities": "./styles/_utilities.scss",
};

// Initial hashes are the independently characterized, byte-identical Pool and
// Store sources. Updating one requires an intentional contract/test migration.
const INITIAL_SOURCE_HASHES = {
  "./styles/_base.scss": "32b964196dbd7ece574282363283598fe8b1be9be8da71b043d797155681baf2",
  "./styles/_buttons.scss": "c55ababeb7b59fe7681cc6253f065486a9af38ffde5df83f9513f4c6dc331376",
  "./styles/_content-blocks.scss": "3471e790fbbb8a876eafcd19fa30e58ba84cf8b3117ce292e18add26b92a65ae",
  "./styles/_modal.scss": "acafba288f19bd077d01e89e48c8493f79d51887578c84cc3641f5a670abe348",
  "./styles/_utilities.scss": "304007281576dadc701b3ac2dec095111cc3435e44f074104f2144a97119ef02",
};

test("exports only the characterized Sass component surface", async () => {
  const packageJson = JSON.parse(await readFile(PACKAGE_URL, "utf8"));

  assert.deepEqual(packageJson.exports, EXPECTED_EXPORTS);
  assert.deepEqual(packageJson.files, ["styles"]);
});

test("initial sources match both consumer characterizations", async () => {
  for (const [relativePath, expectedHash] of Object.entries(INITIAL_SOURCE_HASHES)) {
    const source = await readFile(new URL(relativePath, PACKAGE_URL));
    const actualHash = createHash("sha256").update(source).digest("hex");
    assert.equal(actualHash, expectedHash, relativePath);
  }
});

test("shared styles contain no Jekyll or Liquid runtime contract", async () => {
  for (const relativePath of Object.keys(INITIAL_SOURCE_HASHES)) {
    const source = await readFile(new URL(relativePath, PACKAGE_URL), "utf8");
    assert.doesNotMatch(source, /\{[%{]|[%}]\}|\b(?:Jekyll|site\.|page\.)/u, relativePath);
  }
});
