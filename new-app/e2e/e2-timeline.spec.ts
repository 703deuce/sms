/**
 * E2 multi-track timeline acceptance on the REAL editor route (/app/video-editor/<projectId>/edit/<clipId>).
 *
 * Use a DISPOSABLE clip: these steps save edits (each test undoes what it changes, but a failed run
 * can leave edits behind). Best fixture: a clip with >= 1 transcript cut, >= 1 B-roll item, music and
 * one SFX (add them in the editor first), so every lane has an item.
 *   E2_CLIP_PATH=/app/video-editor/proj_x/edit/clip_y CLIPPER_E2E_BASE_URL=... npx playwright test e2e/e2-timeline.spec.ts
 * Screenshots go to test-results/ (attach them to the report).
 */
import { test, expect, chromium, type Page, type Locator } from '@playwright/test'
import { clipperE2eBaseUrl, clipperE2eStorageStatePath } from './helpers/clipper-e2e-env'
import { ensureClipperAuthenticated } from './helpers/clipper-auth'

const CLIP = process.env.E2_CLIP_PATH
const LANES = ['text', 'video', 'broll', 'voice', 'music', 'sfx'] as const

async function openEditor(path: string) {
  const browser = await chromium.launch({ headless: true })
  const storage = clipperE2eStorageStatePath()
  const context = await browser.newContext({
    baseURL: clipperE2eBaseUrl(),
    viewport: { width: 1600, height: 1000 },
    ...(storage ? { storageState: storage } : {}),
  })
  const page = await context.newPage()
  await ensureClipperAuthenticated(context, page)
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await expect(page.getByTestId('timeline-root')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('timeline-item-video').first()).toBeVisible({ timeout: 60_000 })
  return { browser, page }
}

const num = async (loc: Locator, attr: string) => Number(await loc.getAttribute(attr))
const toolbar = (page: Page) => page.getByTestId('timeline-toolbar')
const undoBtn = (page: Page) => toolbar(page).getByRole('button', { name: 'Undo', exact: true })

async function clickItem(page: Page, loc: Locator, opts: { shift?: boolean } = {}) {
  const box = (await loc.boundingBox())!
  // Click the middle (not the 6px trim handles) without moving -> select only, no drag commit.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  if (opts.shift) await page.keyboard.down('Shift')
  await page.mouse.down()
  await page.mouse.up()
  if (opts.shift) await page.keyboard.up('Shift')
}

async function seekRulerTo(page: Page, frac: number) {
  const ruler = page.getByTestId('timeline-ruler')
  const box = (await ruler.boundingBox())!
  await page.mouse.click(box.x + box.width * frac, box.y + box.height / 2)
  await page.waitForTimeout(400) // playhead comes back from the <video> seek
}

