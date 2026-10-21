(function(scope) {
  "use strict";
  if (scope.DustWaveScriptLoader) return;

  // One loader per consumer resource. The consumer owns URL, marker and SDK lookup.
  function createScriptLoader({ document = scope.document, src, selector, mark,
    getValue, loadError = "Script failed to load.", missingValueError = "Script loaded without its API." }) {
    let pending;
    return function load() {
      const value = getValue();
      if (value) return Promise.resolve(value);
      if (pending) return pending;
      let resolve, reject, script, settled = false;
      pending = new Promise((yes, no) => { resolve = yes; reject = no; });
      const result = pending;
      function cleanup() {
        script?.removeEventListener("load", loaded);
        script?.removeEventListener("error", failed);
      }
      function finish(error, api) {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) {
          script?.remove();
          pending = undefined;
          reject(error);
        } else resolve(api);
      }
      function loaded() {
        try {
          const api = getValue();
          finish(api ? null : new Error(missingValueError), api);
        } catch (error) { finish(error); }
      }
      function failed() { finish(new Error(loadError)); }
      try {
        script = document.querySelector(selector);
        const existing = Boolean(script);
        if (!existing) {
          script = document.createElement("script");
          script.src = src;
          script.async = true;
          mark(script);
        }
        script.addEventListener("load", loaded);
        script.addEventListener("error", failed);
        if (!existing) document.head.appendChild(script);
      } catch (error) { finish(error); }
      return result;
    };
  }
  Object.defineProperty(scope, "DustWaveScriptLoader", {
    value: Object.freeze({ createScriptLoader }), configurable: false
  });
})(globalThis);
