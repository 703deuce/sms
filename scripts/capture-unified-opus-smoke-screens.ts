/**
 * Smoke screenshots for unified Opus routes (dev + DEV_AUTH_BYPASS).
 * Run: DEV_AUTH_BYPASS=1 UNIFIED_APPOINTMENTS=1 npx tsx scripts/capture-unified-opus-smoke-screens.ts
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.UI_AGENT_BASE_URL || 'http://127.0.0.1:3000'
const OUT = '/opt/cursor/artifacts/unified-opus-smoke'

const ROUTES = [
  '/appointments/classes',
  '/appointments/workshops',
  '/appointments/staff',
]

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  await page.goto(`${BASE}/api/auth/dev-bypass?next=/appointments`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await page.waitForTimeout(4000)
    const name = route.replace(/\//g, '_').replace(/^_/, '')
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
    const h1 = await page.locator('h1').first().textContent().catch(() => '')
    console.log(`${route}: h1=${JSON.stringify(h1?.trim())}`)
  }

  const staffLink = page.locator('a[href^="/appointments/staff/"]').first()
  if (await staffLink.count()) {
    await staffLink.click()
    await page.waitForTimeout(3000)
    await page.screenshot({ path: `${OUT}/staff_detail.png`, fullPage: false })
    const h1 = await page.locator('h1').first().textContent().catch(() => '')
    console.log(`staff detail: h1=${JSON.stringify(h1?.trim())}`)
  }

  await browser.close()
  console.log(`Wrote screenshots to ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
