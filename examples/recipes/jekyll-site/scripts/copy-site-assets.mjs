import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('_site/assets', { recursive: true });
copyFileSync('shared/dust-wave-platform/packages/site-shell/src/a11y-live-browser.js', '_site/assets/a11y-live-browser.js');
