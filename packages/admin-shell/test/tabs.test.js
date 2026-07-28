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

test("standalone responsive tab select falls back to the matching tab click", () => {
  const { document, window } = tabFixture();
  const root = document.getElementById("admin-tabs");
  const clicked = [];
  root.querySelector('[data-tab="episodes"]').addEventListener(
    "click",
    () => clicked.push("episodes")
  );
  const mounted = mountResponsiveTabSelect(root);

  mounted.select.querySelector(
    'option[value="overview"]'
  ).removeAttribute("selected");
  mounted.select.querySelector(
    'option[value="episodes"]'
  ).setAttribute("selected", "");
  mounted.select.dispatchEvent(new window.Event("change"));

  assert.deepEqual(clicked, ["episodes"]);
});

test("responsive tab select refreshes dynamic Pool-style tabs in place", () => {
  const { document } = tabFixture();
  const tabList = document.querySelector('[role="tablist"]');
  const mounted = mountResponsiveTabSelect(tabList, {
    buttonSelector: "[data-tab]",
    label: "Admin sections",
    labelClass: "admin-mobile-tab-select__label",
    selectClass: "admin-settings__input admin-mobile-tab-select__control",
    wrapperClass: "admin-mobile-tab-select",
    value: (tab) => tab.dataset.tab
  });

  document.getElementById("tab-episodes").hidden = true;
  mounted.refresh();

  assert.equal(
    tabList.nextElementSibling,
    mounted.element,
    "refresh must reuse the existing wrapper"
  );
  assert.equal(mounted.element.hidden, true);
  assert.deepEqual(
    Array.from(mounted.select.options).map((option) => option.value),
    ["overview"]
  );

  document.getElementById("tab-episodes").hidden = false;
  tabList.hidden = true;
  mounted.refresh();
  assert.equal(mounted.element.hidden, true);
});

test("responsive tab select preserves Store-style wrapper and labels", () => {
  const { document } = tabFixture();
  const tabList = document.querySelector('[role="tablist"]');
  document.getElementById("tab-overview").setAttribute(
    "aria-label",
    "Overview label"
  );
  const mounted = mountResponsiveTabSelect(tabList, {
    activeValue: "episodes",
    buttonSelector: "[data-tab]",
    label: "Section",
    labelClass: "admin-mobile-tab-select__label",
    labelTag: "span",
    minimumTabs: 0,
    optionLabel: (tab) =>
      tab.getAttribute("aria-label") || tab.textContent.trim(),
    selectClass: "",
    value: (tab) => tab.dataset.tab,
    wrapperClass: "admin-mobile-tab-select",
    wrapperTag: "label"
  });

  assert.equal(mounted.element.tagName, "LABEL");
  assert.equal(mounted.label.tagName, "SPAN");
  assert.equal(mounted.select.className, "");
  assert.equal(mounted.select.value, "episodes");
  assert.deepEqual(
    Array.from(mounted.select.options).map((option) => option.textContent),
    ["Overview label", "Episodes"]
  );
});
