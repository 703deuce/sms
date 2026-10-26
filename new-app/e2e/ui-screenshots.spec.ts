import { test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const OUT = process.env.UI_AFTER_DIR || path.join(process.cwd(), '..', 'plan', 'ui_after')

const SHOTS: { name: string; path: string }[] = [
  { name: 'projects.png', path: '/app/clips' },
  { name: 'new.png', path: '/app/clips/new' },
  { name: 'exports.png', path: '/app/clips/exports' },
  { name: 'brand.png', path: '/app/clips/brand' },
]

test.describe('ui after screenshots', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT, { recursive: true })
  })

  for (const shot of SHOTS) {
    test(`capture ${shot.name}`, async ({ page }) => {
      await page.goto(shot.path, { waitUntil: 'networkidle' })
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(OUT, shot.name), fullPage: false })
    })
  }
})
