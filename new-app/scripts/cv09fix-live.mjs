#!/usr/bin/env node
/** CV09fix live smoke — backdrop, chip click, fullscreen; leave Background None. */
import { chromium } from '../node_modules/playwright/index.mjs'

const URL =
  'https://transovo.ai/app/clips/proj_238c916d00774f0a9a024efbcfd7beea/edit/clip_2287e76553ab473e8b824e5337fee29d'
const CLIP_ID = 'clip_2287e76553ab473e8b824e5337fee29d'
const MERGE_SHA_PREFIX = process.env.CV09FIX_SHA?.slice(0, 7) || ''

const results = {}

async function waitSaved(page) {
  await page.getByText('Saved', { exact: false }).first().waitFor({ state: 'visible', timeout: 90_000 })
  await page.waitForTimeout(600)
}

async function readEditsCanvasBg(page) {
  return page.evaluate(async (clipId) => {
    const r = await fetch(`/api/clips/clips/${clipId}`)
    if (!r.ok) return { status: r.status, canvasBg: 'fetch_failed' }
    const j = await r.json()
    return { status: r.status, canvasBg: j?.edits?.canvasBg ?? null }
  }, CLIP_ID)
}

async function patchCanvasBg(page, canvasBg) {
  return page.evaluate(
    async ({ clipId, canvasBg }) => {
      const cur = await fetch(`/api/clips/clips/${clipId}`)
      if (!cur.ok) return { ok: false, status: cur.status }
      const clip = await cur.json()
      const edits = { ...(clip.edits || {}) }
      if (canvasBg == null) delete edits.canvasBg
      else edits.canvasBg = canvasBg
      const r = await fetch(`/api/clips/clips/${clipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edits }),
      })
      return { ok: r.ok, status: r.status }
    },
    { clipId: CLIP_ID, canvasBg },
  )
}

async function selectMainVideo(page) {
  const vid = page.locator('[data-testid="timeline-item-video"]').first()
  await vid.scrollIntoViewIfNeeded({ timeout: 30_000 })
  await vid.click()
  await page.waitForTimeout(500)
}

async function main() {
  if (MERGE_SHA_PREFIX) {
    for (let i = 0; i < 60; i++) {
      const h = await fetch('https://transovo.ai/api/health').then((r) => r.json())
      const sha = String(h.commitSha || '')
      if (sha.startsWith(MERGE_SHA_PREFIX)) {
        results.healthSha = sha
        break
      }
      if (i === 59) throw new Error(`health not on ${MERGE_SHA_PREFIX} (got ${h.commitSha})`)
      await new Promise((r) => setTimeout(r, 3000))
    }
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('[data-testid="timeline-root"]').waitFor({ timeout: 120_000 })
    await page.waitForTimeout(2000)

    await patchCanvasBg(page, { type: 'color', color: '#3B82F6' })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('[data-testid="timeline-root"]').waitFor({ timeout: 120_000 })
    await page.waitForTimeout(1500)

    await selectMainVideo(page)
    results.backdrop = await page.evaluate(() => {
      const kf = document.querySelector('[data-testid="preview-main-kf"]')
      const backdrop = document.querySelector('[data-testid="preview-canvas-backdrop"]')
      const adjust = document.querySelector('[data-testid="preview-adjust"]')
      if (!kf || !backdrop || !adjust) return { ok: false, kf: !!kf, backdrop: !!backdrop, adjust: !!adjust }
      const style = backdrop.getAttribute('style') || ''
      const colorOk =
        style.toUpperCase().includes('3B82F6') ||
        style.includes('rgb(59, 130, 246)') ||
        style.includes('59, 130, 246')
      return {
        ok: adjust.contains(backdrop) && !kf.contains(backdrop) && colorOk,
        outsideKf: !kf.contains(backdrop),
        inAdjust: adjust.contains(backdrop),
        style,
      }
    })

    await page.locator('[data-testid="preview-canvas-bg-chip"]').evaluate((el) => {
      el.click()
    })
    results.chipOpens = await page.locator('[data-testid="canvas-bg-controls"]').last().isVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')

    await page.locator('[data-testid="preview-fullscreen"]').click()
    await page.waitForTimeout(400)
    results.fullscreen = await page.evaluate(() => Boolean(document.fullscreenElement))
    if (results.fullscreen) {
      await page.evaluate(() => document.exitFullscreen?.())
      await page.waitForTimeout(300)
    }

    results.cleanup = await patchCanvasBg(page, null)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('[data-testid="timeline-root"]').waitFor({ timeout: 120_000 })
    const final = await readEditsCanvasBg(page)
    results.finalCanvasBg = final.canvasBg

    results.PASS = Boolean(
      results.backdrop?.ok &&
        results.chipOpens &&
        results.fullscreen &&
        results.cleanup?.ok &&
        final.canvasBg == null,
    )
  } catch (e) {
    results.error = e instanceof Error ? e.message : String(e)
    results.PASS = false
    try {
      await patchCanvasBg(page, null)
    } catch {
      /* best effort */
    }
  } finally {
    await browser.close()
  }
  console.log(JSON.stringify(results, null, 2))
  process.exit(results.PASS ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
