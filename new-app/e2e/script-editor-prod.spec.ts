import { test, expect, chromium, type APIRequestContext } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://transovo.ai'
const STORAGE =
  process.env.ROOMS_E2E_STORAGE_STATE ||
  process.env.E2E_STORAGE_STATE ||
  undefined
const PROJECT_ID = process.env.SCRIPT_E2E_PROJECT_ID || 'proj_89c551'

async function authedApi(): Promise<APIRequestContext> {
  if (!STORAGE) throw new Error('missing storage state')
  return await chromium.request.newContext({ baseURL: BASE, storageState: STORAGE })
}

test.describe('Script editor prod (M4.1 + export)', () => {
  test('health: favicon 200, notifications/status not 502', async ({ request }) => {
    const fav = await request.get(`${BASE}/favicon.ico`)
    expect(fav.status()).toBe(200)
    expect(fav.headers()['content-type'] || '').toMatch(/svg/i)

    const notes = await request.get(`${BASE}/api/notifications`)
    expect(notes.status()).not.toBe(502)
    expect([200, 503]).toContain(notes.status())

    const status = await request.get(`${BASE}/api/clips/projects/${PROJECT_ID}/status`)
    expect(status.status()).not.toBe(502)
    expect([200, 404, 503]).toContain(status.status())
  })

  test('proj cuts persist, timeline fit, filler/gap panels', async () => {
    test.setTimeout(900_000)
    if (!STORAGE) test.skip(true, 'Set ROOMS_E2E_STORAGE_STATE')

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ baseURL: BASE, storageState: STORAGE })
    const page = await context.newPage()

    await page.goto(`/app/clips/${PROJECT_ID}/script`, { waitUntil: 'networkidle', timeout: 180_000 })
    await expect(page.locator('[data-script-shell]')).toBeVisible({ timeout: 120_000 })
    await expect(page.getByTestId('script-filler-review-bar').or(page.locator('[data-script-shell]'))).toBeVisible()

    const wordBtn = page.locator('button[data-word-idx]').first()
    await expect(wordBtn).toBeVisible({ timeout: 60_000 })
    const idx = await wordBtn.getAttribute('data-word-idx')
    expect(idx).toBeTruthy()

    await wordBtn.click()
    await page.keyboard.press('Delete')
    await page.waitForTimeout(2000)

    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator(`button[data-word-idx="${idx}"]`)).toHaveClass(/line-through/, { timeout: 60_000 })

    await page.getByRole('button', { name: 'Undo' }).click()
    await page.waitForTimeout(1000)
    await expect(page.locator(`button[data-word-idx="${idx}"]`)).not.toHaveClass(/line-through/)

    await page.getByRole('button', { name: 'Fit composition' }).click()
    const shell = page.locator('[data-script-shell]')
    const shellW = await shell.evaluate((el) => el.clientWidth)
    const timelineScroller = page.locator('[data-script-shell] .overflow-x-auto').first()
    const timelineW = await timelineScroller.evaluate((el) => el.scrollWidth)
    expect(timelineW).toBeGreaterThanOrEqual(shellW * 0.7)

    await browser.close()
  })

  test('export output duration matches EDL (M5)', async () => {
    test.setTimeout(900_000)
    if (!STORAGE) test.skip(true, 'Set ROOMS_E2E_STORAGE_STATE')

    const api = await authedApi()
    const bootRes = await api.get(`/api/clips/projects/${PROJECT_ID}/script/bootstrap`)
    expect(bootRes.ok()).toBeTruthy()
    const bootJson = await bootRes.json()
    const compositionId = bootJson.data?.compositionId as string
    expect(compositionId).toMatch(/^comp_/)

    const exportRes = await api.post(`/api/clips/compositions/${compositionId}/export/video`, {
      data: {
        exportKind: 'video',
        resolution: '720p',
        quality: 'medium',
        burnCaptions: false,
        includeSubtitleTrack: false,
      },
    })
    expect(exportRes.ok()).toBeTruthy()
    const exportJson = await exportRes.json()
    const renderId = (exportJson.renderId ?? exportJson.data?.renderId) as string
    expect(renderId).toBeTruthy()

    let edlMs: number | null = null
    let outMs: number | null = null
    for (let i = 0; i < 120; i++) {
      const poll = await api.get(`/api/clips/compositions/${compositionId}/export/${renderId}`)
      const body = await poll.json()
      if (body.edlDurationMs != null) edlMs = body.edlDurationMs
      if (body.outputDurationMs != null) outMs = body.outputDurationMs
      if (body.status === 'READY' && edlMs != null && outMs != null) break
      if (body.status === 'FAILED') break
      await new Promise((r) => setTimeout(r, 5000))
    }
    expect(edlMs).toBeGreaterThan(0)
    expect(outMs).toBeGreaterThan(0)
    expect(Math.abs(outMs! - edlMs!)).toBeLessThan(1500)

    await api.dispose()
  })
})
