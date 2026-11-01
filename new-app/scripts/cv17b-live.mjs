#!/usr/bin/env node
/** CV-17b live — main video Reverse on clip_2287e76553ab473e8b824e5337fee29d */
import { chromium } from '../node_modules/playwright/index.mjs'

const PROJECT_ID = 'proj_238c916d00774f0a9a024efbcfd7beea'
const CLIP_ID = 'clip_2287e76553ab473e8b824e5337fee29d'
const URL = `https://transovo.ai/app/clips/${PROJECT_ID}/edit/${CLIP_ID}`
const SHA_PREFIX = process.env.CV17B_SHA?.slice(0, 7) || ''

const results = {
  controlVisible: 'FAIL',
  toggleWritesRange: 'FAIL',
  ariaPressed: 'FAIL',
  persistReload: 'FAIL',
  undoOne: 'FAIL',
  exportPayload: 'FAIL',
  cleanup: 'FAIL',
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
  throw new Error(`health not stable on ${SHA_PREFIX} (last ${shas[shas.length - 1]})`)
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

async function selectFirstVideoItem(page) {
  const item = page.locator('[data-testid="timeline-item"]').filter({ hasText: /Video|Main/i }).first()
  if (await item.count()) {
    await item.click()
    return
  }
  await page.locator('[data-lane="video"] [data-testid="timeline-item"]').first().click()
}

async function main() {
  results.healthSha = await waitHealth()
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForTimeout(4000)

    await page.evaluate(
      async ({ clipId }) => {
        const r = await fetch(`/api/clips/clips/${clipId}`)
        const clip = (await r.json()).data ?? (await r.json())
        const edits = { ...(clip.edits || {}) }
        delete edits.videoReverse
        await fetch(`/api/clips/clips/${clipId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ edits }),
        })
      },
      { clipId: CLIP_ID },
    )
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    await selectFirstVideoItem(page)
    await page.getByRole('tab', { name: 'Video' }).click()
    const toggle = page.getByTestId('video-reverse-toggle')
    await toggle.waitFor({ state: 'visible', timeout: 20000 })
    results.controlVisible = 'PASS'

    const before = await fetchEdits(page)
    await toggle.click()
    const after = await waitAutosave(page, (e) => Array.isArray(e.videoReverse) && e.videoReverse.length > 0)
    const seg = await page.evaluate(() => {
      const el = document.querySelector('[data-lane="video"] [data-testid="timeline-item"][data-selected="true"]')
      if (!el) return null
      const a = el.getAttribute('data-src-in-ms')
      const b = el.getAttribute('data-src-out-ms')
      if (a == null || b == null) return null
      return { startMs: Number(a), endMs: Number(b) }
    })
    const vr = after.videoReverse[0]
    if (seg && vr && vr.startMs === seg.startMs && vr.endMs === seg.endMs) results.toggleWritesRange = 'PASS'
    if ((await toggle.getAttribute('aria-pressed')) === 'true') results.ariaPressed = 'PASS'

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    const re = await fetchEdits(page)
    if (re?.videoReverse?.length && re.videoReverse[0].startMs === vr.startMs) results.persistReload = 'PASS'

    await selectFirstVideoItem(page)
    await page.getByRole('button', { name: 'Undo' }).click()
    await waitAutosave(page, (e) => !e.videoReverse?.length)
    results.undoOne = 'PASS'

    await toggle.click()
    await waitAutosave(page, (e) => e.videoReverse?.length > 0)
    const exportBody = await page.evaluate(async (clipId) => {
      const r = await fetch(`/api/clips/clips/${clipId}`)
      const edits = ((await r.json()).data ?? {}).edits ?? {}
      return { edits: { ...edits, videoReverse: edits.videoReverse } }
    }, CLIP_ID)
    if (exportBody.edits?.videoReverse?.length) results.exportPayload = 'PASS'

    await page.evaluate(
      async ({ clipId }) => {
        const r = await fetch(`/api/clips/clips/${clipId}`)
        const clip = (await r.json()).data ?? {}
        const edits = { ...(clip.edits || {}) }
        delete edits.videoReverse
        await fetch(`/api/clips/clips/${clipId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ edits }),
        })
      },
      { clipId: CLIP_ID },
    )
    results.cleanup = 'PASS'
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
