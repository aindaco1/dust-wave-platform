import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";

import { mountConfirmationDialog } from "../src/confirmation-dialog.js";

test("confirmation dialog validates a required reason and returns it", async () => {
  const { document } = parseHTML('<div id="root"></div>');
  const root = document.getElementById("root");
  const mounted = mountConfirmationDialog(root);
  const result = mounted.open({
    title: "Publish with blockers?",
    items: ["Transcript approval"],
    field: {
      label: "Override reason",
      maxLength: 500,
      required: true
    }
  });

  const confirm = root.querySelector(".dw-admin-dialog__actions .btn-danger");
  confirm.click();
  assert.equal(
    root.querySelector(".dw-admin-dialog__error").hidden,
    false
  );

  root.querySelector("textarea").value = "Reviewed with the producer.";
  confirm.click();
  assert.deepEqual(await result, {
    confirmed: true,
    value: "Reviewed with the producer."
  });
  assert.equal(mounted.element.hasAttribute("open"), false);
});

test("confirmation dialog cancels without returning field content", async () => {
  const { document } = parseHTML('<div id="root"></div>');
  const root = document.getElementById("root");
  const mounted = mountConfirmationDialog(root);
  const result = mounted.open({
    title: "Archive show?",
    field: { label: "Reason", value: "draft" }
  });
  root.querySelector(".dw-admin-dialog__actions .btn-outline-light").click();
  assert.deepEqual(await result, { confirmed: false, value: "" });
});
