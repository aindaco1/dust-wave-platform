import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";

import { mountWorkflowProgress } from "../src/workflow-progress.js";

test("workflow progress renders statuses and reports selected steps", () => {
  const { document } = parseHTML('<div id="root"></div>');
  const root = document.getElementById("root");
  const selected = [];
  const mounted = mountWorkflowProgress(root, {
    label: "Publish episode",
    labels: {
      complete: "Complete",
      needs_action: "Needs action"
    },
    onSelect: (id) => selected.push(id)
  });
  mounted.setSteps([
    { id: "details", label: "Details", status: "complete" },
    { id: "media", label: "Media", status: "needs_action" }
  ]);

  assert.equal(
    root.querySelector("nav").getAttribute("aria-label"),
    "Publish episode"
  );
  assert.equal(root.querySelectorAll("li").length, 2);
  assert.equal(
    root.querySelector('[data-workflow-step="details"]')
      .getAttribute("aria-current"),
    "step"
  );
  root.querySelector('[data-workflow-step="media"]').click();
  assert.deepEqual(selected, ["media"]);
  assert.equal(mounted.getActive(), "media");
  assert.equal(
    root.querySelector('[data-workflow-step="media"]')
      .getAttribute("aria-current"),
    "step"
  );
});

test("workflow progress supports Pool-style accessible section tabs", () => {
  const { document, window } = parseHTML('<div id="root"></div>');
  const root = document.getElementById("root");
  const selected = [];
  let activeElement = null;
  Object.defineProperty(document, "activeElement", {
    configurable: true,
    get: () => activeElement
  });
  Object.defineProperty(window.HTMLElement.prototype, "focus", {
    configurable: true,
    value() {
      activeElement = this;
    }
  });
  const mounted = mountWorkflowProgress(root, {
    label: "Publish sections",
    selectionMode: "tabs",
    onSelect: (id) => selected.push(id)
  });
  mounted.setSteps([
    {
      id: "details",
      label: "Details",
      status: "complete",
      controls: "publish-section"
    },
    {
      id: "media",
      label: "Media",
      status: "needs_action",
      controls: "publish-section"
    },
    {
      id: "review",
      label: "Review",
      status: "needs_action",
      controls: "publish-section"
    }
  ]);

  const list = root.querySelector("ol");
  const details = root.querySelector('[data-workflow-step="details"]');
  const media = root.querySelector('[data-workflow-step="media"]');
  assert.equal(list.getAttribute("role"), "tablist");
  assert.deepEqual(
    Array.from(list.children).map((item) => item.getAttribute("role")),
    ["presentation", "presentation", "presentation"]
  );
  assert.equal(details.getAttribute("role"), "tab");
  assert.equal(details.getAttribute("aria-selected"), "true");
  assert.equal(details.getAttribute("tabindex"), "0");
  assert.equal(media.getAttribute("aria-controls"), "publish-section");
  assert.equal(media.getAttribute("tabindex"), "-1");

  const arrowRight = new window.Event("keydown", { bubbles: true });
  Object.defineProperty(arrowRight, "key", { value: "ArrowRight" });
  details.focus();
  details.dispatchEvent(arrowRight);
  assert.equal(mounted.getActive(), "media");
  assert.equal(
    root.querySelector('[data-workflow-step="media"]')
      .getAttribute("aria-selected"),
    "true"
  );
  assert.deepEqual(selected, ["media"]);
  assert.equal(
    document.activeElement.getAttribute("data-workflow-step"),
    "media"
  );

  mounted.setSteps([
    { id: "details", label: "Details", status: "complete" },
    { id: "media", label: "Media", status: "complete" },
    { id: "review", label: "Review", status: "needs_action" }
  ]);
  assert.equal(
    document.activeElement.getAttribute("data-workflow-step"),
    "media",
    "Status refreshes preserve focus on the active tab"
  );

  const end = new window.Event("keydown", { bubbles: true });
  Object.defineProperty(end, "key", { value: "End" });
  root.querySelector('[data-workflow-step="media"]')
    .dispatchEvent(end);
  assert.equal(mounted.getActive(), "review");

  const modifiedArrow = new window.Event("keydown", {
    bubbles: true,
    cancelable: true
  });
  Object.defineProperties(modifiedArrow, {
    key: { value: "ArrowLeft" },
    altKey: { value: true }
  });
  root.querySelector('[data-workflow-step="review"]')
    .dispatchEvent(modifiedArrow);
  assert.equal(mounted.getActive(), "review");
  assert.equal(modifiedArrow.defaultPrevented, false);
});

test("workflow tabs keep an enabled tab reachable with arbitrary step IDs", () => {
  const { document, window } = parseHTML('<div id="root"></div>');
  const root = document.getElementById("root");
  let activeElement = null;
  Object.defineProperty(document, "activeElement", {
    configurable: true,
    get: () => activeElement
  });
  Object.defineProperty(window.HTMLElement.prototype, "focus", {
    configurable: true,
    value() {
      activeElement = this;
    }
  });
  const mounted = mountWorkflowProgress(root, {
    selectionMode: "tabs"
  });
  mounted.setSteps([
    { id: "locked", label: "Locked", disabled: true },
    { id: 'details"]', label: "Details" }
  ]);

  const [locked, details] = root.querySelectorAll('[role="tab"]');
  assert.equal(mounted.getActive(), 'details"]');
  assert.equal(locked.getAttribute("aria-selected"), "false");
  assert.equal(locked.getAttribute("tabindex"), "-1");
  assert.equal(details.getAttribute("aria-selected"), "true");
  assert.equal(details.getAttribute("tabindex"), "0");
  assert.equal(mounted.setActive("locked"), false);

  details.focus();
  assert.doesNotThrow(() => details.click());
  assert.equal(document.activeElement.dataset.workflowStep, 'details"]');

  mounted.setSteps([
    { id: "locked", label: "Locked", disabled: true },
    { id: 'details"]', label: "Updated details" }
  ]);
  assert.equal(document.activeElement.dataset.workflowStep, 'details"]');
});
