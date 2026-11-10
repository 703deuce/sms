/**
 * E3 keyframes + transitions acceptance on the REAL editor route (/app/video-editor/<projectId>/edit/<clipId>).
 *
 * Use a DISPOSABLE clip with >= 1 transcript cut (so the Video lane has a cut point) and >= 1 B-roll
 * item. Each test undoes what it changes; a failed run can leave keyframes/transitions behind
 * (Edit -> undo, or clear `keyframes` / `transitions` in clip_edits).
 *   E3_CLIP_PATH=/app/video-editor/proj_x/edit/clip_y CLIPPER_E2E_BASE_URL=... npx playwright test e2e/e3-motion.spec.ts
 * Screenshots go to test-results/ (attach them to the report).
 */
import { test, expect, chromium, type Page, type Locator } from '@playwright/test'
import { clipperE2eBaseUrl, clipperE2eStorageStatePath } from './helpers/clipper-e2e-env'
import { ensureClipperAuthenticated } from './helpers/clipper-auth'

const CLIP = process.env.E3_CLIP_PATH || process.env.E2_CLIP_PATH

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
  await page.getByTestId('timeline-zoom-fit').click()
  return { browser, page }
}

const num = async (loc: Locator, attr: string) => Number(await loc.getAttribute(attr))
const undoBtn = (page: Page) => page.getByTestId('timeline-toolbar').getByRole('button', { name: 'Undo', exact: true })

async function clickItem(page: Page, loc: Locator) {
  const box = (await loc.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.up()
}

/** Seek the playhead to an output-time ms (ruler spans the whole track after zoom-fit). */
async function seekTo(page: Page, ms: number) {
  const dur = await num(page.getByTestId('timeline-track'), 'data-duration-ms')
  const ruler = (await page.getByTestId('timeline-ruler').boundingBox())!
  await page.mouse.click(ruler.x + (ruler.width * Math.min(Math.max(ms, 0), dur - 1)) / dur, ruler.y + ruler.height / 2)
  await page.waitForTimeout(500) // the playhead comes back from the <video> seek
}

/** Current scale factor of the Video-lane keyframe layer (1 when no transform). */
const mainScale = (page: Page) =>
  page.getByTestId('preview-main-kf').evaluate((el: HTMLElement) => {
    const t = getComputedStyle(el).transform
    if (!t || t === 'none') return 1
    const m = t.match(/matrix\(([^)]+)\)/)
    if (!m) return 1
    const [a, b] = m[1]!.split(',').map(Number)
    return Math.hypot(a!, b!)
  })

