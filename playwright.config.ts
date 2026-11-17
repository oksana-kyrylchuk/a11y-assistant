import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  // Each test starts its own browser with the extension: keep them apart.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5180',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run test-page',
    url: 'http://localhost:5180/violations.html',
    reuseExistingServer: !process.env.CI,
  },
})
