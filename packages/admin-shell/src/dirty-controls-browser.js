(function(scope) {
  "use strict";

  if (scope.DustWaveAdminShellDirtyControls?.setDirtyButtonState) return;

  function isButtonControl(button) {
    return Boolean(
      button
      && typeof button === "object"
      && String(button.tagName || "").toUpperCase() === "BUTTON"
      && typeof button.classList?.toggle === "function"
      && button.dataset
    );
  }

  function setDirtyButtonState(
    button,
    dirty,
    cleanText = "",
    dirtyText = cleanText,
    options = {}
  ) {
    if (!isButtonControl(button)) return false;
    const isDirty = Boolean(dirty);
    button.classList.toggle("is-dirty", isDirty);
    button.dataset.dirtyState = isDirty ? "dirty" : "clean";
    button.textContent = String(isDirty ? dirtyText : cleanText);
    if (options?.disableWhenClean !== false) {
      button.disabled = !isDirty || Boolean(options?.forceDisabled);
    }
    return true;
  }

  Object.defineProperty(scope, "DustWaveAdminShellDirtyControls", {
    configurable: false,
    enumerable: false,
    value: Object.freeze({ setDirtyButtonState }),
    writable: false
  });
})(globalThis);
