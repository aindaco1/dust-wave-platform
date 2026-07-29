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
