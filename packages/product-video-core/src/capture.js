import fs from 'node:fs/promises';
import path from 'node:path';

import { normalizeProductVideoBaseUrl, normalizeProductVideoFlow } from './config.js';

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function scaledMilliseconds(value, multiplier) {
  return Math.round(value * multiplier);
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function createProductVideoStageHtml({ iframeUrl, shell, title = 'Product demo' }) {
  const safeIframeUrl = escapeHtmlAttribute(iframeUrl);
  const safeTitle = escapeHtmlAttribute(title);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${safeTitle}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      body, .stage { display: grid; place-items: center; }
      .stage { width: 100%; height: 100%; background: transparent; }
      .shell {
        position: relative;
        width: ${shell.width}px;
        height: ${shell.height}px;
        overflow: hidden;
        border-radius: ${shell.radius}px;
        background: transparent;
      }
      iframe { display: block; width: 100%; height: 100%; border: 0; background: transparent; }
      .cursor {
        position: fixed;
        left: 0;
        top: 0;
        width: 28px;
        height: 36px;
        transform: translate3d(-100px, -100px, 0);
        transform-origin: 6px 6px;
        pointer-events: none;
        z-index: 9999;
        opacity: 0;
        transition: opacity 120ms ease;
      }
      .cursor.is-visible { opacity: 1; }
      .cursor.is-pressing { filter: brightness(0.95); }
      .cursor svg {
        display: block;
        width: 100%;
        height: 100%;
        overflow: visible;
        filter: drop-shadow(0 3px 8px rgba(15, 23, 42, 0.28));
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <div class="shell" aria-hidden="true">
        <iframe id="product-video-frame" name="product-video-frame" title="${safeTitle}" src="${safeIframeUrl}"></iframe>
      </div>
    </div>
    <div id="product-video-cursor" class="cursor" aria-hidden="true">
      <svg viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 2L22 19H14L18 33L12.8 34.5L8.8 20.6L2 26V2H4Z" fill="#ffffff" stroke="#111827" stroke-width="1.6" stroke-linejoin="round"/>
      </svg>
    </div>
  </body>
</html>`;
}

async function installPresentationInitScript(context, { origin, stylesheetUrl }) {
  await context.addInitScript(
    ({ expectedOrigin, href }) => {
      const install = () => {
        if (window.location.origin !== expectedOrigin) return;
        const root = document.documentElement;
        if (!root) return;
        root.setAttribute('data-product-video-capture', 'true');
        document.body?.setAttribute('data-product-video-capture', 'true');
        if (href && !document.getElementById('product-video-presentation-link')) {
          const link = document.createElement('link');
          link.id = 'product-video-presentation-link';
          link.rel = 'stylesheet';
          link.href = href;
          (document.head || root).appendChild(link);
        }
      };
      install();
      document.addEventListener('readystatechange', install);
      document.addEventListener('DOMContentLoaded', install);
      window.addEventListener('load', install);
    },
    { expectedOrigin: origin, href: stylesheetUrl }
  );
}

async function ensurePresentation(frame, { origin, stylesheetUrl }) {
  await frame.evaluate(async ({ expectedOrigin, href }) => {
    if (window.location.origin !== expectedOrigin) {
      throw new Error('Product-video frame navigated outside the configured origin');
    }
    const root = document.documentElement;
    if (!root) throw new Error('Product-video frame has no document element');
    root.setAttribute('data-product-video-capture', 'true');
    document.body?.setAttribute('data-product-video-capture', 'true');
    if (!href) return;

    let link = document.getElementById('product-video-presentation-link');
    if (!link) {
      link = document.createElement('link');
      link.id = 'product-video-presentation-link';
      link.rel = 'stylesheet';
      link.href = href;
      (document.head || root).appendChild(link);
    }
    if (link.sheet) return;
    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Capture presentation stylesheet timed out')), 10_000);
      link.addEventListener('load', () => {
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
      link.addEventListener('error', () => {
        window.clearTimeout(timeout);
        reject(new Error('Capture presentation stylesheet failed to load'));
      }, { once: true });
    });
  }, { expectedOrigin: origin, href: stylesheetUrl });
}

async function waitForFrameUrl(frame, expectedSubstring, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (frame.url().includes(expectedSubstring)) return;
    await wait(100);
  }
  throw new Error(`Timed out waiting for the product-video frame URL to include ${JSON.stringify(expectedSubstring)}`);
}

async function waitForProductFrame(page, expectedUrl) {
  const iframe = page.locator('#product-video-frame');
  await iframe.waitFor({ state: 'visible', timeout: 15_000 });
  const handle = await iframe.elementHandle();
  if (!handle) throw new Error('Could not find the product-video iframe');
  const frame = await handle.contentFrame();
  if (!frame) throw new Error('Could not resolve the product-video iframe content');
  await waitForFrameUrl(frame, expectedUrl, 15_000);
  await frame.waitForLoadState('load');
  return frame;
}

async function setCursorState(page, { x, y, visible = true, pressing = false }) {
  await page.evaluate(({ nextX, nextY, nextVisible, nextPressing }) => {
    const cursor = document.getElementById('product-video-cursor');
    if (!cursor) return;
    cursor.dataset.x = String(nextX);
    cursor.dataset.y = String(nextY);
    cursor.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
    cursor.classList.toggle('is-visible', Boolean(nextVisible));
    cursor.classList.toggle('is-pressing', Boolean(nextPressing));
  }, { nextX: x, nextY: y, nextVisible: visible, nextPressing: pressing });
}

async function animateCursor(page, { x, y, durationMs }) {
  const start = await page.evaluate(() => {
    const cursor = document.getElementById('product-video-cursor');
    return { x: Number(cursor?.dataset.x || 0), y: Number(cursor?.dataset.y || 0) };
  });
  const steps = Math.max(1, Math.round(durationMs / 16));
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    const eased = 1 - Math.pow(1 - progress, 3);
    const nextX = Math.round(start.x + (x - start.x) * eased);
    const nextY = Math.round(start.y + (y - start.y) * eased);
    await page.mouse.move(nextX, nextY);
    await setCursorState(page, { x: nextX, y: nextY });
    await wait(Math.max(8, Math.round(durationMs / steps)));
  }
}

async function runAction({ page, frame, action, index, timingMultiplier, presentation, baseUrl }) {
  if (action.action === 'wait') {
    await wait(scaledMilliseconds(action.ms, timingMultiplier));
    return;
  }
  if (action.action === 'waitForURLIncludes') {
    await waitForFrameUrl(frame, action.value, scaledMilliseconds(action.timeoutMs, timingMultiplier));
    return;
  }
  if (action.action === 'goto') {
    await frame.goto(new URL(action.url, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    await frame.waitForLoadState('load');
    await ensurePresentation(frame, presentation);
    if (action.waitAfterMs) await wait(scaledMilliseconds(action.waitAfterMs, timingMultiplier));
    return;
  }

  const locator = frame.locator(action.selector);
  await locator.waitFor({ state: 'visible', timeout: scaledMilliseconds(action.timeoutMs, timingMultiplier) });
  await locator.scrollIntoViewIfNeeded();
  const elementBox = await locator.boundingBox();
  if (!elementBox) throw new Error('Could not resolve target bounds for cursor movement');
  const target = {
    x: Math.round(elementBox.x + elementBox.width / 2),
    y: Math.round(elementBox.y + elementBox.height / 2)
  };
  await animateCursor(page, {
    ...target,
    durationMs: scaledMilliseconds(action.moveDurationMs, timingMultiplier)
  });
  await setCursorState(page, { ...target, pressing: true });
  await wait(scaledMilliseconds(80, timingMultiplier));
  await page.mouse.down();
  await wait(scaledMilliseconds(action.delayMs, timingMultiplier));
  await page.mouse.up();
  await setCursorState(page, { ...target, pressing: false });
  if (action.waitAfterMs) await wait(scaledMilliseconds(action.waitAfterMs, timingMultiplier));
  await ensurePresentation(frame, presentation);
}

export async function captureProductVideoFrames({
  chromium,
  baseUrl,
  flow: flowInput,
  outputDir,
  allowRemoteOrigin = false
}) {
  if (!chromium || typeof chromium.launch !== 'function') {
    throw new TypeError('chromium with a launch function is required');
  }
  const normalizedBaseUrl = normalizeProductVideoBaseUrl(baseUrl, { allowRemote: allowRemoteOrigin });
  const flow = normalizeProductVideoFlow(flowInput);
  const iframeUrl = new URL(flow.initialPath, normalizedBaseUrl).toString();
  const presentation = {
    origin: new URL(normalizedBaseUrl).origin,
    stylesheetUrl: flow.presentation.stylesheetPath
      ? new URL(flow.presentation.stylesheetPath, normalizedBaseUrl).toString()
      : null
  };
  const browser = await chromium.launch({ headless: true });
  const startedAt = Date.now();
  let page;

  try {
    const context = await browser.newContext({
      viewport: flow.capture.viewport,
      deviceScaleFactor: 1
    });
    await installPresentationInitScript(context, presentation);
    page = await context.newPage();
    await page.setContent(createProductVideoStageHtml({
      iframeUrl,
      shell: flow.capture.shell,
      title: flow.name
    }), { waitUntil: 'domcontentloaded' });

    const frame = await waitForProductFrame(page, iframeUrl);
    await ensurePresentation(frame, presentation);
    const cursor = flow.capture.cursor;
    await page.mouse.move(cursor.startX, cursor.startY);
    await setCursorState(page, { x: cursor.startX, y: cursor.startY });

    const frameIntervalMs = 1_000 / flow.capture.fps;
    let captureRunning = true;
    let capturedFrameCount = 0;
    let captureLoopError = null;
    const captureStartedAt = Date.now();
    const captureLoop = (async () => {
      while (captureRunning) {
        const fileName = `frame-${String(capturedFrameCount).padStart(5, '0')}.png`;
        await page.screenshot({ path: path.join(outputDir, fileName), omitBackground: true });
        capturedFrameCount += 1;
        const nextTick = captureStartedAt + capturedFrameCount * frameIntervalMs;
        const delay = nextTick - Date.now();
        if (delay > 0) await wait(delay);
      }
    })().catch((error) => {
      captureLoopError = error;
    });

    let actionError = null;
    try {
      await wait(scaledMilliseconds(flow.capture.preRollMs, flow.capture.timingMultiplier));
      for (let index = 0; index < flow.actions.length; index += 1) {
        try {
          await runAction({
            page,
            frame,
            action: flow.actions[index],
            index,
            timingMultiplier: flow.capture.timingMultiplier,
            presentation,
            baseUrl: normalizedBaseUrl
          });
        } catch (error) {
          throw new Error(`Capture step ${index + 1} failed (${flow.actions[index].action}): ${error.message}`);
        }
      }
      await wait(scaledMilliseconds(flow.capture.postRollMs, flow.capture.timingMultiplier));
    } catch (error) {
      actionError = error;
    } finally {
      captureRunning = false;
      await captureLoop;
    }
    if (actionError) throw actionError;
    if (captureLoopError) throw captureLoopError;
    if (capturedFrameCount === 0) throw new Error('Product-video capture produced no frames');

    const captureElapsedMilliseconds = Math.max(1, Date.now() - captureStartedAt);
    const effectiveFps = capturedFrameCount / (captureElapsedMilliseconds / 1_000);
    if (effectiveFps < flow.capture.fps * flow.capture.minimumEffectiveFpsRatio) {
      throw new Error(`Product-video capture effective FPS ${effectiveFps.toFixed(2)} fell below the configured threshold`);
    }
    const manifest = {
      version: 1,
      name: flow.name,
      baseUrl: normalizedBaseUrl,
      outputDir,
      fps: flow.capture.fps,
      effectiveFps: Number(effectiveFps.toFixed(3)),
      frameCount: capturedFrameCount,
      durationSeconds: Number((capturedFrameCount / flow.capture.fps).toFixed(3)),
      elapsedMilliseconds: Date.now() - startedAt,
      viewport: flow.capture.viewport,
      shell: flow.capture.shell,
      timingMultiplier: flow.capture.timingMultiplier
    };
    await fs.writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    return manifest;
  } finally {
    await browser.close();
  }
}