test.describe('E3 keyframes + transitions', () => {
  test.skip(!CLIP, 'set E3_CLIP_PATH (or E2_CLIP_PATH) to a disposable clip editor path')
  test.setTimeout(300_000)

  test('Video keyframes: ◇ adds, editing auto-keys, preview interpolates, diamond drag/Delete, undo', async () => {
    const { browser, page } = await openEditor(CLIP!)
    const dur = await num(page.getByTestId('timeline-track'), 'data-duration-ms')
    const v0 = page.getByTestId('timeline-item-video').first()
    const t1 = Math.round((await num(v0, 'data-start-ms')) + 300)
    const t2 = Math.min(t1 + 1500, Math.round((await num(v0, 'data-end-ms')) - 100), dur - 200)
    await seekTo(page, t1)
    await clickItem(page, v0)
    const insp = page.getByTestId('keyframe-inspector')
    await expect(insp).toBeVisible()
    await expect(insp).toHaveAttribute('data-target', 'video')
    const diamonds = page.locator('[data-testid="timeline-keyframe"][data-target="video"]')
    const n0 = await diamonds.count()

    await page.getByTestId('kf-toggle-scale').click()
    await expect(diamonds).toHaveCount(n0 + 1)
    await expect(page.getByTestId('kf-toggle-scale')).toHaveAttribute('data-active', 'true')
    await seekTo(page, t2)
    await clickItem(page, v0) // keep the item selected after the ruler click
    await page.getByTestId('kf-value-scale').fill('150')
    await page.getByTestId('kf-value-scale').press('Enter')
    await expect(diamonds).toHaveCount(n0 + 2) // auto-key (CapCut: editing with a track adds a key)

    // Preview interpolates: halfway between the keys ≈ 125 %, at the 2nd key 150 %.
    await expect.poll(() => mainScale(page)).toBeGreaterThan(1.45)
    await seekTo(page, (t1 + t2) / 2)
    const mid = await mainScale(page)
    expect(mid).toBeGreaterThan(1.1)
    expect(mid).toBeLessThan(1.4)
    await page.screenshot({ path: 'test-results/e3-keyframes.png', fullPage: true })

    // Ease on the left key changes the midpoint value (ease-in → slower start).
    await clickItem(page, v0)
    await page.getByTestId('kf-prev-scale').click() // seek exactly onto the first key
    await expect(page.getByTestId('kf-toggle-scale')).toHaveAttribute('data-active', 'true')
    await page.getByTestId('kf-ease-scale-in').click()
    await seekTo(page, (t1 + t2) / 2)
    expect(await mainScale(page)).toBeLessThan(mid)

    // Diamond: click selects (+ seeks), Delete removes the key only (not the clip segment).
    const nVideo = await page.getByTestId('timeline-item-video').count()
    const last = diamonds.last()
    await clickItem(page, last)
    await expect(last).toHaveAttribute('data-selected', 'true')
    await page.keyboard.press('Delete')
    await expect(diamonds).toHaveCount(n0 + 1)
    await expect(page.getByTestId('timeline-item-video')).toHaveCount(nVideo)

    for (let i = 0; i < 4; i++) await undoBtn(page).click() // delete, ease, auto-key, ◇
    await expect(diamonds).toHaveCount(n0)
    await browser.close()
  })

  test('Cut transition: pop-over on the cut, preview window renders, duration, persists after reload', async () => {
    const { browser, page } = await openEditor(CLIP!)
    const handles = page.getByTestId('timeline-transition-handle')
    test.skip((await handles.count()) === 0, 'clip has no cut on the Video lane')
    const h = handles.first()
    const srcMs = (await h.getAttribute('data-src-ms'))!
    const sel = page.locator(`[data-testid="timeline-transition-handle"][data-src-ms="${srcMs}"]`)
    const typeBefore = await sel.getAttribute('data-type')
    test.skip(Boolean(typeBefore), 'first cut already has a transition — use a clean clip')

    await sel.click()
    await expect(page.getByTestId('transition-popover')).toBeVisible()
    for (const t of ['crossfade', 'dip_black', 'dip_white', 'push_left', 'push_right', 'push_up', 'push_down', 'wipe_left', 'zoom_in', 'zoom_out', 'blur'])
      await expect(page.getByTestId(`transition-tile-${t}`)).toBeVisible()
    await page.getByTestId('transition-tile-dip_black').click()
    await expect(sel).toHaveAttribute('data-type', 'dip_black')
    const region = page.locator(`[data-testid="timeline-transition-region"][data-src-ms="${srcMs}"]`)
    await expect(region).toBeVisible()
    await expect(page.getByTestId('transition-duration-label')).toHaveText(/0\.4/)

    // ± steps commit once each (one undo step); the slider commits on release.
    await page.getByTestId('transition-duration-inc').click()
    await expect(page.getByTestId('transition-duration-label')).toHaveText(/0\.5/)
    await page.keyboard.press('Escape')

    // Preview: at the cut (window centre) the dip colour is over the picture.
    const rb = (await region.boundingBox())!
    const ruler = (await page.getByTestId('timeline-ruler').boundingBox())!
    await page.mouse.click(rb.x + rb.width / 2, ruler.y + ruler.height / 2)
    await page.waitForTimeout(700)
    await expect
      .poll(() => page.getByTestId('preview-transition-color').evaluate((el: HTMLElement) => Number(getComputedStyle(el).opacity)))
      .toBeGreaterThan(0.8)
    await page.screenshot({ path: 'test-results/e3-cut-dip.png', fullPage: true })

    // Persisted: reload and the handle still carries the transition.
    await page.waitForTimeout(3000) // autosave debounce
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('timeline-root')).toBeVisible({ timeout: 60_000 })
    await expect(sel).toHaveAttribute('data-type', 'dip_black', { timeout: 30_000 })

    // Push looks like a two-clip move: both clones are visible mid-window.
    await sel.click()
    await page.getByTestId('transition-tile-push_left').click()
    await page.keyboard.press('Escape')
    await page.mouse.click(rb.x + rb.width / 2, ruler.y + ruler.height / 2)
    await page.waitForTimeout(700)
    await expect(page.getByTestId('preview-transition-a')).toBeVisible()
    await expect(page.getByTestId('preview-transition-b')).toBeVisible()
    await page.screenshot({ path: 'test-results/e3-cut-push.png', fullPage: true })

    // Remove → plain cut again.
    await sel.click()
    await page.getByTestId('transition-remove').click()
    await expect(sel).not.toHaveAttribute('data-type', /.+/)
    await expect(region).toHaveCount(0)
    await page.waitForTimeout(3000)
    await browser.close()
  })

  test('B-roll: in-transition via the edge button, keyframe on the item, undo', async () => {
    const { browser, page } = await openEditor(CLIP!)
    const items = page.getByTestId('timeline-item-broll')
    test.skip((await items.count()) === 0, 'clip has no B-roll item')
    const item = items.first()
    const id = (await item.getAttribute('data-item-id'))!
    const sel = page.locator(`[data-testid="timeline-item-broll"][data-item-id="${id}"]`)
    const btnIn = sel.getByTestId('timeline-broll-transition-in')
    await btnIn.click()
    await page.getByTestId('transition-tile-crossfade').click()
    await expect(btnIn).toHaveAttribute('data-type', 'crossfade')
    await expect(page.getByTestId('timeline-broll-transition-region').first()).toBeVisible()
    await page.keyboard.press('Escape')

    const s = await num(sel, 'data-start-ms')
    await seekTo(page, s + 600)
    await clickItem(page, sel)
    await expect(page.getByTestId('keyframe-inspector')).toHaveAttribute('data-target', `broll:${id}`)
    await page.getByTestId('kf-toggle-opacity').click()
    await expect(sel.getByTestId('timeline-keyframe')).toHaveCount(1)
    await page.screenshot({ path: 'test-results/e3-broll.png', fullPage: true })
    await undoBtn(page).click()
    await undoBtn(page).click()
    await expect(sel.getByTestId('timeline-keyframe')).toHaveCount(0)
    await expect(btnIn).not.toHaveAttribute('data-type', /.+/)
    await browser.close()
  })

  test('Voice volume keyframe lowers the main video volume in the preview', async () => {
    const { browser, page } = await openEditor(CLIP!)
    const voice = page.getByTestId('timeline-item-voice').first()
    test.skip((await voice.count()) === 0, 'clip has no voice item')
    const s = await num(voice, 'data-start-ms')
    await seekTo(page, s + 400)
    await clickItem(page, voice)
    await expect(page.getByTestId('keyframe-inspector')).toHaveAttribute('data-target', 'voice')
    await page.getByTestId('kf-value-volume').fill('20')
    await page.getByTestId('kf-value-volume').press('Enter')
    await expect(page.getByTestId('kf-value-volume')).toHaveValue('20')
    await page.screenshot({ path: 'test-results/e3-voice-volume.png', fullPage: true })
    await undoBtn(page).click()
    await expect(page.getByTestId('kf-value-volume')).toHaveValue('100')
    await browser.close()
  })
})
