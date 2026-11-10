/**
 * Legacy MC slide against a live clip path. Prefer local fixture e2e:
 *   e2e/timeline-slide-prod-fixture.spec.ts (clip_5f19e510: split @4641, cut @29215–29695).
 *
 *   SLIDE_MC_CLIP_PATH=/app/video-editor/<project>/edit/<clip> … e2e/timeline-slide-mc.spec.ts
 */
import { test, expect, chromium } from '@playwright/test'
import { clipperE2eBaseUrl, clipperE2eStorageStatePath } from './helpers/clipper-e2e-env'
import { ensureClipperAuthenticated } from './helpers/clipper-auth'

const CLIP = process.env.SLIDE_MC_CLIP_PATH

test.describe('timeline slide MC fixture', () => {
  test.skip(!CLIP, 'set SLIDE_MC_CLIP_PATH to a clip with videoSplits [4640,29210]')

  test('slide middle clip +300ms updates splits', async () => {
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      baseURL: clipperE2eBaseUrl(),
      viewport: { width: 1600, height: 1000 },
      ...(clipperE2eStorageStatePath() ? { storageState: clipperE2eStorageStatePath() } : {}),
    })
    const page = await context.newPage()
    await ensureClipperAuthenticated(context, page)
    await page.goto(CLIP!, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await expect(page.getByTestId('timeline-root')).toBeVisible({ timeout: 60_000 })
    const videos = page.getByTestId('timeline-item-video')
    await expect(videos).toHaveCount(3, { timeout: 30_000 })
    await page.keyboard.press('u')
    const mid = videos.nth(1)
    const box = (await mid.boundingBox())!
    const track = await page.getByTestId('timeline-track').getAttribute('data-duration-ms')
    const dur = Number(track)
    const pxPerMs = (await page.getByTestId('timeline-track').evaluate((el) => parseFloat(el.style.width))) / dur
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 300 * pxPerMs, box.y + box.height / 2)
    await page.mouse.up()
    await page.waitForTimeout(500)
    await browser.close()
  })
})
