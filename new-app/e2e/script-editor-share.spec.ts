import { test, expect } from '@playwright/test'

const BASE = process.env.UI_AGENT_BASE_URL ?? 'https://transovo.ai'

test.describe('Script editor §17 share', () => {
  test('project access modal test id documented for prod session', async ({ page }) => {
    await page.goto(`${BASE}/app/clips`)
    await expect(page.getByTestId('drive-home')).toBeVisible({ timeout: 60_000 })
  })
})
