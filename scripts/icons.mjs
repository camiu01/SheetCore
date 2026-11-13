/**
 * Rasterize the original local SVG icon, without external artwork or network calls.
 * Requires `npx playwright install chromium` once.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%}svg{width:100%;height:100%}</style>${svg}`);
    await page.screenshot({ path: new URL(`../public/icon-${size}.png`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), omitBackground: true });
    await page.close();
  }
} finally { await browser.close(); }
