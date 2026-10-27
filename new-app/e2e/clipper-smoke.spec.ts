import { test, expect, chromium } from '@playwright/test'
import {
  clipperE2eBaseUrl,
  clipperE2eFixturePath,
  clipperE2eSkipReason,
  clipperE2eStorageStatePath,
} from './helpers/clipper-e2e-env'
import { ensureClipperAuthenticated } from './helpers/clipper-auth'

test.describe('Regular clipper prod smoke', () => {
  test('upload → clips → TikTok export download', async () => {
    const skip = clipperE2eSkipReason()
    if (skip) {
      test.skip(true, skip)
      return
    }

    test.setTimeout(600_000)
    const base = clipperE2eBaseUrl()
    const fixturePath = clipperE2eFixturePath()!
    const storage = clipperE2eStorageStatePath()

    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      baseURL: base,
      ...(storage ? { storageState: storage } : {}),
    })
    const page = await context.newPage()
    await ensureClipperAuthenticated(context, page)

    await page.goto('/app/clips/new?tab=upload', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles(fixturePath)

    const getClips = page.getByRole('button', { name: 'Get clips' })
    await expect(getClips).toBeEnabled({ timeout: 300_000 })
    await getClips.click()

    await page.waitForURL(/\/app\/clips\/proj_/, { timeout: 60_000 })
    const projectUrl = page.url()
    const projectId = projectUrl.match(/proj_[a-f0-9]+/)?.[0]
    expect(projectId).toBeTruthy()

    const deadline = Date.now() + 600_000
    let ready = false
    while (Date.now() < deadline) {
      const res = await page.request.get(`/api/clips/projects/${projectId}/status`)
      if (res.ok()) {
        const json = (await res.json()) as { data?: { status?: string; clipCount?: number } }
        const status = json.data?.status
        const clipCount = json.data?.clipCount ?? 0
        if (status === 'FAILED' || status === 'CANCELED') {
          throw new Error(`Project ${status}: ${JSON.stringify(json.data)}`)
        }
        if (status === 'READY' && clipCount > 0) {
          ready = true
          break
        }
      }
      await page.waitForTimeout(5000)
      await page.reload({ waitUntil: 'domcontentloaded' })
    }
    expect(ready).toBe(true)

    await expect(page.getByTestId('clip-card').first()).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('clip-card').first().getByRole('button', { name: 'Edit' }).click()
    await page.waitForURL(/\/edit\//, { timeout: 120_000 })

    await page.getByRole('button', { name: /^Export$/i }).click()
    await expect(page.getByRole('dialog', { name: /export clip/i })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'TikTok' }).click()
    await page.getByRole('button', { name: 'Export MP4' }).click()

    const downloadLink = page.getByRole('link', { name: 'Download MP4' })
    await expect(downloadLink).toBeVisible({ timeout: 600_000 })

    const href = await downloadLink.getAttribute('href')
    expect(href).toBeTruthy()

    const videoRes = await page.request.get(href!.startsWith('http') ? href! : new URL(href!, base).toString())
    expect(videoRes.status()).toBe(200)
    const ct = videoRes.headers()['content-type'] || ''
    expect(ct).toMatch(/video\//i)
    const buf = await videoRes.body()
    expect(buf.byteLength).toBeGreaterThan(10_000)

    await browser.close()
  })
})
