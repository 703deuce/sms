#!/usr/bin/env node
/** CV17c-fix3 diagnosis facts 1-3 */
import { chromium } from '../node_modules/playwright/index.mjs'

const CLIP_ID = 'clip_2287e76553ab473e8b824e5337fee29d'
const URL = `https://transovo.ai/app/clips/proj_238c916d00774f0a9a024efbcfd7beea/edit/${CLIP_ID}`

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.locator('[data-testid="timeline-root"]').waitFor({ timeout: 120000 })
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: 'Text', exact: true }).click()
    await page.getByTestId('text-add').click()
    await page.waitForTimeout(3000)
    const textId = await page.evaluate(() => [...document.querySelectorAll('[data-testid="timeline-item-text"]')].pop()?.getAttribute('data-item-id'))
    await page.locator(`[data-testid="timeline-item-text"][data-item-id="${textId}"]`).click({ force: true })
    await page.getByRole('button', { name: 'Properties', exact: true }).click()
    await page.locator('[data-testid="properties-panel"][data-target^="text:"]').waitFor({ timeout: 20000 })
    await page.getByTestId('layer-fx-mask-ellipse').click()
    await page.waitForTimeout(4000)

    const facts = await page.evaluate((textId) => {
      const host = document.querySelector(`[data-testid="preview-text-fx"][data-fx-id="${textId}"]`)
      const canvases = [...document.querySelectorAll('[data-testid="libass-canvas"]')]
      const fxCanvas = host?.querySelector('[data-testid="libass-canvas"]')
      const st = host ? getComputedStyle(host) : null
      const cst = fxCanvas ? getComputedStyle(fxCanvas) : null
      return {
        fact1: canvases.map((c) => ({
          layer: c.getAttribute('data-libass-layer'),
          closestFxHost: c.closest('[data-testid="preview-text-fx"]') != null,
          parentChain: (() => {
            const chain = []
            let n = c
            for (let i = 0; i < 8 && n; i++) {
              chain.push(`${n.tagName}${n.dataset?.testid ? `[${n.dataset.testid}]` : ''}${n.dataset?.fxId ? `{${n.dataset.fxId}}` : ''}`)
              n = n.parentElement
            }
            return chain
          })(),
        })),
        fact2: host
          ? {
              maskImage: (st.maskImage || st.webkitMaskImage || '').slice(0, 100),
              webkitMaskImage: (st.webkitMaskImage || '').slice(0, 100),
              mixBlendMode: st.mixBlendMode,
              hasMask: st.maskImage !== 'none' && st.maskImage !== '',
            }
          : null,
        fact2canvas: fxCanvas
          ? {
              maskImage: (cst.maskImage || cst.webkitMaskImage || '').slice(0, 100),
              hasMask: cst.maskImage !== 'none' && cst.maskImage !== '',
            }
          : null,
        fact3: 'libass-overlay.tsx LibassLayer useEffect L62-66 appendChild(canvas) to hostRef div L133-141; fx wrapper L164-174 preview-text-fx > LibassLayer',
      }
    }, textId)
    console.log(JSON.stringify({ textId, ...facts }, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
