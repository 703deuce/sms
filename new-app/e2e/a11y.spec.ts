import { test, expect } from '@playwright/test'

const ROUTES = [
  '/app/clips',
  '/app/clips/new',
  '/app/clips/exports',
  '/app/clips/brand',
  '/app/help',
] as const

async function assertNoSeriousViolations(page: import('@playwright/test').Page, label: string) {
  const { default: AxeBuilder } = await import('@axe-core/playwright')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  if (serious.length) {
    console.error(`${label} axe violations:`, JSON.stringify(serious, null, 2))
  }
  expect(serious, `${label}: ${serious.map((v) => v.id).join(', ')}`).toHaveLength(0)
}

async function gotoWithTheme(page: import('@playwright/test').Page, route: string, theme: 'dark' | 'light') {
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.evaluate((t) => {
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(t)
  }, theme)
  await page.waitForTimeout(600)
}

test.describe('axe dark', () => {
  for (const route of ROUTES) {
    test(`${route}`, async ({ page }) => {
      await gotoWithTheme(page, route, 'dark')
      await assertNoSeriousViolations(page, `dark ${route}`)
    })
  }
})

test.describe('axe light', () => {
  for (const route of ROUTES) {
    test(`${route}`, async ({ page }) => {
      await gotoWithTheme(page, route, 'light')
      await assertNoSeriousViolations(page, `light ${route}`)
    })
  }
})

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
    await page.goto('/app/clips', { waitUntil: 'domcontentloaded' })
    const duration = await page.evaluate(() => {
      const el = document.createElement('div')
      el.className = 'animate-bounce'
      document.body.appendChild(el)
      const d = getComputedStyle(el).animationDuration
      el.remove()
      return d
    })
    const ms = parseFloat(duration)
    expect(ms <= 0.02 || duration === '0s' || duration === '0ms').toBeTruthy()
  })
})
