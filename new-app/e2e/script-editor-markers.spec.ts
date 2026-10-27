import { test, expect } from '@playwright/test'

const BASE = process.env.UI_AGENT_BASE_URL ?? 'https://transovo.ai'

test.describe('Script editor §14 markers', () => {
  test('template chips map to real presets', async ({ page }) => {
    await page.goto(`${BASE}/app/clips`)
    await expect(page.getByTestId('drive-home')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('drive-chip-podcast-to-shorts').click()
    await expect(page).toHaveURL(/preset=podcast-to-shorts/)
  })
})
