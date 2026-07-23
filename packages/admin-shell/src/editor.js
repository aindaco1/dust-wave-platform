import {
  editorElementToMarkdown,
  markdownToEditorHtml,
  RICH_TEXT_POLICY,
  sanitizeClipboardPayload,
  TIMED_TEXT_POLICY
} from "./editor-codec.js";

export function mountRichTextEditor(root, {
  value = "",
  mode = "rich",
  label = "Rich text editor",
  onChange
} = {}) {
  if (!root?.ownerDocument) throw new TypeError("An editor root is required");
  const document = root.ownerDocument;
  const policy = mode === "timed_text" ? TIMED_TEXT_POLICY : RICH_TEXT_POLICY;
  const toolbar = document.createElement("div");
  toolbar.className = "dw-editor__toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", `${label} formatting`);
  const editor = document.createElement("div");
  editor.className = "dw-editor__surface";
  editor.contentEditable = "true";
  editor.spellcheck = true;
  editor.setAttribute("role", "textbox");
  editor.setAttribute("aria-label", label);
  editor.setAttribute("aria-multiline", "true");
  editor.innerHTML = markdownToEditorHtml(value, policy);

  const actions = [
    ["bold", "Bold"],
    ["italic", "Italic"],
    ...(mode === "rich"
      ? [["formatBlock:h2", "Heading"], ["insertUnorderedList", "List"], ["createLink", "Link"]]
      : [])
  ];
  for (const [action, actionLabel] of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.editorAction = action;
    button.textContent = actionLabel;
    button.addEventListener("click", () => {
      editor.focus();
      const [command, fixedValue] = action.split(":");
      const commandValue = command === "createLink"
        ? globalThis.prompt?.("Link URL (https://, mailto:, /path, or #anchor)") || ""
        : fixedValue || null;
      if (command === "createLink" && !commandValue) return;
      document.execCommand(command, false, commandValue);
      emitChange();
    });
    toolbar.append(button);
  }

  function emitChange() {
    onChange?.({
      html: editor.innerHTML,
      markdown: editorElementToMarkdown(editor, policy)
    });
  }

  editor.addEventListener("input", emitChange);
  editor.addEventListener("paste", (event) => {
    event.preventDefault();
    const sanitized = sanitizeClipboardPayload(
      {
        html: event.clipboardData?.getData("text/html") || "",
        text: event.clipboardData?.getData("text/plain") || ""
      },
      policy
    );
    document.execCommand("insertHTML", false, sanitized);
    emitChange();
  });
  root.replaceChildren(toolbar, editor);

  return {
    editor,
    getHtml: () => editor.innerHTML,
    getMarkdown: () => editorElementToMarkdown(editor, policy),
    setValue(nextValue) {
      editor.innerHTML = markdownToEditorHtml(nextValue, policy);
      emitChange();
    },
    focus: () => editor.focus()
  };
}
