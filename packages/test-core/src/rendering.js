export async function waitForStableRendering(page, fontTimeoutMs = 2000) {
  await page.evaluate(async timeoutMs => {
    const fontsReady = document.fonts?.ready
      ? Promise.resolve(document.fonts.ready).catch(() => undefined)
      : Promise.resolve();
    await Promise.race([fontsReady, new Promise(resolve => window.setTimeout(resolve, timeoutMs))]);
    await new Promise(resolve => window.requestAnimationFrame(resolve));
    await new Promise(resolve => window.requestAnimationFrame(resolve));
  }, fontTimeoutMs);
}

// Serve a same-origin stylesheet so strict CSP fixtures exercise text scaling.
export async function applyTextScale(page, percent = 200, { pathPrefix = "/__text-scale-" } = {}) {
  if (!Number.isFinite(percent) || percent <= 0 || percent > 1000) throw new RangeError("Invalid text scale");
  if (!/^\/[A-Za-z0-9_/-]+$/.test(pathPrefix)) throw new TypeError("A same-origin path prefix is required");
  const stylesheetPath = `${pathPrefix}${percent}.css`;
  await page.route(`**${stylesheetPath}`, route => route.fulfill({
    contentType: "text/css", body: `:root { font-size: ${percent}% !important; }`
  }));
  await page.addStyleTag({ url: stylesheetPath });
  await waitForStableRendering(page);
}
