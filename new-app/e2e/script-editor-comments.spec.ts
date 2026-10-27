import { test, expect } from '@playwright/test'

const BASE = process.env.UI_AGENT_BASE_URL ?? 'https://transovo.ai'

test.describe('Script editor §16 comments', () => {
  test('composition comments API rejects anonymous access', async ({ request }) => {
    const res = await request.get(`${BASE}/api/clips/compositions/cmp_fake/comments`)
    expect([401, 403, 404]).toContain(res.status())
  })

  test('drive home reachable for editor entry', async ({ page }) => {
    await page.goto(`${BASE}/app/clips`)
    await expect(page.getByTestId('drive-home')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByTestId('drive-hero-prompt')).toBeVisible()
  })
})
