import { test, expect } from '@playwright/test'

test.describe('clips a11y smoke', () => {
  test('projects page has main landmarks', async ({ page }) => {
    await page.goto('/app/clips')
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
    await expect(page.getByTestId('app-sidebar')).toBeVisible()
  })

  test('focus visible on sidebar link', async ({ page }) => {
    await page.goto('/app/clips')
    await page.keyboard.press('Tab')
    const focused = page.locator(':focus-visible')
    await expect(focused).toBeVisible()
  })
})
