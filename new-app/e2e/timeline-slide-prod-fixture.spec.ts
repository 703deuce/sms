/**
 * Slide drag on clip_5f19e510 fixture (local dev server).
 *
 *   pnpm dev --port 3000
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 node ./node_modules/@playwright/test/cli.js test e2e/timeline-slide-prod-fixture.spec.ts --config=playwright.prod.config.ts
 */
import { test, expect, chromium, type Page, type Locator } from '@playwright/test'

const base = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL

async function pointerDrag(page: Page, el: Locator, dxPx: number) {
  const box = (await el.boundingBox())!
  const x0 = box.x + box.width / 2
  const y0 = box.y + box.height / 2
  await el.dispatchEvent('pointerdown', { button: 0, clientX: x0, clientY: y0, pointerId: 1, bubbles: true })
  await page.dispatchEvent('body', 'pointermove', {
    clientX: x0 + dxPx,
    clientY: y0,
    pointerId: 1,
    bubbles: true,
  })
  await page.dispatchEvent('body', 'pointerup', { clientX: x0 + dxPx, clientY: y0, pointerId: 1, bubbles: true })
}

test.describe('timeline slide prod fixture page', () => {
  test.skip(!base?.includes('localhost') && !base?.includes('127.0.0.1'), 'local dev server only')

  test('drag middle clip +300ms updates split and cut range', async () => {
    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
    await page.goto(`${base}/app/test/slide`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(page.getByTestId('slide-test-page')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('timeline-root')).toBeVisible()
    const videos = page.getByTestId('timeline-item-video')
    await expect(videos).toHaveCount(3)
    await page.getByTestId('timeline-scroll').click({ position: { x: 8, y: 8 } })
    await page.keyboard.press('u')
    const mid = videos.nth(1)
    const track = page.getByTestId('timeline-track')
    const dur = Number(await track.getAttribute('data-duration-ms'))
    const width = await track.evaluate((el) => parseFloat(el.style.width))
    const pxPerMs = width / dur
    await pointerDrag(page, mid, 300 * pxPerMs)
    await expect(page.getByTestId('slide-fixture-state')).toHaveAttribute('data-video-splits', '[4941]', {
      timeout: 10_000,
    })
    await expect(page.getByTestId('slide-fixture-state')).toHaveAttribute(
      'data-cut-ranges',
      '[[29515,29995]]',
    )
    await browser.close()
  })
})
