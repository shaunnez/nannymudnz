import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/screen-tour',
  outputDir: 'screen-tour-report/artifacts',
  reporter: [
    ['list'],
    ['./tests/screen-tour/markdown-reporter.ts'],
  ],
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 720 },
    screenshot: 'off',
    video: 'off',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    // Set to false so Playwright always starts a clean server.
    // If you already have the dev server running, kill it first:
    //   npx kill-port 5173 && npx kill-port 2567
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  timeout: 90_000,
  retries: 0,
});
