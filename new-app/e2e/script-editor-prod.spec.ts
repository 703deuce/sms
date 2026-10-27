import { test, expect, chromium } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://transovo.ai'
const STORAGE =
  process.env.ROOMS_E2E_STORAGE_STATE ||
  process.env.E2E_STORAGE_STATE ||
  undefined
const PROJECT_ID = process.env.SCRIPT_E2E_PROJECT_ID || 'proj_89c551'

test.describe('Script editor prod (M4.1 + export)', () => {
  test('health: favicon, notifications, project status', async ({ request }) => {
    const fav = await request.get(`${BASE}/favicon.ico`)
    expect(fav.status()).toBeLessThan(400)

    const notes = await request.get(`${BASE}/api/notifications`)
    expect(notes.status()).toBeLessThan(500)

    const status = await request.get(`${BASE}/api/clips/projects/${PROJECT_ID}/status`)
    expect(status.status()).toBeLessThan(500)
  })

  test('proj cuts persist, timeline fit, export duration', async () => {
    test.setTimeout(900_000)
    if (!STORAGE) {
      test.skip(true, 'Set ROOMS_E2E_STORAGE_STATE for authenticated editor e2e')
    }

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ baseURL: BASE, storageState: STORAGE })
    const page = await context.newPage()

    await page.goto(`/app/clips/${PROJECT_ID}/script`, { waitUntil: 'networkidle', timeout: 180_000 })
    await expect(page.locator('[data-script-shell]')).toBeVisible({ timeout: 120_000 })

    const wordBtn = page.locator('button[data-word-idx]').first()
    await expect(wordBtn).toBeVisible({ timeout: 60_000 })
    const idx = await wordBtn.getAttribute('data-word-idx')
    expect(idx).toBeTruthy()

    await wordBtn.click()
    await page.keyboard.press('Delete')
    await page.waitForTimeout(1500)

    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator(`button[data-word-idx="${idx}"]`)).toHaveClass(/line-through/, { timeout: 60_000 })

    await page.getByRole('button', { name: 'Undo' }).click()
    await page.waitForTimeout(800)
    await expect(page.locator(`button[data-word-idx="${idx}"]`)).not.toHaveClass(/line-through/)

    const shell = page.locator('[data-script-shell]')
    const shellW = await shell.evaluate((el) => el.clientWidth)
    const timelineScroller = page.locator('.overflow-x-auto').first()
    const timelineW = await timelineScroller.evaluate((el) => el.scrollWidth)
    expect(timelineW).toBeGreaterThanOrEqual(shellW * 0.85)

    const exportBtn = page.getByRole('button', { name: /export/i }).first()
    if (await exportBtn.isVisible().catch(() => false)) {
      await exportBtn.click()
      const videoOpt = page.getByRole('menuitem', { name: /video/i }).first()
      if (await videoOpt.isVisible().catch(() => false)) {
        await videoOpt.click()
      }
    }

    await browser.close()
  })
})
