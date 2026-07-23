const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

export const RICH_TEXT_POLICY = Object.freeze({
  blockMode: true,
  allowHeadings: true,
  allowLinks: true,
  allowLists: true
});

export const TIMED_TEXT_POLICY = Object.freeze({
  blockMode: false,
  allowHeadings: false,
  allowLinks: false,
  allowLists: false
});

export function escapeEditorHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeEditorAttribute(value) {
  return escapeEditorHtml(value).replace(/"/g, "&quot;");
}

export function isSafeEditorHref(value) {
  return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(String(value || "").trim());
}

export function renderEditorInlineMarkdown(value, policy = RICH_TEXT_POLICY) {
  let html = escapeEditorHtml(value);
  html = html.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
  html = html.replace(/&lt;(\/?(?:u|strong|em|b|i))&gt;/gi, "<$1>");
  if (policy.allowLinks) {
    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+|\/(?!\/)[^)\s]+|#[^)\s]+)\)/gi,
      (match, label, href) => {
        const normalizedHref = String(href || "").replace(/&amp;/g, "&");
        return isSafeEditorHref(normalizedHref)
          ? `<a href="${escapeEditorAttribute(normalizedHref)}">${label}</a>`
          : match;
      }
    );
  }
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  html = html.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
  return html;
}

export function markdownToEditorHtml(value, policy = RICH_TEXT_POLICY) {
  const lines = String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (!policy.blockMode) return renderEditorInlineMarkdown(lines.join(" "), policy);
  const chunks = [];
  let paragraph = [];
  let listItems = [];
  let listTag = "ul";
  function flushParagraph() {
    if (!paragraph.length) return;
    chunks.push(`<p>${renderEditorInlineMarkdown(paragraph.join(" "), policy)}</p>`);
    paragraph = [];
  }
  function flushList() {
    if (!listItems.length) return;
    chunks.push(`<${listTag}>${listItems.map((item) =>
      `<li>${renderEditorInlineMarkdown(item, policy)}</li>`
    ).join("")}</${listTag}>`);
    listItems = [];
    listTag = "ul";
  }
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = policy.allowHeadings ? trimmed.match(/^(#{2,4})\s+(.+)$/) : null;
    if (heading) {
      flushParagraph();
      flushList();
      chunks.push(
        `<h${heading[1].length}>${renderEditorInlineMarkdown(heading[2], policy)}</h${heading[1].length}>`
      );
      continue;
    }
    const unordered = policy.allowLists ? trimmed.match(/^[-*]\s+(.+)$/) : null;
    const ordered = policy.allowLists ? trimmed.match(/^\d+[.)]\s+(.+)$/) : null;
    if (unordered || ordered) {
      flushParagraph();
      const nextTag = unordered ? "ul" : "ol";
      if (listItems.length && listTag !== nextTag) flushList();
      listTag = nextTag;
      listItems.push((unordered || ordered)[1]);
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  return chunks.join("");
}

export function normalizePastedPlainText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/^\s*[•◦▪]\s+/gm, "- ")
    .replace(/^\s*([a-zA-Z])[\.)]\s+/gm, (_match, letter) => {
      const index = letter.toLowerCase().charCodeAt(0) - 96;
      return `${index > 0 ? index : 1}. `;
    })
    .trim();
}

export function sanitizeClipboardHtml(
  html,
  policy = RICH_TEXT_POLICY,
  { DOMParser: Parser = globalThis.DOMParser } = {}
) {
  if (typeof Parser !== "function") throw new TypeError("DOMParser is required");
  const doc = new Parser().parseFromString(
    `<!doctype html><html><body>${String(html || "")}</body></html>`,
    "text/html"
  );
  const unsafeTags = new Set(["script", "style", "meta", "link", "object", "embed", "iframe", "svg"]);
  const blockTags = new Set(["p", "div", "section", "article", "header", "footer", "blockquote"]);
  function cleanChildren(node) {
    return Array.from(node.childNodes).map(cleanNode).join("");
  }
  function styledValue(element, htmlValue) {
    const tag = element.tagName.toLowerCase();
    const style = (element.getAttribute("style") || "").toLowerCase();
    let value = htmlValue;
    if ((tag === "u" || /text-decoration[^;]*underline/.test(style)) && value) value = `<u>${value}</u>`;
    if ((tag === "em" || tag === "i" || /font-style\s*:\s*italic/.test(style)) && value) value = `<em>${value}</em>`;
    if ((tag === "strong" || tag === "b" || /font-weight\s*:\s*(bold|[6-9]00)/.test(style)) && value) {
      value = `<strong>${value}</strong>`;
    }
    return value;
  }
  function cleanNode(node) {
    if (node.nodeType === TEXT_NODE) return escapeEditorHtml(node.textContent || "");
    if (node.nodeType !== ELEMENT_NODE) return "";
    const element = node;
    const tag = element.tagName.toLowerCase();
    if (unsafeTags.has(tag)) return "";
    if (tag === "br") return "<br>";
    const inner = cleanChildren(element);
    if (!inner.trim()) return "";
    if (tag === "a") {
      const href = element.getAttribute("href") || "";
      return policy.allowLinks && isSafeEditorHref(href)
        ? `<a href="${escapeEditorAttribute(href)}">${inner}</a>`
        : inner;
    }
    if (tag === "ul" || tag === "ol") {
      return policy.allowLists ? `<${tag}>${cleanChildren(element)}</${tag}>` : cleanChildren(element);
    }
    if (tag === "li") return policy.allowLists ? `<li>${inner.trim()}</li>` : `${inner}<br>`;
    if (policy.allowHeadings && /^h[1-6]$/.test(tag)) {
      const level = Math.min(4, Math.max(2, Number(tag.slice(1))));
      return `<h${level}>${inner.trim()}</h${level}>`;
    }
    const styled = styledValue(element, inner);
    if (policy.blockMode && blockTags.has(tag)) return `<p>${styled.trim()}</p>`;
    return styled;
  }
  return cleanChildren(doc.body).replace(/(<br>\s*){3,}/g, "<br><br>").trim();
}

