#!/usr/bin/env node
/**
 * CV17c-fix3 STRICT pixel check (do not weaken):
 * Circle mask center 50/50, w=15%, h=10% of export frame → ellipse in preview stage coords.
 * Bright: alpha>30 && r+g+b>600.
 * BEFORE mask: outsideBright >= 200.
 * AFTER mask: outsideBright <= 10% of beforeOutside.
 * INVERT: insideBright <= 10% of afterInside (baseline inside count from after-mask shot).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '../node_modules/playwright/index.mjs'

const CLIP_ID = 'clip_2287e76553ab473e8b824e5337fee29d'
const URL = `https://transovo.ai/app/clips/proj_238c916d00774f0a9a024efbcfd7beea/edit/${CLIP_ID}`
const ART = '/opt/cursor/artifacts/cv17c-fix3'
const MASK = { x: 50, y: 50, w: 15, h: 10 }

function ellipseInside(px, py, w, h, g) {
  const cx = (g.x / 100) * w
  const cy = (g.y / 100) * h
  const hw = (g.w / 100) * w * 0.5
  const hh = (g.h / 100) * h * 0.5
  if (hw <= 0 || hh <= 0) return false
  const u = (px - cx) / hw
  const v = (py - cy) / hh
  return u * u + v * v <= 1
}

async function countBright(page, g, mode) {
  const stage = page.locator('[data-preview-renderer]')
  const buf = await stage.screenshot()
  return page.evaluate(
    async ({ b64, geom, mode }) => {
      const img = new Image()
      await new Promise((res, rej) => {
        img.onload = () => res(undefined)
        img.onerror = rej
        img.src = `data:image/png;base64,${b64}`
      })
      const w = img.width
      const h = img.height
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      if (!ctx) return { outside: 0, inside: 0, totalBright: 0 }
      ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, w, h).data
      const inside = (px, py) => {
        const cx = (geom.x / 100) * w
        const cy = (geom.y / 100) * h
        const hw = (geom.w / 100) * w * 0.5
        const hh = (geom.h / 100) * h * 0.5
        if (hw <= 0 || hh <= 0) return false
        const u = (px - cx) / hw
        const v = (py - cy) / hh
        return u * u + v * v <= 1
      }
      let outside = 0
      let insideN = 0
      let totalBright = 0
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          if (d[i + 3] <= 30 || d[i] + d[i + 1] + d[i + 2] <= 600) continue
          totalBright++
          if (inside(x + 0.5, y + 0.5)) insideN++
          else outside++
        }
      }
      if (mode === 'outside') return { outside, inside: insideN, totalBright }
      return { outside, inside: insideN, totalBright }
    },
    { b64: buf.toString('base64'), geom: g, mode },
  )
}

async function setMaskGeom(page) {
  await page.getByTestId('layer-fx-mask-ellipse').click()
  for (const [id, v] of [
    ['layer-fx-mask-x', String(MASK.x)],
    ['layer-fx-mask-y', String(MASK.y)],
    ['layer-fx-mask-w', String(MASK.w)],
    ['layer-fx-mask-h', String(MASK.h)],
  ]) {
    const input = page.getByTestId(id).locator('input').first()
    if (await input.count()) await input.fill(v)
  }
}

async function main() {
  await mkdir(ART, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  const out = {
    strict: {
      beforeOutside: null,
      afterOutside: null,
      afterInside: null,
      invertInside: null,
      passBeforeMin: false,
      passOutsideClip: false,
      passInvert: false,
    },
    screenshots: {},
    pass: 'FAIL',
  }
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.locator('[data-testid="timeline-root"]').waitFor({ timeout: 120000 })
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: 'Text', exact: true }).click()
    await page.getByTestId('text-add').click()
    await page.waitForTimeout(3500)
    const textId = await page.evaluate(() => [...document.querySelectorAll('[data-testid="timeline-item-text"]')].pop()?.getAttribute('data-item-id'))
    await page.locator(`[data-testid="timeline-item-text"][data-item-id="${textId}"]`).click({ force: true })
    await page.getByRole('button', { name: 'Properties', exact: true }).click()
    await page.locator('[data-testid="properties-panel"][data-target^="text:"]').waitFor({ timeout: 20000 })
    await page.waitForTimeout(2500)

    const beforePath = join(ART, 'stage-before-mask.png')
    await page.locator('[data-preview-renderer]').screenshot({ path: beforePath })
    out.screenshots.before = beforePath
    const before = await countBright(page, MASK, 'outside')
    out.strict.beforeOutside = before.outside

    await setMaskGeom(page)
    await page.waitForTimeout(4000)
    const afterPath = join(ART, 'stage-after-mask.png')
    await page.locator('[data-preview-renderer]').screenshot({ path: afterPath })
    out.screenshots.after = afterPath
    const after = await countBright(page, MASK, 'outside')
    out.strict.afterOutside = after.outside
    out.strict.afterInside = after.inside

    await page.getByTestId('layer-fx-mask-invert').click()
    await page.waitForTimeout(4000)
    const invertPath = join(ART, 'stage-invert-mask.png')
    await page.locator('[data-preview-renderer]').screenshot({ path: invertPath })
    out.screenshots.invert = invertPath
    const inv = await countBright(page, MASK, 'inside')
    out.strict.invertInside = inv.inside

    out.strict.passBeforeMin = before.outside >= 200
    out.strict.passOutsideClip = after.outside <= before.outside * 0.1
    out.strict.passInvert = inv.inside <= after.inside * 0.1

    if (out.strict.passBeforeMin && out.strict.passOutsideClip && out.strict.passInvert) out.pass = 'PASS'

    await page.getByRole('button', { name: 'Text', exact: true }).click().catch(() => {})
    await page.getByTestId('text-delete').click({ timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(1500)
  } finally {
    await browser.close()
  }
  await writeFile(join(ART, 'strict-result.json'), JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
  process.exit(out.pass === 'PASS' ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
