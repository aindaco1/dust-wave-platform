(function(scope) {
  "use strict";
  if (scope.DustWaveAdminShellEditorMedia) return;

  function imageThumbnail(media, { document = scope.document, Image = scope.Image, maxEdge = 960 } = {}) {
    if (!Number.isFinite(maxEdge) || maxEdge < 1 || maxEdge > 4096) throw new RangeError("maxEdge must be between 1 and 4096");
    if (!media.inlinePreview) {
      media.inlinePreview = (async () => {
        const image = new Image();
        image.src = media.previewUrl;
        await image.decode();
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/webp", 0.85);
      })().catch(() => "");
    }
    return media.inlinePreview;
  }

  function createImagePreviewCache({ URL = scope.URL } = {}) {
    const images = new Map();
    return Object.freeze({
      remember(path, file) {
        if (!path || !/^image\//.test(file?.type || "")) throw new TypeError("An uploaded image path and image file are required");
        const previewUrl = URL.createObjectURL(file);
        const previous = images.get(path);
        images.set(path, { previewUrl });
        if (previous) URL.revokeObjectURL(previous.previewUrl);
        return images.get(path);
      },
      get: path => images.get(path),
      has: path => images.has(path),
      clear() {
        for (const image of images.values()) URL.revokeObjectURL(image.previewUrl);
        images.clear();
      }
    });
  }

  function applyPreviewMedia(html, replacements, { DOMParser = scope.DOMParser, pendingText, placeholderClass = "" } = {}) {
    if (!html || !replacements?.size) return html;
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("[src], [poster]").forEach(element => {
      for (const attribute of ["src", "poster"]) {
        const path = element.getAttribute(attribute);
        if (!replacements.has(path)) continue;
        const dataUrl = replacements.get(path);
        if (/^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(dataUrl || "")) {
          element.setAttribute(attribute, dataUrl);
        } else {
          element.removeAttribute(attribute);
          if (attribute === "poster") continue;
          const placeholder = doc.createElement("p");
          placeholder.className = placeholderClass;
          placeholder.textContent = String(pendingText || "");
          (element.closest("video, audio") || element).replaceWith(placeholder);
        }
      }
    });
    return "<!doctype html>" + doc.documentElement.outerHTML;
  }

  function isEmptyTextBlock(block, { bodyKey = "body", allowedKeys = ["type", "body", "align"] } = {}) {
    return Boolean(block && typeof block === "object" && !Array.isArray(block)
      && String(block.type || "").trim().toLowerCase() === "text"
      && !String(block[bodyKey] || "").trim()
      && Object.keys(block).every(key => allowedKeys.includes(key)));
  }

  function normalizeImageAccessibility(image, { cleanText = value => String(value).replace(/<[^>]*>/g, ""), maxLength = 300 } = {}) {
    const original = String(image?.alt || "");
    const decorative = image?.decorative === true;
    const alt = decorative ? "" : cleanText(original).trim().slice(0, maxLength);
    return {
      alt, decorative,
      notices: [...(alt !== original ? ["normalized"] : []), ...(!decorative && !alt ? ["recommended"] : [])]
    };
  }

  Object.defineProperty(scope, "DustWaveAdminShellEditorMedia", {
    value: Object.freeze({ imageThumbnail, createImagePreviewCache, applyPreviewMedia, isEmptyTextBlock, normalizeImageAccessibility }),
    configurable: false
  });
})(globalThis);
