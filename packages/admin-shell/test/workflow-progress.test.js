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
  assert.equal(details.getAttribute("role"), "tab");
  assert.equal(details.getAttribute("aria-selected"), "true");
  assert.equal(details.getAttribute("tabindex"), "0");
  assert.equal(media.getAttribute("aria-controls"), "publish-section");
  assert.equal(media.getAttribute("tabindex"), "-1");

  const arrowRight = new window.Event("keydown", { bubbles: true });
  Object.defineProperty(arrowRight, "key", { value: "ArrowRight" });
  details.dispatchEvent(arrowRight);
  assert.equal(mounted.getActive(), "media");
  assert.equal(
    root.querySelector('[data-workflow-step="media"]')
      .getAttribute("aria-selected"),
    "true"
  );
  assert.deepEqual(selected, ["media"]);

  const end = new window.Event("keydown", { bubbles: true });
  Object.defineProperty(end, "key", { value: "End" });
  root.querySelector('[data-workflow-step="media"]')
    .dispatchEvent(end);
  assert.equal(mounted.getActive(), "review");
});
