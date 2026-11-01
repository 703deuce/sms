#!/usr/bin/env node
/** CV09fix2 live — preview select, chip in frame, Image tab, Escape deselect; leave Background None. */
import { chromium } from '../node_modules/playwright/index.mjs'

const URL =
  'https://transovo.ai/app/clips/proj_238c916d00774f0a9a024efbcfd7beea/edit/clip_2287e76553ab473e8b824e5337fee29d'
const CLIP_ID = 'clip_2287e76553ab473e8b824e5337fee29d'
const SHA_PREFIX = process.env.CV09FIX2_SHA?.slice(0, 7) || ''

const results = {}

async function patchCanvasBg(page, canvasBg) {
  return page.evaluate(
    async ({ clipId, canvasBg }) => {
      const cur = await fetch(`/api/clips/clips/${clipId}`)
      if (!cur.ok) return { ok: false }
      const clip = await cur.json()
      const edits = { ...(clip.edits || {}) }
      if (canvasBg == null) delete edits.canvasBg
      else edits.canvasBg = canvasBg
      const r = await fetch(`/api/clips/clips/${clipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edits }),
      })
      return { ok: r.ok }
    },
    { clipId: CLIP_ID, canvasBg },
  )
}

async function main() {
  if (SHA_PREFIX) {
    for (let i = 0; i < 60; i++) {
      const h = await fetch('https://transovo.ai/api/health').then((r) => r.json())
      const sha = String(h.commitSha || '')
      if (sha.startsWith(SHA_PREFIX)) {
        results.healthSha = sha
        break
      }
      if (i === 59) throw new Error(`health not on ${SHA_PREFIX} (got ${h.commitSha})`)
      await new Promise((r) => setTimeout(r, 3000))
    }
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.locator('[data-testid="timeline-root"]').waitFor({ timeout: 120_000 })
    await page.waitForTimeout(1500)

    const frame = page.locator('[data-testid="preview-main-layer"]').first()
    await frame.click({ position: { x: 40, y: 40 } })
    await page.waitForTimeout(600)

    results.selectionVisible = await page.locator('[data-testid="canvas-selection-box"]').isVisible()

    const chipBox = await page.locator('[data-testid="preview-canvas-bg-chip"]').boundingBox()
    const frameBox = await page.evaluate(() => {
      const row = document.querySelector('[data-testid="preview-chip-row"]')
      const frame = row?.parentElement
      return frame ? frame.getBoundingClientRect() : null
    })
    results.chipInFrame =
      chipBox &&
      frameBox &&
      chipBox.x >= frameBox.x + 8 &&
      chipBox.x + chipBox.width <= frameBox.x + frameBox.width - 8

    await page.locator('[data-testid="preview-canvas-bg-chip"]').click()
    results.chipOpens = await page.locator('[data-testid="canvas-bg-controls"]').last().isVisible({ timeout: 8000 })
    results.labelNone = (await page.locator('[data-testid="preview-canvas-bg-chip"]').innerText()).includes('None')
    await page.getByRole('button', { name: 'Color', exact: true }).click()
    await page.waitForTimeout(400)
    results.labelColor = (await page.locator('[data-testid="preview-canvas-bg-chip"]').innerText()).match(/Color/i)

    await page.getByRole('button', { name: 'Image', exact: true }).click()
    results.imageUploadTile = await page.getByRole('button', { name: /upload/i }).isVisible()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    results.selectionCleared = !(await page.locator('[data-testid="canvas-selection-box"]').isVisible().catch(() => false))

    results.cleanup = await patchCanvasBg(page, null)

    results.PASS = Boolean(
      results.chipInFrame &&
        results.chipOpens &&
        results.labelNone &&
        results.labelColor &&
        results.imageUploadTile &&
        results.selectionCleared &&
        results.cleanup?.ok,
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
