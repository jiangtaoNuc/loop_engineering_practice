import { defineConfig, devices } from '@playwright/test';

const BFF_PORT = process.env.BFF_PORT ?? '3300';
const WEB_PORT = process.env.WEB_PORT ?? '5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `npx tsx src/index.ts --mock-fixture ${process.env.MOCK_FIXTURE_PATH ?? 'test/fixtures/ac-01-issue-created.json'}`,
      cwd: '../bff',
      port: Number(BFF_PORT),
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: 'npx vite --port ' + WEB_PORT,
      port: Number(WEB_PORT),
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
