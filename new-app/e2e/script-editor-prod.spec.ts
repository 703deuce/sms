import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://transovo.ai'
/** Owner-run prod tests only. Source must be ≤2 min (e.g. test_interview_60s project). */
const PROJECT_ID = process.env.SCRIPT_E2E_PROJECT_ID
const MAX_SOURCE_MS = Number(process.env.SCRIPT_E2E_MAX_MS || 120_000)

test.describe('Script editor prod (M4.1 + export)', () => {
  test.beforeAll(() => {
    if (!PROJECT_ID) {
      test.skip(true, 'Set SCRIPT_E2E_PROJECT_ID to a ≤2 min fixture project (not the 32 min proj)')
    }
  })

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
    test.setTimeout(300_000)
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

  test('M4.1 §5/§7/§10: filler bar, reframe, timeline cuts', async ({ page }) => {
    test.setTimeout(300_000)
    if (!process.env.ROOMS_E2E_STORAGE_STATE && !process.env.E2E_STORAGE_STATE) {
      test.skip(true, 'Set ROOMS_E2E_STORAGE_STATE')
    }

    await page.goto(`/app/clips/${PROJECT_ID}/script`, { waitUntil: 'networkidle', timeout: 180_000 })
    await expect(page.locator('[data-script-shell]')).toBeVisible({ timeout: 120_000 })

    const fillersChip = page.getByRole('button', { name: /Fillers \d+/ })
    if (await fillersChip.isVisible().catch(() => false)) {
      await fillersChip.click()
    } else {
      await page.getByRole('button', { name: 'Edit tools' }).click().catch(() => {})
      await page.getByRole('button', { name: 'Review bar' }).first().click()
    }
    await expect(page.getByTestId('script-filler-review-bar')).toBeVisible({ timeout: 30_000 })

    await page.getByTestId('filler-search-mode').click()
    await page.getByRole('option', { name: 'Shorten word gaps' }).click()
    await expect(page.getByTestId('filler-gap-target-sec')).toBeVisible()

    await page.getByTestId('filler-search-options').click()
    await expect(page.getByTestId('filler-search-options-panel')).toBeVisible()
    await page.getByText('Match case').click()

    await page.getByRole('button', { name: /Properties/i }).click().catch(() => {})
    await page.getByRole('button', { name: 'Manual' }).click()
    await expect(page.getByTestId('script-reframe-crop-box')).toBeVisible({ timeout: 15_000 })

    await expect(page.locator('[data-testid="timeline-cut-region"]').first()).toBeVisible({ timeout: 30_000 })

    const wordBtn = page.locator('button[data-word-idx]').first()
    await wordBtn.click({ button: 'right' })
    const sym = page.getByTestId('symmetric-trim-gap')
    if (await sym.isVisible().catch(() => false)) {
      await sym.click()
    }
  })

  test('M6: project entry, shortcuts sheet', async ({ page }) => {
    test.setTimeout(300_000)
    if (!process.env.ROOMS_E2E_STORAGE_STATE && !process.env.E2E_STORAGE_STATE) {
      test.skip(true, 'Set ROOMS_E2E_STORAGE_STATE')
    }

    await page.goto(`/app/clips/${PROJECT_ID}`, { waitUntil: 'networkidle', timeout: 180_000 })
    await page.evaluate(() => window.scrollTo(0, 400))
    await page.getByTestId('edit-transcript-project').click()
    await expect(page.locator('[data-script-shell]')).toBeVisible({ timeout: 120_000 })
    await page.getByTestId('script-back-to-project').click()
    await expect(page.getByTestId('edit-transcript-project')).toBeVisible({ timeout: 60_000 })
    const scrollY = await page.evaluate(() => window.scrollY)
    expect(scrollY).toBeGreaterThan(200)

    await page.goto(`/app/clips/${PROJECT_ID}/script`, { waitUntil: 'networkidle', timeout: 180_000 })
    await page.getByTestId('script-shortcuts-help').click()
    await expect(page.getByTestId('script-shortcuts-sheet')).toBeVisible()
    await expect(page.getByText('Split at playhead')).toBeVisible()
  })

  test('export output duration matches EDL (M5)', async ({ request }) => {
    test.setTimeout(600_000)
    if (process.env.SCRIPT_E2E_EXPORT !== '1') {
      test.skip(true, 'Set SCRIPT_E2E_EXPORT=1 to run export (owner only; ≤2 min fixture)')
    }
    if (!process.env.ROOMS_E2E_STORAGE_STATE && !process.env.E2E_STORAGE_STATE) {
      test.skip(true, 'Set ROOMS_E2E_STORAGE_STATE')
    }

    const bootRes = await request.get(`/api/clips/projects/${PROJECT_ID}/script/bootstrap`)
    expect(bootRes.ok()).toBeTruthy()
    const bootJson = await bootRes.json()
    const durationMs = bootJson.data?.durationMs as number
    expect(durationMs).toBeLessThanOrEqual(MAX_SOURCE_MS)
    const compositionId = bootJson.data?.compositionId as string
    expect(compositionId).toMatch(/^sc?cmp_/)

    const exportRes = await request.post(`/api/clips/compositions/${compositionId}/export/video`, {
      data: {
        exportKind: 'video',
        resolution: '720p',
        quality: 'low',
        burnCaptions: true,
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
      if (body.edlDurationMs != null) edlMs = body.edlDurationMs as number
      if (body.outputDurationMs != null) outMs = body.outputDurationMs as number
      if (edlMs != null) expect(edlMs).toBeLessThanOrEqual(MAX_SOURCE_MS)
      if (body.status === 'READY' && edlMs != null && outMs != null) break
      if (body.status === 'FAILED') {
        throw new Error(`export failed: ${body.error ?? JSON.stringify(body)}`)
      }
      await new Promise((r) => setTimeout(r, 5000))
    }
    expect(edlMs).toBeGreaterThan(0)
    expect(outMs).toBeGreaterThan(0)
    expect(Math.abs(outMs! - edlMs!)).toBeLessThan(1500)

    const poll = await request.get(`/api/clips/compositions/${compositionId}/export/${renderId}`)
    const finalBody = await poll.json()
    const downloadUrl = finalBody.downloadUrl as string | null
    expect(downloadUrl).toBeTruthy()

    const tmpDir = fs.mkdtempSync(path.join('/tmp', 'transovo-export-'))
    const mp4 = path.join(tmpDir, 'export.mp4')
    const dl = await request.get(downloadUrl!)
    expect(dl.ok()).toBeTruthy()
    fs.writeFileSync(mp4, Buffer.from(await dl.body()))

    const durSec = outMs! / 1000
    const cuts = [durSec * 0.12, durSec * 0.45, durSec * 0.78]
    const verifyScript = path.join(process.cwd(), 'scripts', 'e2e-verify-export-media.mjs')
    execFileSync(process.execPath, [verifyScript, mp4, ...cuts.map(String)], { stdio: 'inherit' })
  })
})
