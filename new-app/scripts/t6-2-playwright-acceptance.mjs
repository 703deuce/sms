#!/usr/bin/env node
/**
 * T6.2 Playwright acceptance (b). Run with dev server:
 * DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=http://localhost:3100 npm run dev
 * Then: DEV_AUTH_BYPASS=1 node scripts/t6-2-playwright-acceptance.mjs
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.UI_AGENT_BASE_URL || 'http://localhost:3100'
const ART = '/opt/cursor/artifacts/t62-playwright'
const LOG = '/opt/cursor/artifacts/t62-playwright.log'
const TEMPLATES =
  'G1 G2 G3 G4 G5 G6 I1 I2 I3 I4 I5 I6 C1 C2 C3 C4 C5 C6 C7 C8 C9'.split(' ')

fs.mkdirSync(ART, { recursive: true })
const results = []
const lines = []

function log(msg) {
  lines.push(msg)
  console.log(msg)
}
function pass(name, d = '') {
  results.push({ name, status: 'PASS', detail: d })
  log(`PASS ${name}${d ? ` — ${d}` : ''}`)
}
function fail(name, d = '') {
  results.push({ name, status: 'FAIL', detail: d })
  log(`FAIL ${name}${d ? ` — ${d}` : ''}`)
}

async function main() {
  await fetch(`${BASE}/api/auth/dev-bypass`, { method: 'POST' }).catch(() => undefined)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${BASE}/dev/t6-2`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.evaluate(() => localStorage.removeItem('t62-edits'))
  await page.getByTestId('t62-template-G3').waitFor({ state: 'visible', timeout: 60_000 })

  // b2: each template
  for (const tid of TEMPLATES) {
    await page.getByTestId(`t62-template-${tid}`).click({ force: true })
    const stage = page.getByTestId('template-stage')
    await stage.waitFor({ state: 'visible', timeout: 15_000 })
    const box = await stage.boundingBox()
    if (!box || box.width < 10) {
      fail(`template_${tid}_width`, `w=${box?.width}`)
      continue
    }
    await page.getByTestId('t62-play').click({ force: true })
    await page.waitForTimeout(1500)
    const t0 = await page.evaluate(() => document.querySelector('[data-testid="template-stage"] video')?.currentTime ?? 0)
    const tc = await page.getByTestId('t62-timecode').textContent()
    const shot = path.join(ART, `template_${tid}.png`)
    await page.locator('[data-testid="t62-preview-wrap"]').screenshot({ path: shot })
    if (t0 > 1) pass(`template_${tid}_play`, `t=${t0.toFixed(2)} tc=${tc}`)
    else fail(`template_${tid}_play`, `t=${t0} tc=${tc}`)
  }

  // b3 seek
  await page.getByTestId('t62-seek-5').click({ force: true })
  await page.waitForTimeout(400)
  const seekT = await page.evaluate(() => document.querySelector('[data-testid="template-stage"] video')?.currentTime ?? 0)
  Math.abs(seekT - 5) < 0.5 ? pass('seek_5s', String(seekT)) : fail('seek_5s', String(seekT))

  // b4 titles (G1 has a title band)
  await page.getByTestId('t62-template-G1').click({ force: true })
  await page.getByTestId('template-stage').waitFor({ state: 'visible' })
  for (const t of ['white_on_black', 'white_on_dark_blur', 'black_on_light_blur', 'white_box_black']) {
    await page.getByTestId(`t62-title-${t}`).click({ force: true })
    const style = await page.getByTestId('template-title').getAttribute('data-title-style')
    style === t ? pass(`title_${t}`, style) : fail(`title_${t}`, style ?? 'missing')
  }
  const legacyRows = await page.getByText('Headline style', { exact: false }).count()
  legacyRows === 0 ? pass('no_legacy_headline_row', '') : fail('no_legacy_headline_row', String(legacyRows))

  // b5 CP + persist
  await page.getByTestId('t62-cp-cp11').click({ force: true })
  await page.waitForTimeout(300)
  const patchRes = await fetch(`${BASE}/api/dev/t6-2/edits`)
  const patchJson = await patchRes.json()
  const pid = patchJson?.store?.captions?.presetId
  pid === 'cp11' ? pass('cp11_patch', pid) : fail('cp11_patch', String(pid))
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('t62-reload-check').click({ force: true })
  const dump = await page.getByTestId('t62-persist-dump').textContent()
  dump?.includes('cp11') ? pass('cp11_reload', dump) : fail('cp11_reload', dump ?? '')

  await page.screenshot({ path: path.join(ART, 'final.png'), fullPage: true })
  await browser.close()
  fs.writeFileSync(LOG, lines.join('\n'))
  fs.writeFileSync(path.join(ART, 'results.json'), JSON.stringify(results, null, 2))
  const fails = results.filter((r) => r.status === 'FAIL').length
  console.log(`T62_PW_DONE fail=${fails} pass=${results.length - fails}`)
  process.exit(fails ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
