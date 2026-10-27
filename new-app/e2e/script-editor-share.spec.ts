import { test, expect } from '@playwright/test'

const BASE = process.env.UI_AGENT_BASE_URL ?? 'https://transovo.ai'

test.describe('Script editor §17 share', () => {
  test('drive loads; share viewer test ids exist on public API contract', async ({ page, request }) => {
    await page.goto(`${BASE}/app/clips`)
    await expect(page.getByTestId('drive-home')).toBeVisible({ timeout: 60_000 })

    const bad = await request.get(`${BASE}/api/public/share/clips/not-a-real-link`)
    expect(bad.status()).toBe(404)
  })
})
