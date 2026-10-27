import { test, expect } from '@playwright/test'

const BASE = process.env.UI_AGENT_BASE_URL ?? 'https://transovo.ai'

test.describe('Clips §1 drive home', () => {
  test('hero, chips, status filter, and project grid', async ({ page }) => {
    await page.goto(`${BASE}/app/clips`)
    await expect(page.getByTestId('drive-home')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByRole('heading', { name: /what do you want to make/i })).toBeVisible()
    await expect(page.getByTestId('drive-hero-prompt')).toBeVisible()
    await expect(page.getByTestId('drive-chip-ai-clip-maker')).toBeVisible()
    await expect(page.getByTestId('drive-status-filter')).toBeVisible()
    await expect(page.getByTestId('view-all-projects')).toBeVisible()
    await page.getByTestId('view-all-projects').click()
    await expect(page).toHaveURL(/view=all/)
    await expect(page.getByRole('heading', { name: /all projects/i })).toBeVisible()
  })
})
