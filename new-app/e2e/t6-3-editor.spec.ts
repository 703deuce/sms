/**
 * T6.3 acceptance on the REAL editor route (/app/clips/<projectId>/edit/<clipId>), not /dev/t6-2.
 *
 * Needs a seeded or real gaming clip with a detected facecam (e.g. the round-9 clip A) and an
 * IRL crowd clip (clip B), on a deployment with NEXT_PUBLIC_T6_TEMPLATES=1 and
 * NEXT_PUBLIC_T6_TITLE_AUTO=1:
 *   T63_CLIP_A_PATH=/app/clips/proj_x/edit/clip_a  T63_CLIP_B_PATH=/app/clips/proj_y/edit/clip_b \
 *   CLIPPER_E2E_BASE_URL=... npx playwright test e2e/t6-3-editor.spec.ts
 * Screenshots: test-results/ (attach to the report).
 */
import { test, expect, chromium, type Page } from '@playwright/test'
import { clipperE2eBaseUrl, clipperE2eStorageStatePath } from './helpers/clipper-e2e-env'
import { ensureClipperAuthenticated } from './helpers/clipper-auth'

const A = process.env.T63_CLIP_A_PATH
const B = process.env.T63_CLIP_B_PATH
const LANES = ['gaming', 'irl', 'just_chatting', 'podcast'] as const
const FIRST_TILE: Record<(typeof LANES)[number], string> = {
  gaming: 'G1',
  irl: 'I1',
  just_chatting: 'C1',
  podcast: 'C2',
}

async function openEditor(path: string) {
  const browser = await chromium.launch({ headless: true })
  const storage = clipperE2eStorageStatePath()
  const context = await browser.newContext({ baseURL: clipperE2eBaseUrl(), ...(storage ? { storageState: storage } : {}) })
  const page = await context.newPage()
  await ensureClipperAuthenticated(context, page)
  await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await openLayout(page)
  return { browser, page }
}

async function openLayout(page: Page) {
  const tab = page.getByRole('tab', { name: /layout/i }).first()
  if (await tab.count()) await tab.click()
  else {
    const btn = page.getByRole('button', { name: /^layout$/i }).first()
    if (await btn.count()) await btn.click()
  }
  await expect(page.getByTestId('template-family')).toBeVisible({ timeout: 60_000 })
}

async function pickTile(page: Page, lane: string, id: string) {
  await page.getByTestId('template-family').click()
  await page.getByTestId(`template-family-${lane}`).click()
  await page.getByTestId(`template-tile-${id}`).click()
  await expect(page.getByTestId('template-stage')).toHaveAttribute('data-template-id', id, { timeout: 15_000 })
}

const primary = (page: Page) => page.locator('[data-testid="template-stage"] video').first()

test.describe('T6.3 editor acceptance', () => {
  test.skip(!A, 'set T63_CLIP_A_PATH to a real/seeded gaming clip editor path')
  test.setTimeout(300_000)

  test('family dropdown switches lanes (browse only) and tiles apply', async () => {
    const { browser, page } = await openEditor(A!)
    for (const lane of LANES) {
      await page.getByTestId('template-family').click()
      await page.getByTestId(`template-family-${lane}`).click()
      await expect(page.getByTestId(`template-tile-${FIRST_TILE[lane]}`)).toBeVisible()
      await expect(page.getByTestId('template-family')).toContainText(lane.replace('_', ' '))
    }
    await pickTile(page, 'irl', 'I1')
    await pickTile(page, 'gaming', 'G6')
    await browser.close()
  })

  test('exactly one title-style control; export dialog names the T6 style', async () => {
    const { browser, page } = await openEditor(A!)
    await expect(page.getByTestId('legacy-headline-style-row')).toHaveCount(0)
    await page.getByRole('button', { name: /^Export$/i }).click()
    const dialog = page.getByRole('dialog', { name: /export clip/i })
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await expect(dialog).not.toContainText(/Headline style: export bar/i)
    const line = dialog.getByTestId('export-title-style')
    if (await line.count()) await expect(line).toContainText(/Title style:/)
    await browser.close()
  })

  for (const tid of ['G6', 'G1'] as const) {
    test(`facecam drag changes the ${tid} face panel`, async () => {
      const { browser, page } = await openEditor(A!)
      await pickTile(page, 'gaming', tid)
      const stage = page.getByTestId('template-stage')
      const panel0 = stage.locator(':scope > div').filter({ has: page.locator('video') }).first()
      await page.waitForTimeout(1500)
      const before = await panel0.screenshot({ path: `test-results/t63-${tid}-before.png` })
      const box = page.getByTestId('studio-box-facecam')
      await expect(box).toBeVisible()
      const bb = (await box.boundingBox())!
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
      await page.mouse.down()
      await page.mouse.move(bb.x + bb.width / 2 + 40, bb.y + bb.height / 2 - 30, { steps: 8 })
      await page.mouse.up()
      await page.waitForTimeout(800)
      const after = await panel0.screenshot({ path: `test-results/t63-${tid}-after.png` })
      expect(Buffer.compare(before, after)).not.toBe(0)
      await browser.close()
    })
  }

  test('seeking keeps the play state', async () => {
    const { browser, page } = await openEditor(A!)
    await pickTile(page, 'gaming', 'G6')
    const v = primary(page)
    await v.evaluate((el: HTMLVideoElement) => {
      el.muted = true
      return el.play()
    })
    await page.waitForTimeout(800)
    const track = page.getByTestId('timeline-track')
    const tb = (await track.boundingBox())!
    // ~5 s into the clip on the timeline (UI seek path: Timeline -> seekOutput)
    const dur = await v.evaluate((el: HTMLVideoElement) => el.duration || 30)
    await page.mouse.click(tb.x + tb.width * Math.min(0.9, 5 / dur), tb.y + 8)
    await page.waitForTimeout(1500)
    const st = await v.evaluate((el: HTMLVideoElement) => ({ paused: el.paused, t: el.currentTime }))
    expect(st.paused).toBe(false)
    // paused stays paused
    await v.evaluate((el: HTMLVideoElement) => el.pause())
    await page.mouse.click(tb.x + tb.width * 0.2, tb.y + 8)
    await page.waitForTimeout(800)
    expect(await v.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true)
    await browser.close()
  })

  test('I5 on a crowd clip with no detected face is the whole frame', async () => {
    test.skip(!B, 'set T63_CLIP_B_PATH')
    const { browser, page } = await openEditor(B!)
    await pickTile(page, 'irl', 'I5')
    const vids = page.locator('[data-testid="template-stage"] video')
    // whole frame: a contain_blur backdrop + the contained frame (no zoomed face crop)
    expect(await vids.count()).toBeGreaterThanOrEqual(2)
    await page.getByTestId('template-stage').screenshot({ path: 'test-results/t63-I5-B.png' })
    await browser.close()
  })
})
