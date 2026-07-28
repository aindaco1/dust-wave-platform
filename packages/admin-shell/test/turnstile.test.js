import assert from "node:assert/strict";
import test from "node:test";

import {
  minimumFlexibleWidth,
  responsiveTurnstileSize
} from "../src/turnstile.js";

function container(width, { rect = true } = {}) {
  return {
    clientWidth: width,
    getBoundingClientRect: rect
      ? () => ({ width })
      : undefined
  };
}

test("uses Cloudflare's compact widget below the flexible-width floor", () => {
  assert.equal(minimumFlexibleWidth, 300);
  assert.equal(responsiveTurnstileSize(container(299)), "compact");
  assert.equal(responsiveTurnstileSize(container(150)), "compact");
});

test("retains the flexible widget when its documented width fits", () => {
  assert.equal(responsiveTurnstileSize(container(300)), "flexible");
  assert.equal(responsiveTurnstileSize(container(720)), "flexible");
});

test("fails small when layout measurement is unavailable", () => {
  assert.equal(responsiveTurnstileSize(null), "compact");
  assert.equal(
    responsiveTurnstileSize(container(256, { rect: false })),
    "compact"
  );
});
