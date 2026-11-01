#!/usr/bin/env node
/** CV-17c live — text + adjustment layer mask/blend (value checks only). */
import { chromium } from '../node_modules/playwright/index.mjs'

const PROJECT_ID = 'proj_238c916d00774f0a9a024efbcfd7beea'
const CLIP_ID = 'clip_2287e76553ab473e8b824e5337fee29d'
const URL = `https://transovo.ai/app/clips/${PROJECT_ID}/edit/${CLIP_ID}`
const TEXT_ID = 'cv17c_tmp_text'
const ADJ_ID = 'cv17c_tmp_adj'
const SHA_PREFIX = process.env.CV17C_SHA?.slice(0, 7) || ''

const results = {
  textControlsVisible: 'FAIL',
  adjustControlsVisible: 'FAIL',
  textMaskBlendWrites: 'FAIL',
  adjustMaskBlendWrites: 'FAIL',
  undoOne: 'FAIL',
  exportPayload: 'FAIL',
  cleanupRestore: 'FAIL',
}

async function waitHealth() {
  if (!SHA_PREFIX) return null
  const shas = []
  for (let i = 0; i < 60; i++) {
    const h = await fetch('https://transovo.ai/api/health').then((r) => r.json())
    const sha = String(h.commitSha || '')
    shas.push(sha)
    if (sha.startsWith(SHA_PREFIX) && shas.length >= 3 && shas.slice(-3).every((s) => s.startsWith(SHA_PREFIX))) {
      return sha
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error(`health not stable on ${SHA_PREFIX}`)
}

async function fetchEdits(page) {
  return page.evaluate(async (id) => {
    const r = await fetch(`/api/clips/clips/${id}`)
    if (!r.ok) return null
    const j = await r.json()
    return (j.data ?? j).edits ?? null
  }, CLIP_ID)
}

async function waitAutosave(page, pred, ms = 45000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const e = await fetchEdits(page)
    if (e && pred(e)) return e
    await page.waitForTimeout(800)
  }
  throw new Error('autosave timeout')
}

function snap(edits) {
  if (!edits) return null
  const { textItems, adjustLayers, layerFx, videoSplits, videoReverse } = edits
  return JSON.stringify({ textItems, adjustLayers, layerFx, videoSplits, videoReverse })
}

async function patchBaseline(page, baselineEdits) {
  return page.evaluate(
    async ({ clipId, baselineEdits }) => {
      const r = await fetch(`/api/clips/clips/${clipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edits: baselineEdits }),
      })
      return r.ok
    },
    { clipId: CLIP_ID, baselineEdits },
  )
}

async function addTempItems(page) {
  return page.evaluate(
    async ({ clipId, textId, adjId }) => {
      const r = await fetch(`/api/clips/clips/${clipId}`)
      if (!r.ok) return { ok: false }
      const clip = (await r.json()).data ?? {}
      const edits = { ...(clip.edits || {}) }
      const textItems = [...(edits.textItems || [])]
      if (!textItems.some((t) => t.id === textId)) {
        textItems.push({
          id: textId,
          text: 'CV17c',
          startMs: 0,
          endMs: 8000,
          x: 50,
          y: 40,
          style: { font: 'Montserrat', size: 72, color: '#ffffff', align: 'center', case: 'none' },
          presetId: 'basic',
        })
      }
      edits.textItems = textItems
      const adjustLayers = [...(edits.adjustLayers || [])]
      if (!adjustLayers.some((a) => a.id === adjId)) {
        adjustLayers.push({ id: adjId, startMs: 0, endMs: 8000, spec: { adjust: { exposure: 0.05 } } })
      }
      edits.adjustLayers = adjustLayers
      const layerFx = (edits.layerFx || []).filter(
        (row) => row.target !== `text:${textId}` && row.target !== `adjust:${adjId}`,
      )
      edits.layerFx = layerFx.length ? layerFx : undefined
      const pr = await fetch(`/api/clips/clips/${clipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edits }),
      })
      return { ok: pr.ok }
    },
    { clipId: CLIP_ID, textId: TEXT_ID, adjId: ADJ_ID },
  )
}

async function selectTimelineItem(page, lane, id) {
  const el = page.locator(`[data-testid="timeline-item-${lane}"][data-item-id="${id}"]`)
  await el.first().waitFor({ timeout: 30000 })
  await el.first().click()
  await page.waitForTimeout(500)
}

