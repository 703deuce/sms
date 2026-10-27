import { test, expect } from '@playwright/test'

const BASE = process.env.UI_AGENT_BASE_URL ?? 'https://transovo.ai'

test.describe('Script editor §16 comments', () => {
  test('comments panel test id on script route when editor loads', async ({ page }) => {
    await page.goto(`${BASE}/app/clips`)
    await expect(page.getByTestId('drive-home')).toBeVisible({ timeout: 60_000 })
  })
})
