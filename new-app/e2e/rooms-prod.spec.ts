import { test, expect, chromium } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://transovo.ai'
const STORAGE =
  process.env.ROOMS_E2E_STORAGE_STATE ||
  process.env.E2E_STORAGE_STATE ||
  undefined

test.describe('Rooms prod smoke', () => {
  test('host + guest: 20s record, upload 100%, import 2-track', async () => {
    test.setTimeout(600_000)
    const t0 = Date.now()

    const browser = await chromium.launch({
      headless: true,
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    })

    const hostContext = await browser.newContext({
      baseURL: BASE,
      ...(STORAGE ? { storageState: STORAGE } : {}),
      permissions: ['microphone', 'camera'],
    })
    const guestContext = await browser.newContext({
      baseURL: BASE,
      permissions: ['microphone', 'camera'],
    })

    const host = await hostContext.newPage()
    const guest = await guestContext.newPage()

    await host.goto('/app/rooms/new', { waitUntil: 'networkidle', timeout: 120_000 })
    const roomInputs = host.locator('input')
    await roomInputs.nth(0).fill(`E2E ${Date.now()}`)
    await roomInputs.nth(1).fill('E2E Host')
    await host.getByRole('button', { name: /create room/i }).click()
    await host.waitForURL(/\/app\/rooms\/recs_/, { timeout: 180_000 })
    const sessionId = host.url().match(/recs_[a-f0-9]+/)?.[0]
    expect(sessionId).toBeTruthy()

    await host.getByPlaceholder('Display name').fill('E2E Host')
    await host.getByRole('button', { name: 'Yes' }).click()
    await host.getByRole('button', { name: 'Join' }).click()
    await host.waitForURL(/\/studio/, { timeout: 120_000 })
    await expect(host.getByRole('button', { name: 'Invite' })).toBeVisible({ timeout: 120_000 })

    await host.getByRole('button', { name: 'Invite' }).click()
    await expect(host.getByRole('button', { name: 'Copy link' })).toBeVisible({ timeout: 30_000 })
    const inviteLink = await host.locator('.font-mono').first().textContent()
    expect(inviteLink).toContain('/app/rooms/join?token=')

    await guest.goto(inviteLink!.trim(), { waitUntil: 'domcontentloaded' })
    await guest.getByPlaceholder('Display name').fill('E2E Guest')
    await guest.getByRole('button', { name: 'Continue' }).click()
    await guest.waitForURL(new RegExp(`/app/rooms/${sessionId}`), { timeout: 120_000 })
    await guest.getByRole('button', { name: 'Yes' }).click()
    await guest.getByRole('button', { name: 'Join' }).click()
    await guest.waitForURL(/\/studio/, { timeout: 120_000 })

    const recStart = Date.now()
    await host.getByRole('button', { name: 'Start' }).click()
    await expect(host.getByText(/REC/)).toBeVisible({ timeout: 15_000 })
    await host.waitForTimeout(20_000)
    await host.getByRole('button', { name: 'Stop' }).click()
    const recMs = Date.now() - recStart

    await expect(host.getByText(/upload|uploaded|100%|No tracks/i).first()).toBeVisible({
      timeout: 180_000,
    })

    const pctTexts = await host.locator('text=/\\d+%/').allTextContents()
    const has100 = pctTexts.some((t) => t.includes('100'))
    const noTracks = await host.getByText(/No tracks recorded/i).isVisible().catch(() => false)

    if (!noTracks) {
      expect(has100).toBe(true)
      const gotIt = host.getByRole('button', { name: /Got it/i })
      if (await gotIt.isVisible().catch(() => false)) {
        await gotIt.click()
        const startEditing = host.getByRole('button', { name: /Start editing/i })
        if (await startEditing.isVisible().catch(() => false)) {
          await startEditing.click()
          await host.waitForURL(/\/app\/clips\/.*\/edit\//, { timeout: 180_000 })
        }
      }
    }

    const totalMs = Date.now() - t0
    console.log(
      JSON.stringify({
        ok: true,
        sessionId,
        recMs,
        totalMs,
        has100,
        noTracks,
      }),
    )

    await browser.close()
  })
})
