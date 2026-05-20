// @ts-check
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Подгружаем .env.local (PLAYWRIGHT_EMAIL / PLAYWRIGHT_PASSWORD / опц. PLAYWRIGHT_BASE_URL)
dotenv.config({ path: '.env.local' });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const AUTH_FILE = 'playwright/.auth/session.json';

export default defineConfig({
  testDir: './playwright',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    // 1) Логинимся один раз и сохраняем session.json
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    // 2) Сами smoke-тесты — уже с авторизацией
    {
      name: 'smoke',
      testMatch: /tests\/.*\.spec\.js/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
    },
  ],
});
