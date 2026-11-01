#!/usr/bin/env node
/** CV-17a live — main video mask + chroma key; leave no layerFx, Background None, 3 clips. */
import { chromium } from '../node_modules/playwright/index.mjs'

const URL =
  'https://transovo.ai/app/clips/proj_238c916d00774f0a9a024efbcfd7beea/edit/clip_2287e76553ab473e8b824e5337fee29d'
const CLIP_ID = 'clip_2287e76553ab473e8b824e5337fee29d'
const SHA_PREFIX = process.env.CV17A_SHA?.slice(0, 7) || ''

const results = {}

async function patchEdits(page, patch) {
  return page.evaluate(
    async ({ clipId, patch }) => {
      const cur = await fetch(`/api/clips/clips/${clipId}`)
      if (!cur.ok) return { ok: false }
      const clip = await cur.json()
      const edits = { ...(clip.edits || {}), ...patch }
      if (patch.layerFx === null) delete edits.layerFx
      if (patch.canvasBg === null) delete edits.canvasBg
      const r = await fetch(`/api/clips/clips/${clipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edits }),
      })
      return { ok: r.ok, layerFx: edits.layerFx ?? null }
    },
    { clipId: CLIP_ID, patch },
  )
}

async function readLayerFx(page) {
  return page.evaluate(async (clipId) => {
    const r = await fetch(`/api/clips/clips/${clipId}`)
    const j = await r.json()
    return j?.edits?.layerFx ?? null
  }, CLIP_ID)
}

async function undoBtn(page) {
  return page.locator('[data-testid="editor-undo"]')
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

    await page.locator('[data-testid="preview-main-layer"]').first().click({ position: { x: 48, y: 48 } })
    await page.waitForTimeout(500)
    await page.locator('[data-testid="properties-tab-video"]').click()
    await page.waitForTimeout(400)

    results.sectionsVisible =
      (await page.locator('[data-testid="layer-fx-mask"]').isVisible()) &&
      (await page.locator('[data-testid="layer-fx-key"]').isVisible())
    results.noBlendSection = !(await page.locator('[data-testid="layer-fx-blend"]').isVisible().catch(() => false))

    await page.locator('[data-testid="layer-fx-mask-ellipse"]').click()
    await page.locator('[data-testid="layer-fx-key-toggle"]').click()
    await page.waitForTimeout(600)

    let fx = await readLayerFx(page)
    results.editsHasVideoRow = Boolean(fx?.some((r) => r.target === 'video' && r.mask && r.key))
    results.previewMainFx = await page.locator('[data-testid="preview-main-fx"]').count()
    results.maskDom = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="preview-main-fx"]')
      const el = root?.querySelector('[data-g4b-mask="1"]')
      return Boolean(el)
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('[data-testid="timeline-root"]').waitFor({ timeout: 120_000 })
    await page.waitForTimeout(2000)
    fx = await readLayerFx(page)
    results.persistAfterReload = Boolean(fx?.some((r) => r.target === 'video' && r.mask))

    await undoBtn(page).click()
    await page.waitForTimeout(700)
    fx = await readLayerFx(page)
    results.undoKey = Boolean(fx?.some((r) => r.target === 'video' && r.mask && !r.key))
    await undoBtn(page).click()
    await page.waitForTimeout(700)
    fx = await readLayerFx(page)
    results.undoMask = !fx?.length

    await page.locator('[data-testid="preview-main-layer"]').first().click({ position: { x: 48, y: 48 } })
    await page.locator('[data-testid="layer-fx-mask-rect"]').click()
    await page.locator('[data-testid="layer-fx-key-toggle"]').click()
    await page.waitForTimeout(500)

    const exportReqPromise = page
      .waitForRequest((req) => req.method() === 'POST' && req.url().includes(`/api/clips/clips/${CLIP_ID}/export`), {
        timeout: 90_000,
      })
      .catch(() => null)
    await page.getByRole('button', { name: 'Export', exact: true }).click({ timeout: 15_000 })
    await page.waitForTimeout(400)
    await page.locator('[data-testid="export-mp4-button"]').click({ timeout: 30_000 })
    const req = await exportReqPromise
    if (req) {
      const body = JSON.parse(req.postData() || '{}')
      const row = body?.edits?.layerFx?.find((r) => r.target === 'video')
      results.exportPayloadVideoFx = Boolean(row?.mask && row?.key)
    }

    results.cleanup = await patchEdits(page, { layerFx: null, canvasBg: null })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('[data-testid="timeline-root"]').waitFor({ timeout: 120_000 })
    fx = await readLayerFx(page)
    results.finalClean = !fx?.length

    results.PASS = Boolean(
      results.sectionsVisible &&
        results.noBlendSection &&
        results.editsHasVideoRow &&
        results.maskDom &&
        results.persistAfterReload &&
        results.undoKey &&
        results.undoMask &&
        results.exportPayloadVideoFx &&
        results.finalClean &&
        results.cleanup?.ok,
    )
  } catch (e) {
    results.error = e instanceof Error ? e.message : String(e)
    results.PASS = false
    try {
      await patchEdits(page, { layerFx: null, canvasBg: null })
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
