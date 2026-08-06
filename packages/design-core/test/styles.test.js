import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PACKAGE_URL = new URL("../package.json", import.meta.url);

const EXPECTED_EXPORTS = {
  "./styles/base": "./styles/_base.scss",
  "./styles/buttons": "./styles/_buttons.scss",
  "./styles/content-blocks": "./styles/_content-blocks.scss",
  "./styles/forms": "./styles/_forms.scss",
  "./styles/layout": "./styles/_layout.scss",
  "./styles/mixins": "./styles/_mixins.scss",
  "./styles/modal": "./styles/_modal.scss",
  "./styles/utilities": "./styles/_utilities.scss",
};

// Initial hashes are the independently characterized, byte-identical Pool and
// Store sources. Updating one requires an intentional contract/test migration.
const INITIAL_SOURCE_HASHES = {
  "./styles/_base.scss": "32b964196dbd7ece574282363283598fe8b1be9be8da71b043d797155681baf2",
  "./styles/_buttons.scss": "c55ababeb7b59fe7681cc6253f065486a9af38ffde5df83f9513f4c6dc331376",
  "./styles/_content-blocks.scss": "3471e790fbbb8a876eafcd19fa30e58ba84cf8b3117ce292e18add26b92a65ae",
  "./styles/_forms.scss": "9ae3f8b46832ea703311826d226daae2d7c2f5b2b7072d10d157b24681e25672",
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
  for (const relativePath of Object.values(EXPECTED_EXPORTS)) {
    const source = await readFile(new URL(relativePath, PACKAGE_URL), "utf8");
    assert.doesNotMatch(source, /\{[%{]|[%}]\}|\b(?:Jekyll|site\.|page\.)/u, relativePath);
  }
});

test("near-identical layout sources expose neutral, bounded Sass policy", async () => {
  const mixins = await readFile(new URL("./styles/_mixins.scss", PACKAGE_URL), "utf8");
  const layout = await readFile(new URL("./styles/_layout.scss", PACKAGE_URL), "utf8");

  assert.match(mixins, /\$dustwave-fit-layout-gutter-mode: padding !default;/u);
  assert.match(mixins, /\$dustwave-fit-layout-wide-inline-gutter: clamp\(32px, 8vw, 128px\) !default;/u);
  assert.match(mixins, /@if \$dustwave-fit-layout-gutter-mode == width/u);
  assert.match(layout, /\$dustwave-brand-title-letter-spacing: 0 !default;/u);
  assert.match(layout, /\$dustwave-brand-title-animation-name: dustwave-brand-shimmer !default;/u);
  assert.match(layout, /@keyframes #\{\$dustwave-brand-title-animation-name\}/u);
  assert.doesNotMatch(`${mixins}\n${layout}`, /\b(?:pool|store)(?:cart|-brand)\b/iu);
});
