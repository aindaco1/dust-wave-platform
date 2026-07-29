(function(scope) {
  "use strict";

  if (scope.DustWaveAdminShellUnsavedChanges?.mountUnsavedChangesGuard) return;

  function mountUnsavedChangesGuard(options = {}) {
    const eventTarget = options.eventTarget || scope;
    const hasUnsavedChanges = options.hasUnsavedChanges;
    const confirmDiscard = options.confirmDiscard
      || (typeof scope.confirm === "function" ? scope.confirm.bind(scope) : null);

    if (
      typeof eventTarget?.addEventListener !== "function"
      || typeof eventTarget?.removeEventListener !== "function"
    ) {
      throw new TypeError("An event target is required");
    }
    if (typeof hasUnsavedChanges !== "function") {
      throw new TypeError("A dirty-state callback is required");
    }

    let connected = true;

    function isDirty(callback = hasUnsavedChanges) {
      try {
        return Boolean(callback());
      } catch (_error) {
        return true;
      }
    }

    function handleBeforeUnload(event) {
      if (!isDirty()) return;
      event?.preventDefault?.();
      if (event) event.returnValue = "";
    }

    eventTarget.addEventListener("beforeunload", handleBeforeUnload);

    return Object.freeze({
      confirmTransition(message = "", transitionHasUnsavedChanges) {
        if (!isDirty(transitionHasUnsavedChanges || hasUnsavedChanges)) {
          return true;
        }
        if (typeof confirmDiscard !== "function") return false;
        try {
          return confirmDiscard(String(message)) === true;
        } catch (_error) {
          return false;
        }
      },
      disconnect() {
        if (!connected) return;
        connected = false;
        eventTarget.removeEventListener("beforeunload", handleBeforeUnload);
      },
      hasUnsavedChanges: isDirty
    });
  }

  Object.defineProperty(scope, "DustWaveAdminShellUnsavedChanges", {
    configurable: false,
    enumerable: false,
    value: Object.freeze({ mountUnsavedChangesGuard }),
    writable: false
  });
})(globalThis);