export function sanitizeClipboardPayload(
  { html = "", text = "" } = {},
  policy = RICH_TEXT_POLICY,
  options
) {
  if (html) {
    const sanitized = sanitizeClipboardHtml(html, policy, options);
    if (sanitized) return sanitized;
  }
  const normalized = normalizePastedPlainText(text);
  return policy.blockMode
    ? markdownToEditorHtml(normalized, policy)
    : renderEditorInlineMarkdown(normalized.replace(/\n+/g, " "), policy);
}

function wrapMarkdownInline(inner, openMarker, closeMarker) {
  const text = String(inner || "");
  const leading = text.match(/^\s+/)?.[0] || "";
  const trailing = text.match(/\s+$/)?.[0] || "";
  const core = text.slice(leading.length, text.length - trailing.length);
  if (!core) return text;
  return `${leading}${openMarker}${core}${closeMarker}${trailing}`;
}

export function nodeToMarkdown(node, policy = RICH_TEXT_POLICY) {
  if (!node) return "";
  if (node.nodeType === TEXT_NODE) return String(node.textContent || "").replace(/\u00a0/g, " ");
  if (node.nodeType !== ELEMENT_NODE) return "";
  const element = node;
  const tag = element.tagName.toLowerCase();
  if (tag === "br") return "\n";
  const inner = Array.from(element.childNodes).map((child) =>
    nodeToMarkdown(child, policy)
  ).join("");
  if (tag === "a") {
    const href = element.getAttribute("href") || "";
    return policy.allowLinks && href ? `[${inner}](${href})` : inner;
  }
  if (tag === "strong" || tag === "b") return wrapMarkdownInline(inner, "**", "**");
  if (tag === "em" || tag === "i") return wrapMarkdownInline(inner, "*", "*");
  if (tag === "u") return wrapMarkdownInline(inner, "<u>", "</u>");
  if (policy.allowHeadings && /^h[2-4]$/.test(tag)) {
    return `${"#".repeat(Number(tag.slice(1)))} ${inner.trim()}`;
  }
  if (policy.allowLists && (tag === "ul" || tag === "ol")) {
    return Array.from(element.children)
      .filter((child) => child.tagName?.toLowerCase() === "li")
      .map((child, index) => {
        const marker = tag === "ul" ? "-" : `${index + 1}.`;
        return `${marker} ${nodeToMarkdown(child, policy).trim().replace(/\n+/g, " ")}`;
      })
      .join("\n");
  }
  if (tag === "li") return inner.trim();
  return inner;
}

export function editorElementToMarkdown(control, policy = RICH_TEXT_POLICY) {
  const blocks = [];
  for (const node of Array.from(control?.childNodes || [])) {
    if (node.nodeType === TEXT_NODE) {
      const text = (node.textContent || "").trim();
      if (text) blocks.push(text);
      continue;
    }
    if (node.nodeType !== ELEMENT_NODE) continue;
    const tag = node.tagName.toLowerCase();
    const markdown = nodeToMarkdown(node, policy).trim();
    if (markdown || tag === "br") blocks.push(markdown);
  }
  if (!blocks.length) {
    return String(control?.innerText || control?.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return blocks.join(policy.blockMode ? "\n\n" : " ").replace(/\n{3,}/g, "\n\n").trim();
}
