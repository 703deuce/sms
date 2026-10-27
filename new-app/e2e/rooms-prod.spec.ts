import { test, expect, chromium } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'https://transovo.ai'
const ROOM_SESSION = process.env.ROOMS_E2E_SESSION_ID || 'recs_c2ee084c51aa4d6d9f67a6794128923c'

test.describe('Rooms prod smoke', () => {
  test('host + guest recording flow', async () => {
    test.setTimeout(300_000)
    if (!process.env.ROOMS_E2E_STORAGE_STATE) {
      test.skip(true, 'Set ROOMS_E2E_STORAGE_STATE to authenticated storageState.json path')
    }

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    })

    const hostContext = await browser.newContext({
      storageState: process.env.ROOMS_E2E_STORAGE_STATE,
      baseURL: BASE,
    })
    const guestContext = await browser.newContext({
      baseURL: BASE,
      permissions: ['microphone', 'camera'],
    })

    const host = await hostContext.newPage()
    const guest = await guestContext.newPage()

    await host.goto(`/app/rooms/${ROOM_SESSION}`, { waitUntil: 'domcontentloaded' })
    await host.evaluate((id) => sessionStorage.setItem(`rooms:${id}:isHost`, '1'), ROOM_SESSION)
    await host.reload({ waitUntil: 'domcontentloaded' })

    await host.getByPlaceholder('Display name').fill('E2E Host')
    await host.getByRole('button', { name: 'Yes' }).click()
    await host.getByRole('button', { name: 'Join' }).click()
    await host.waitForURL(/\/studio/, { timeout: 60_000 })
    await expect(host.getByRole('button', { name: 'Invite' })).toBeVisible({ timeout: 90_000 })

    await host.getByRole('button', { name: 'Invite' }).click()
    await host.getByRole('button', { name: 'Copy link' }).click()
    const inviteLink = await host.evaluate(() => {
      const el = document.querySelector('[class*="font-mono"]')
      return el?.textContent?.trim() ?? ''
    })
    expect(inviteLink).toContain('/app/rooms/join?token=')

    await guest.goto(inviteLink, { waitUntil: 'domcontentloaded' })
    await guest.getByPlaceholder('Display name').fill('E2E Guest')
    await guest.getByRole('button', { name: 'Continue' }).click()
    await guest.waitForURL(new RegExp(`/app/rooms/${ROOM_SESSION}`), { timeout: 60_000 })
    await guest.getByRole('button', { name: 'Yes' }).click()
    await guest.getByRole('button', { name: 'Join' }).click()
    await guest.waitForURL(/\/studio/, { timeout: 60_000 })

    await host.getByRole('button', { name: 'Start' }).click()
    await expect(host.locator('text=3').or(host.locator('text=2'))).toBeVisible({ timeout: 10_000 })
    await host.waitForTimeout(22_000)
    await host.getByRole('button', { name: 'Stop' }).click()

    await expect(host.getByText(/upload|uploaded|No tracks/i)).toBeVisible({ timeout: 120_000 })

    await browser.close()
  })
})
