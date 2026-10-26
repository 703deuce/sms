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

  test('respects reduced motion preference', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/app/clips')
    const duration = await page.evaluate(() => {
      const el = document.createElement('div')
      el.className = 'animate-bounce'
      document.body.appendChild(el)
      const d = getComputedStyle(el).animationDuration
      el.remove()
      return d
    })
    expect(duration === '0s' || duration === '0ms').toBeTruthy()
  })
})
