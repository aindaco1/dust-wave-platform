import assert from "node:assert/strict";
import test from "node:test";

import { setDirtyButtonState } from "../src/dirty-controls.js";

function buttonFixture() {
  const classes = new Set();
  return {
    tagName: "BUTTON",
    classList: {
      contains(name) {
        return classes.has(name);
      },
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      }
    },
    dataset: {},
    disabled: false,
    textContent: ""
  };
}

test("marks a dirty button and keeps its action available", () => {
  const button = buttonFixture();

  assert.equal(
    setDirtyButtonState(button, true, "Save", "Save changes"),
    true
  );
  assert.equal(button.classList.contains("is-dirty"), true);
  assert.equal(button.dataset.dirtyState, "dirty");
  assert.equal(button.textContent, "Save changes");
  assert.equal(button.disabled, false);
});

test("marks a clean button and disables it by default", () => {
  const button = buttonFixture();
  setDirtyButtonState(button, true, "Save", "Save changes");

  setDirtyButtonState(button, false, "Save", "Save changes");

  assert.equal(button.classList.contains("is-dirty"), false);
  assert.equal(button.dataset.dirtyState, "clean");
  assert.equal(button.textContent, "Save");
  assert.equal(button.disabled, true);
});

test("supports consumer-owned disabling policy and force-disabled states", () => {
  const enabledWhenClean = buttonFixture();
  setDirtyButtonState(enabledWhenClean, false, "Publish", "Publish", {
    disableWhenClean: false
  });
  assert.equal(enabledWhenClean.disabled, false);

  const forceDisabled = buttonFixture();
  setDirtyButtonState(forceDisabled, true, "Publish", "Publish", {
    forceDisabled: true
  });
  assert.equal(forceDisabled.disabled, true);
  assert.equal(forceDisabled.dataset.dirtyState, "dirty");
});

test("ignores non-button values without throwing", () => {
  assert.equal(setDirtyButtonState(null, true, "Save", "Save"), false);
  assert.equal(
    setDirtyButtonState({ tagName: "A" }, true, "Save", "Save"),
    false
  );
});
