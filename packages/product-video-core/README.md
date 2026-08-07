# Product Video Core

`@dustwave/product-video-core` is a framework-neutral local capture and alpha-video rendering tool. Consumers supply their preview server, product flow, selectors, presentation stylesheet, output name, and publication destination.

It provides:

- a bounded JSON flow contract for same-origin `wait`, `goto`, URL wait, and click actions
- Playwright frame capture with a transparent stage and visible synthetic cursor
- an allowlisted generated-output root that never recursively deletes or overwrites a run
- shell-free FFmpeg plans for ProRes 4444, VP9 WebM alpha, and HEVC alpha
- FFprobe JSON evidence for every rendered output

## Consumer setup

Consumers pin the Platform commit and package version, install a compatible `@playwright/test`, and keep product policy locally:

```json
{
  "name": "example-homepage-flow",
  "initialPath": "/",
  "presentation": {
    "stylesheetPath": "/assets/product-video-capture.css"
  },
  "capture": {
    "fps": 24,
    "viewport": { "width": 1920, "height": 1080 },
    "shell": { "width": 1480, "height": 960, "radius": 24 }
  },
  "actions": [
    { "action": "click", "selector": "[data-demo-entry]" },
    { "action": "waitForURLIncludes", "value": "/demo/" }
  ]
}
```

Start the consumer preview, then capture into a new directory below the work root:

```bash
node shared/dust-wave-platform/packages/product-video-core/bin/capture-product-video.mjs \
  --base-url http://127.0.0.1:4010 \
  --flow video/product-demo.json \
  --work-root tmp/product-video \
  --output-dir tmp/product-video/20260806-120000/frames \
  > tmp/product-video/20260806-120000/capture-manifest.json
```

Render the captured frames:

```bash
node shared/dust-wave-platform/packages/product-video-core/bin/render-product-video.mjs \
  --manifest tmp/product-video/20260806-120000/capture-manifest.json \
  --work-root tmp/product-video \
  --output-dir tmp/product-video/20260806-120000/output \
  --name product-demo
```

HEVC alpha uses `hevc_videotoolbox` and therefore requires a compatible Apple FFmpeg build. Other environments can select only `--format prores --format webm`.

## Safety and ownership

- Preview origins default to loopback. Remote capture requires the explicit `--allow-remote-origin` flag.
- Flows cannot evaluate arbitrary JavaScript or navigate cross-origin.
- Generated directories must be descendants of a consumer-owned work root below the current workspace.
- Existing output is preserved and causes a failure; the tool never performs recursive cleanup.
- Commands are passed directly to FFmpeg/FFprobe without a shell.
- Platform owns no browser installation, product data, credentials, templates, build server, generated media, marketing repository, publication, or deployment.
