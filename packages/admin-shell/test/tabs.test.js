import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";

import {
  mountAccessibleTabs,
  mountResponsiveTabSelect
} from "../src/tabs.js";

function tabFixture() {
  return parseHTML(`
    <div id="admin-tabs">
      <div role="tablist" aria-label="Podcast administration">
        <button id="tab-overview" role="tab" data-tab="overview">
          Overview
        </button>
        <button id="tab-episodes" role="tab" data-tab="episodes">
          Episodes
        </button>
      </div>
      <section role="tabpanel" aria-labelledby="tab-overview"></section>
      <section role="tabpanel" aria-labelledby="tab-episodes"></section>
    </div>
  `);
}

test("responsive tab select mirrors click, keyboard, and stored selection", () => {
  const { document, window } = tabFixture();
  const storageValues = new Map([["admin-tab", "episodes"]]);
  const storage = {
    getItem: (key) => storageValues.get(key) ?? null,
    setItem: (key, value) => storageValues.set(key, value)
  };
  const root = document.getElementById("admin-tabs");
  const changes = [];
  const mounted = mountAccessibleTabs(root, {
    responsiveSelect: {
      id: "podcast-mobile-tabs",
      label: "Choose podcast section"
    },
    storage,
    storageKey: "admin-tab",
    onSelect: (name) => changes.push(name)
  });

  assert.equal(mounted.responsiveSelect.select.value, "episodes");
  assert.equal(
    mounted.responsiveSelect.label.textContent,
    "Choose podcast section"
  );
  assert.equal(
    root.querySelector('[data-tab="episodes"]').getAttribute("aria-selected"),
    "true"
  );

  mounted.responsiveSelect.select.querySelector(
    'option[value="episodes"]'
  ).removeAttribute("selected");
  mounted.responsiveSelect.select.querySelector(
    'option[value="overview"]'
  ).setAttribute("selected", "");
  mounted.responsiveSelect.select.dispatchEvent(new window.Event("change"));
  assert.equal(storageValues.get("admin-tab"), "overview");
  assert.equal(
    root.querySelector('[aria-labelledby="tab-overview"]').hidden,
    false
  );

  root.querySelector('[data-tab="episodes"]').click();
  assert.equal(mounted.responsiveSelect.select.value, "episodes");
  assert.deepEqual(changes, ["episodes", "overview", "episodes"]);
});

test("standalone responsive tab select fails closed without activation", () => {
  const { document } = tabFixture();
  assert.throws(
    () => mountResponsiveTabSelect(document.getElementById("admin-tabs")),
    /activation function/
  );
});
