import { test, expect } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://transovo.ai'
const PROJECT_ID =
  process.env.SCRIPT_E2E_PROJECT_ID || 'proj_89c551443cb34a48a034a2260e9eeeca'

test.describe('Script editor prod (M4.1 + export)', () => {
  test('health: favicon 200, notifications/status not 502', async ({ request }) => {
    const fav = await request.get(`${BASE}/favicon.ico`)
    expect(fav.status()).toBe(200)
    expect(fav.headers()['content-type'] || '').toMatch(/image\/(svg\+xml|png|x-icon)/i)

    const notes = await request.get(`${BASE}/api/notifications`)
    expect(notes.status()).not.toBe(502)
    expect([200, 503]).toContain(notes.status())

    const status = await request.get(`${BASE}/api/clips/projects/${PROJECT_ID}/status`)
    expect(status.status()).not.toBe(502)
    expect([200, 404, 503]).toContain(status.status())
  })

  test('proj cuts persist, timeline fit', async ({ page }) => {
    test.setTimeout(900_000)
    if (!process.env.ROOMS_E2E_STORAGE_STATE && !process.env.E2E_STORAGE_STATE) {
      test.skip(true, 'Set ROOMS_E2E_STORAGE_STATE')
    }

    await page.goto(`/app/clips/${PROJECT_ID}/script`, { waitUntil: 'networkidle', timeout: 180_000 })
    await expect(page.locator('[data-script-shell]')).toBeVisible({ timeout: 120_000 })

    const wordBtn = page.locator('button[data-word-idx]').first()
    await expect(wordBtn).toBeVisible({ timeout: 60_000 })
    const idx = await wordBtn.getAttribute('data-word-idx')
    expect(idx).toBeTruthy()

    await page.locator('[data-script-shell]').click()
    await wordBtn.click()
    await page.keyboard.press('Delete')
    await expect(page.locator(`button[data-word-idx="${idx}"]`)).toHaveClass(/line-through/, {
      timeout: 15_000,
    })
    await expect(page.getByText(/^Saved$/)).toBeVisible({ timeout: 60_000 })

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
  })

  test('export output duration matches EDL (M5)', async ({ request }) => {
    test.setTimeout(900_000)
    if (!process.env.ROOMS_E2E_STORAGE_STATE && !process.env.E2E_STORAGE_STATE) {
      test.skip(true, 'Set ROOMS_E2E_STORAGE_STATE')
    }

    const bootRes = await request.get(`/api/clips/projects/${PROJECT_ID}/script/bootstrap`)
    expect(bootRes.ok()).toBeTruthy()
    const bootJson = await bootRes.json()
    const compositionId = bootJson.data?.compositionId as string
    expect(compositionId).toMatch(/^sc?cmp_/)

    const exportRes = await request.post(`/api/clips/compositions/${compositionId}/export/video`, {
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
    for (let i = 0; i < 360; i++) {
      const poll = await request.get(`/api/clips/compositions/${compositionId}/export/${renderId}`)
      if (poll.status() === 404) {
        throw new Error(`export poll 404 renderId=${renderId}`)
      }
      if (poll.status() === 502 || poll.status() === 503) {
        await new Promise((r) => setTimeout(r, 5000))
        continue
      }
      const raw = await poll.text()
      let body: Record<string, unknown>
      try {
        body = JSON.parse(raw) as Record<string, unknown>
      } catch {
        await new Promise((r) => setTimeout(r, 5000))
        continue
      }
      if (body.edlDurationMs != null) edlMs = body.edlDurationMs
      if (body.outputDurationMs != null) outMs = body.outputDurationMs
      if (body.status === 'READY' && edlMs != null && outMs != null) break
      if (body.status === 'FAILED') {
        throw new Error(`export failed: ${body.error ?? JSON.stringify(body)}`)
      }
      await new Promise((r) => setTimeout(r, 5000))
    }
    expect(edlMs).toBeGreaterThan(0)
    expect(outMs).toBeGreaterThan(0)
    expect(Math.abs(outMs! - edlMs!)).toBeLessThan(1500)
  })
})
