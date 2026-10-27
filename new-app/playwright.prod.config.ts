import { defineConfig } from '@playwright/test'

const storageState = process.env.ROOMS_E2E_STORAGE_STATE || process.env.E2E_STORAGE_STATE

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://transovo.ai',
    ...(storageState ? { storageState } : {}),
    trace: 'on-first-retry',
  },
})
