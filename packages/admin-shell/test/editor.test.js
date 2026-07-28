import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";

import { mountRichTextEditor } from "../src/editor.js";

test("the rich-editor link toolbar rejects unsafe URL schemes", () => {
  const { document } = parseHTML('<div id="root"></div>');
  const commands = [];
  document.execCommand = (...args) => commands.push(args);
  const previousPrompt = globalThis.prompt;
  try {
    globalThis.prompt = () => "javascript:alert(1)";
    const root = document.getElementById("root");
    mountRichTextEditor(root);
    root.querySelector('[data-editor-action="createLink"]').click();
    assert.deepEqual(commands, []);

    globalThis.prompt = () => "/podcasts/opera-en-la-selva/";
    root.querySelector('[data-editor-action="createLink"]').click();
    assert.deepEqual(commands, [[
      "createLink",
      false,
      "/podcasts/opera-en-la-selva/"
    ]]);
  } finally {
    globalThis.prompt = previousPrompt;
  }
});
