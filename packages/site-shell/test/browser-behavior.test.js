import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const HEADER_NAV_PATH = new URL("../src/header-nav-browser.js", import.meta.url);
const A11Y_LIVE_PATH = new URL("../src/a11y-live-browser.js", import.meta.url);

function classListFixture() {
  const names = new Set();
  return {
    contains: (name) => names.has(name),
    remove: (name) => names.delete(name),
    toggle(name, force) {
      const enabled = force === undefined ? !names.has(name) : Boolean(force);
      if (enabled) names.add(name);
      else names.delete(name);
      return enabled;
    }
  };
}

function eventTargetFixture(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.(event);
    }
  };
}

async function runClassicScript(path, globals) {
  const source = await readFile(path, "utf8");
  vm.runInNewContext(source, globals, { filename: path.pathname });
}

test("header navigation preserves language state without leaking admin tokens", async () => {
  class Anchor {
    constructor(href) {
      this.href = href;
    }
    getAttribute(name) {
      return name === "href" ? this.href : null;
    }
    setAttribute(name, value) {
      if (name === "href") this.href = value;
    }
  }

  const langLink = new Anchor("/es/admin/");
  const document = eventTargetFixture({
    getElementById: () => null,
    querySelectorAll: () => [langLink]
  });

  await runClassicScript(HEADER_NAV_PATH, {
    document,
    window: {
      location: {
        pathname: "/admin/",
        search: "?admin_login=secret-token&campaignSlug=hand-relations",
        hash: "#content"
      }
    },
    HTMLAnchorElement: Anchor,
    URLSearchParams
  });

  assert.equal(
    langLink.href,
    "/es/admin/?campaignSlug=hand-relations#content"
  );
});

test("header navigation toggles and closes the mobile menu accessibly", async () => {
  const attributes = new Map([
    ["data-open-label", "Open menu"],
    ["data-close-label", "Close menu"]
  ]);
  let focused = false;
  const toggle = eventTargetFixture({
    classList: classListFixture(),
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value),
    focus: () => { focused = true; }
  });
  const nav = eventTargetFixture({ classList: classListFixture() });
  const document = eventTargetFixture({
    getElementById: (id) => id === "menu-toggle" ? toggle : nav,
    querySelectorAll: () => []
  });

  await runClassicScript(HEADER_NAV_PATH, {
    document,
    window: { location: { pathname: "/", search: "", hash: "" } },
    HTMLAnchorElement: class {},
    URLSearchParams
  });

  toggle.dispatch("click");
  assert.equal(nav.classList.contains("is-open"), true);
  assert.equal(attributes.get("aria-expanded"), "true");
  assert.equal(attributes.get("aria-label"), "Close menu");

  document.dispatch("keydown", { key: "Escape" });
  assert.equal(nav.classList.contains("is-open"), false);
  assert.equal(attributes.get("aria-expanded"), "false");
  assert.equal(attributes.get("aria-label"), "Open menu");
  assert.equal(focused, true);
});

test("live announcer emits pending text once and clears it", async () => {
  const region = { textContent: "" };
  let announcement = "Item added to cart";
  const announcer = {
    getAttribute: () => announcement,
    removeAttribute: () => { announcement = null; }
  };
  let timeoutCallback;
  const document = eventTargetFixture({
    readyState: "complete",
    getElementById: () => region,
    querySelectorAll: () => announcement ? [announcer] : []
  });

  await runClassicScript(A11Y_LIVE_PATH, {
    document,
    setTimeout: (callback, delay) => {
      assert.equal(delay, 1000);
      timeoutCallback = callback;
    }
  });

  assert.equal(region.textContent, "Item added to cart");
  assert.equal(announcement, null);
  timeoutCallback();
  assert.equal(region.textContent, "");
});
