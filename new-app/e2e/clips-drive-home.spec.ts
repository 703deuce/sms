import { test, expect } from '@playwright/test'

const BASE = process.env.UI_AGENT_BASE_URL ?? 'https://transovo.ai'

test.describe('Clips §1 drive home', () => {
  test('drive home hero and recent projects region', async ({ page }) => {
    await page.goto(`${BASE}/app/clips`)
    await expect(page.getByTestId('drive-home')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByRole('heading', { name: /what do you want to make/i })).toBeVisible()
  })
})
