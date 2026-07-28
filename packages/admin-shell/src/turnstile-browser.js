(function(scope) {
  "use strict";

  if (scope.DustWaveAdminShellTurnstile?.responsiveSize) return;

  const MINIMUM_FLEXIBLE_WIDTH = 300;

  function measuredWidth(container) {
    const rectWidth = Number(container?.getBoundingClientRect?.().width);
    if (Number.isFinite(rectWidth) && rectWidth > 0) return rectWidth;

    const clientWidth = Number(container?.clientWidth);
    if (Number.isFinite(clientWidth) && clientWidth > 0) return clientWidth;

    return 0;
  }

  function responsiveSize(container) {
    const width = measuredWidth(container);
    return width >= MINIMUM_FLEXIBLE_WIDTH ? "flexible" : "compact";
  }

  Object.defineProperty(scope, "DustWaveAdminShellTurnstile", {
    configurable: false,
    enumerable: false,
    value: Object.freeze({
      minimumFlexibleWidth: MINIMUM_FLEXIBLE_WIDTH,
      responsiveSize
    }),
    writable: false
  });
})(globalThis);
