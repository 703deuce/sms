import { test, expect } from '@playwright/test'

test.describe('T6 template preview parity (dev)', () => {
  test.skip(process.env.NODE_ENV === 'production', 'dev-only route')
  test('template preview page loads', async ({ page }) => {
    await page.goto('/dev/template-preview?template=G4')
    await expect(page.getByTestId('template-stage')).toBeVisible({ timeout: 15_000 })
  })
})
