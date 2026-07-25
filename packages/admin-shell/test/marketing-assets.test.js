import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTaggedMarketingUrl,
  createMarketingQr,
  drawQrCanvas,
  normalizeMarketingReferralCode,
  qrSvgMarkup,
  safeMarketingFilename,
  shareCardSvgMarkup
} from "../src/marketing-assets.js";

test("preserves the Pool and Store referral-code contract", () => {
  assert.equal(
    normalizeMarketingReferralCode("  Creator / Uno!? "),
    "creator-uno"
  );
  assert.equal(
    normalizeMarketingReferralCode(`A${"b".repeat(80)}`).length,
    64
  );
});

test("builds policy-injected canonical tagged links", () => {
  assert.equal(
    buildTaggedMarketingUrl({
      canonicalUrl: "https://dustwave.xyz/podcasts/opera-en-la-selva/",
      source: "newsletter",
      medium: "email",
      campaign: "opera-launch",
      content: "hero",
      ref: "Jay Renteria",
      allowedOrigins: ["https://dustwave.xyz"]
    }),
    "https://dustwave.xyz/podcasts/opera-en-la-selva/?utm_source=newsletter&utm_medium=email&utm_campaign=opera-launch&utm_content=hero&ref=jay-renteria"
  );
  assert.throws(
    () => buildTaggedMarketingUrl({
      canonicalUrl: "https://attacker.example/podcasts/",
      allowedOrigins: ["https://dustwave.xyz"]
    }),
    /origin is not allowed/
  );
  assert.throws(
    () => buildTaggedMarketingUrl({
      canonicalUrl: "javascript:alert(1)"
    }),
    /http or https/
  );
});

test("keeps portable marketing filenames bounded and ASCII-safe", () => {
  assert.equal(
    safeMarketingFilename("Ópera en la Selva / Jay", "podcast-qr"),
    "pera-en-la-selva-jay"
  );
  assert.equal(safeMarketingFilename("", "Podcast QR"), "podcast-qr");
});

test("creates one medium-error-correction QR through an injected engine", () => {
  const calls = [];
  const qr = {
    addData(value) {
      calls.push(["data", value]);
    },
    make() {
      calls.push(["make"]);
    }
  };
  const result = createMarketingQr("https://dustwave.xyz/", (type, level) => {
    calls.push(["factory", type, level]);
    return qr;
  });
  assert.equal(result, qr);
  assert.deepEqual(calls, [
    ["factory", 0, "M"],
    ["data", "https://dustwave.xyz/"],
    ["make"]
  ]);
});

test("renders deterministic accessible SVG and canvas matrices", () => {
  const qr = {
    getModuleCount: () => 2,
    isDark: (row, column) => row === column
  };
  const svg = qrSvgMarkup(qr, {
    cellSize: 2,
    margin: 1,
    label: 'Launch & "share"'
  });
  assert.match(svg, /viewBox="0 0 8 8"/);
  assert.match(svg, /aria-label="Launch &amp; &quot;share&quot;"/);
  assert.equal((svg.match(/fill="#000"/g) || []).length, 2);

  const fills = [];
  const context = {
    fillStyle: "",
    fillRect(...values) {
      fills.push([this.fillStyle, ...values]);
    }
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context
  };
  assert.deepEqual(
    drawQrCanvas(qr, canvas, { cellSize: 2, margin: 1 }),
    { width: 8, height: 8 }
  );
  assert.deepEqual(fills, [
    ["#fff", 0, 0, 8, 8],
    ["#000", 2, 2, 2, 2],
    ["#000", 4, 4, 2, 2]
  ]);
});

test("renders a bounded, escaped, localized share-card SVG", () => {
  const artwork = "data:image/png;base64,iVBORw0KGgo=";
  const svg = shareCardSvgMarkup({
    brand: "Dust Wave",
    eyebrow: "Nuevo episodio",
    title: 'Una charla sobre <código> & "arte"',
    summary: "Belleza y alegría para escuchar en cualquier lugar.",
    footer: "dustwave.xyz",
    artworkDataUrl: artwork,
    accent: "#FFD54D",
    language: "es"
  });
  assert.match(svg, /width="1200" height="630"/);
  assert.match(svg, /NUEVO EPISODIO/);
  assert.match(svg, /UNA CHARLA/);
  assert.match(svg, />SOBRE</);
  assert.match(svg, /&lt;CÓDIGO&gt; &amp;/);
  assert.match(svg, /data:image\/png;base64,iVBORw0KGgo=/);
  assert.match(svg, /stroke="#ffd54d"/);
  assert.doesNotMatch(svg, /<script|<código>/i);
  assert((svg.match(/<tspan/g) || []).length <= 8);
});

test("rejects unsafe or oversized share-card inputs", () => {
  const base = {
    brand: "Dust Wave",
    eyebrow: "New episode",
    title: "A title"
  };
  assert.throws(
    () => shareCardSvgMarkup({ ...base, accent: "red" }),
    /six-digit hex/
  );
  assert.throws(
    () => shareCardSvgMarkup({
      ...base,
      artworkDataUrl: "https://attacker.example/image.png"
    }),
    /base64 PNG/
  );
  assert.throws(
    () => shareCardSvgMarkup({ ...base, title: "a".repeat(161) }),
    /title is too long/
  );
  assert.throws(
    () => shareCardSvgMarkup({ ...base, summary: "unsafe\u0000text" }),
    /control characters/
  );
  assert.throws(
    () => shareCardSvgMarkup({
      ...base,
      artworkDataUrl: `data:image/png;base64,${"a".repeat(4_000_004)}`
    }),
    /too long/
  );
});
