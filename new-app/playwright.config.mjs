/** @type {import('@playwright/test').PlaywrightTestConfig} */
export default {
  testDir: './e2e',
  // Owner prod script-editor: SCRIPT_E2E_PROJECT_ID = ≤3 min fixture (test_interview_60s trim).
  // SCRIPT_E2E_MAX_MS defaults to 180_000. Never point at 25+ min source projects.
  timeout: 120_000,
  retries: 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://transovo.ai',
    viewport: { width: 1024, height: 640 },
  },
}