async function main() {
  results.healthSha = await waitHealth()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  let baselineSnap = null
  let baselineEdits = null
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.locator('[data-testid="timeline-root"]').waitFor({ timeout: 120000 })
    await page.waitForTimeout(2000)
    baselineEdits = await fetchEdits(page)
    baselineSnap = snap(baselineEdits)

    const prep = await addTempItems(page)
    if (!prep.ok) throw new Error('prep add temp items failed')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('[data-testid="timeline-root"]').waitFor({ timeout: 120000 })
    await page.waitForTimeout(2500)

    await selectTimelineItem(page, 'text', TEXT_ID)
    await page.getByRole('tab', { name: 'Video' }).click()
    await page.getByTestId('layer-fx-mask').waitFor({ state: 'visible', timeout: 20000 })
    results.textControlsVisible = 'PASS'
    await page.getByTestId('layer-fx-mask-ellipse').click()
    await page.getByTestId('layer-fx-blend-multiply').click()
    const afterText = await waitAutosave(page, (e) => {
      const row = (e.layerFx || []).find((r) => r.target === `text:${TEXT_ID}`)
      return Boolean(row?.mask?.shape === 'ellipse' && row?.blend === 'multiply')
    })
    if (afterText) results.textMaskBlendWrites = 'PASS'

    await selectTimelineItem(page, 'adjust', ADJ_ID)
    await page.getByRole('tab', { name: 'Video' }).click()
    await page.getByTestId('layer-fx-mask').waitFor({ state: 'visible', timeout: 20000 })
    results.adjustControlsVisible = 'PASS'
    await page.getByTestId('layer-fx-mask-rect').click()
    await page.getByTestId('layer-fx-blend-screen').click()
    const afterAdj = await waitAutosave(page, (e) => {
      const row = (e.layerFx || []).find((r) => r.target === `adjust:${ADJ_ID}`)
      return Boolean(row?.mask?.shape === 'rect' && row?.blend === 'screen')
    })
    if (afterAdj) results.adjustMaskBlendWrites = 'PASS'

    await page.getByRole('button', { name: 'Undo' }).first().click()
    await waitAutosave(page, (e) => {
      const row = (e.layerFx || []).find((r) => r.target === `adjust:${ADJ_ID}`)
      return !row?.blend || row.blend !== 'screen'
    })
    results.undoOne = 'PASS'

    const exportCheck = await page.evaluate(
      async ({ clipId, textId, adjId }) => {
        const r = await fetch(`/api/clips/clips/${clipId}`)
        const edits = ((await r.json()).data ?? {}).edits ?? {}
        const rows = edits.layerFx || []
        const t = rows.find((x) => x.target === `text:${textId}`)
        const a = rows.find((x) => x.target === `adjust:${adjId}`)
        return { textMask: Boolean(t?.mask), adjustMask: Boolean(a?.mask) }
      },
      { clipId: CLIP_ID, textId: TEXT_ID, adjId: ADJ_ID },
    )
    if (exportCheck.textMask && exportCheck.adjustMask) results.exportPayload = 'PASS'

    const restored = await page.evaluate(
      async ({ clipId, baselineEdits, textId, adjId }) => {
        const edits = { ...baselineEdits }
        edits.textItems = (edits.textItems || []).filter((t) => t.id !== textId)
        if (!edits.textItems.length) edits.textItems = null
        edits.adjustLayers = (edits.adjustLayers || []).filter((a) => a.id !== adjId)
        if (!edits.adjustLayers.length) edits.adjustLayers = null
        edits.layerFx = (edits.layerFx || []).filter(
          (r) => r.target !== `text:${textId}` && r.target !== `adjust:${adjId}`,
        )
        if (!edits.layerFx?.length) edits.layerFx = null
        const pr = await fetch(`/api/clips/clips/${clipId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ edits }),
        })
        return pr.ok
      },
      { clipId: CLIP_ID, baselineEdits, textId: TEXT_ID, adjId: ADJ_ID },
    )
    if (restored) {
      await page.waitForTimeout(1500)
      const final = snap(await fetchEdits(page))
      if (final === baselineSnap) results.cleanupRestore = 'PASS'
    }
  } finally {
    await browser.close()
  }
  console.log(JSON.stringify(results, null, 2))
  const fail = Object.entries(results).some(([k, v]) => k !== 'healthSha' && v === 'FAIL')
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  console.log(JSON.stringify(results, null, 2))
  process.exit(1)
})
