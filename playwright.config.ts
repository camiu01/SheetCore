/** @file Acceptance tests run the real production build, including its service worker. */
import { defineConfig, devices } from '@playwright/test';
// Allow isolated acceptance runs while the user's preview remains open.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PLAYWRIGHT_PORT');
// Exercise the same build at the origin root or under a static-host subdirectory.
const basePath = process.env.PLAYWRIGHT_BASE_PATH ?? '/';
if (!/^\/(?:[A-Za-z0-9_.-]+\/)*$/.test(basePath)
  || basePath.split('/').some(part => part === '.' || part === '..')) {
  throw new Error('Invalid PLAYWRIGHT_BASE_PATH: use a slash-delimited ASCII path');
}
const baseURL = `http://127.0.0.1:${port}${basePath}`;
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: `npm run preview -- --port ${port} --strictPort --base ${basePath}`,
    url: baseURL, reuseExistingServer: false, timeout: 30000
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } }
  ]
});