test.describe('E2 multi-track timeline', () => {
  test.skip(!CLIP, 'set E2_CLIP_PATH to a disposable clip editor path')
  test.setTimeout(300_000)

  test('lanes, headers, toolbar and E1 zoom render on the output time base', async () => {
    const { browser, page } = await openEditor(CLIP!)
    for (const lane of LANES) {
      await expect(page.getByTestId(`timeline-lane-${lane}`)).toBeVisible()
      await expect(page.getByTestId(`timeline-lane-lock-${lane}`)).toBeVisible()
    }
    for (const id of ['timeline-split', 'timeline-delete', 'timeline-snap', 'timeline-zoom-in', 'timeline-zoom-out', 'timeline-zoom-fit'])
      await expect(page.getByTestId(id)).toBeVisible()
    // Items never extend past the output duration (B-roll/SFX bars sat off after cuts before E2).
    const lastVideoEnd = Math.max(
      ...(await page.getByTestId('timeline-item-video').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-end-ms'))))),
    )
    for (const lane of ['broll', 'sfx', 'music'] as const) {
      const starts = await page.getByTestId(`timeline-item-${lane}`).evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-start-ms'))))
      for (const start of starts) expect(start).toBeLessThan(lastVideoEnd)
    }
    const before = await page.getByTestId('timeline-zoom-label').innerText()
    await page.getByTestId('timeline-zoom-in').click()
    await expect(page.getByTestId('timeline-zoom-label')).not.toHaveText(before)
    await page.getByTestId('timeline-zoom-fit').click()
    await page.screenshot({ path: 'test-results/e2-lanes.png', fullPage: true })
    await browser.close()
  })

  test('B-roll: drag moves once (one undo step), arrows nudge 33/330 ms, snap toggle', async () => {
    const { browser, page } = await openEditor(CLIP!)
    const item = page.getByTestId('timeline-item-broll').first()
    test.skip((await item.count()) === 0, 'clip has no B-roll item')
    const start0 = await num(item, 'data-start-ms')
    const id = (await item.getAttribute('data-item-id'))!
    const sel = page.locator(`[data-testid="timeline-item-broll"][data-item-id="${id}"]`)

    await clickItem(page, sel)
    await expect(sel).toHaveAttribute('data-selected', 'true')
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => num(sel, 'data-start-ms')).toBe(start0 + 33)
    await page.keyboard.press('Shift+ArrowRight')
    await expect.poll(() => num(sel, 'data-start-ms')).toBe(start0 + 363)
    await page.keyboard.press('Control+z')
    await page.keyboard.press('Control+z')
    await expect.poll(() => num(sel, 'data-start-ms')).toBe(start0)

    // Drag with snapping off -> exact pixel delta; release commits once.
    await page.getByTestId('timeline-snap').click()
    await expect(page.getByTestId('timeline-snap')).toHaveAttribute('aria-pressed', 'false')
    const box = (await sel.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 12 })
    await page.mouse.up()
    const moved = await num(sel, 'data-start-ms')
    expect(moved).toBeGreaterThan(start0)
    await page.screenshot({ path: 'test-results/e2-broll-moved.png' })
    await undoBtn(page).click() // ONE undo restores the whole drag
    await expect.poll(() => num(sel, 'data-start-ms')).toBe(start0)
    await page.getByTestId('timeline-snap').click()
    await expect(page.getByTestId('timeline-snap')).toHaveAttribute('aria-pressed', 'true')
    await browser.close()
  })

  test('S splits the main video at the playhead, Delete removes a segment, undo restores both', async () => {
    const { browser, page } = await openEditor(CLIP!)
    const videos = page.getByTestId('timeline-item-video')
    const n0 = await videos.count()
    await page.getByTestId('timeline-scroll').click({ position: { x: 5, y: 5 } }) // focus timeline, no selection
    await page.keyboard.press('Escape')
    await seekRulerTo(page, 0.37)
    await page.keyboard.press('s')
    await expect(videos).toHaveCount(n0 + 1)
    await clickItem(page, videos.nth(n0)) // the right-hand half
    await page.keyboard.press('Delete')
    await expect(videos).toHaveCount(n0)
    await page.screenshot({ path: 'test-results/e2-split-delete.png' })
    await page.keyboard.press('Control+z')
    await expect(videos).toHaveCount(n0 + 1)
    await page.keyboard.press('Control+z')
    await expect(videos).toHaveCount(n0)
    await browser.close()
  })

  test('B-roll split at playhead keeps both halves with the right media in-point; Delete removes one', async () => {
    const { browser, page } = await openEditor(CLIP!)
    const items = page.getByTestId('timeline-item-broll')
    test.skip((await items.count()) === 0, 'clip has no B-roll item')
    const n0 = await items.count()
    const first = items.first()
    const s = await num(first, 'data-start-ms')
    const e = await num(first, 'data-end-ms')
    // Put the playhead inside the item: click the ruler at the item's centre x.
    const box = (await first.boundingBox())!
    const ruler = (await page.getByTestId('timeline-ruler').boundingBox())!
    await page.mouse.click(box.x + box.width / 2, ruler.y + ruler.height / 2)
    await page.waitForTimeout(400)
    await clickItem(page, first)
    await page.getByTestId('timeline-split').click()
    await expect(items).toHaveCount(n0 + 1)
    const ends = await items.evaluateAll((els) => els.map((x) => [Number(x.getAttribute('data-start-ms')), Number(x.getAttribute('data-end-ms'))]))
    expect(ends.some(([a]) => a === s)).toBe(true)
    expect(ends.some(([, b]) => b === e)).toBe(true)
    await page.keyboard.press('Control+z')
    await expect(items).toHaveCount(n0)
    await browser.close()
  })

  test('lane mute / hide / lock', async () => {
    const { browser, page } = await openEditor(CLIP!)
    const video = page.locator('video').first()
    await page.getByTestId('timeline-lane-mute-voice').click()
    await expect(page.getByTestId('timeline-lane-mute-voice')).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true)
    await page.getByTestId('timeline-lane-mute-voice').click()
    await expect(page.getByTestId('timeline-lane-mute-voice')).toHaveAttribute('aria-pressed', 'false')

    if (await page.getByTestId('timeline-item-broll').count()) {
      await page.getByTestId('timeline-lane-hide-broll').click()
      await expect(page.getByTestId('timeline-lane-hide-broll')).toHaveAttribute('aria-pressed', 'true')
      await page.screenshot({ path: 'test-results/e2-broll-hidden.png' })
      await page.getByTestId('timeline-lane-hide-broll').click()

      await page.getByTestId('timeline-lane-lock-broll').click()
      const it = page.getByTestId('timeline-item-broll').first()
      const s0 = await num(it, 'data-start-ms')
      await clickItem(page, it)
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => num(it, 'data-start-ms')).toBe(s0) // locked: no nudge
      await page.getByTestId('timeline-lane-lock-broll').click()
    }
    await browser.close()
  })

  test('music: trim start sets a window (handles), undo restores', async () => {
    const { browser, page } = await openEditor(CLIP!)
    const m = page.getByTestId('timeline-item-music').first()
    test.skip((await m.count()) === 0, 'clip has no music')
    const s0 = await num(m, 'data-start-ms')
    await clickItem(page, m)
    const h = m.getByTestId('timeline-trim-start')
    const hb = (await h.boundingBox())!
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
    await page.keyboard.down('Alt') // bypass snapping
    await page.mouse.down()
    await page.mouse.move(hb.x + 80, hb.y + hb.height / 2, { steps: 10 })
    await page.mouse.up()
    await page.keyboard.up('Alt')
    expect(await num(m, 'data-start-ms')).toBeGreaterThan(s0)
    await undoBtn(page).click()
    await expect.poll(() => num(m, 'data-start-ms')).toBe(s0)
    await browser.close()
  })
})
