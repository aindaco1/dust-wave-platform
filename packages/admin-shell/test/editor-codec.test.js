import assert from "node:assert/strict";
import test from "node:test";
import { DOMParser, parseHTML } from "linkedom";

import {
  editorElementToMarkdown,
  markdownToEditorHtml,
  RICH_TEXT_POLICY,
  sanitizeClipboardHtml,
  TIMED_TEXT_POLICY
} from "../src/editor-codec.js";

function editor(html) {
  const { document } = parseHTML(`<div id="editor">${html}</div>`);
  return document.getElementById("editor");
}

test("preserves Pool emphasis boundary spaces", () => {
  const value = editorElementToMarkdown(editor(
    "<p><strong>it came out great. </strong>Three long <em>days </em>here.</p>"
  ));
  assert.equal(value, "**it came out great.** Three long *days* here.");
});

test("serializes nested emphasis without unmatched markers", () => {
  const value = editorElementToMarkdown(
    editor("<p><strong>we wrapped <em>sunder</em></strong>!</p>")
  );
  assert.equal(value, "**we wrapped *sunder***!");
});

test("renders headings, lists, links, and inline emphasis from Markdown", () => {
  const html = markdownToEditorHtml(
    "## Notes\n\nA **bold** [link](/news/).\n\n- One\n- Two",
    RICH_TEXT_POLICY
  );
  assert.match(html, /^<h2>Notes<\/h2>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<a href="\/news\/">link<\/a>/);
  assert.match(html, /<ul><li>One<\/li><li>Two<\/li><\/ul>$/);
});

test("removes unsafe clipboard elements, attributes, and link schemes", () => {
  const html = sanitizeClipboardHtml(
    '<div onclick="bad()"><script>bad()</script><b style="color:red">Safe</b> <a href="javascript:bad()">link</a></div>',
    RICH_TEXT_POLICY,
    { DOMParser }
  );
  assert.equal(html, "<p><strong>Safe</strong> link</p>");
});

test("timed-text mode strips headings, lists, and links but retains emphasis", () => {
  const html = sanitizeClipboardHtml(
    '<h2>Caption</h2><ul><li><strong>One</strong></li><li><a href="https://example.com">Two</a></li></ul>',
    TIMED_TEXT_POLICY,
    { DOMParser }
  );
  assert.equal(html, "Caption<strong>One</strong><br>Two<br>");
});
