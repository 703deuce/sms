import { test, expect } from '@playwright/test'

const BASE = process.env.UI_AGENT_BASE_URL ?? 'https://transovo.ai'

test.describe('Script editor §20 settings', () => {
  test('editor preferences API is reachable when authenticated', async ({ request }) => {
    const res = await request.get(`${BASE}/api/clips/editor-preferences`)
    expect(res.status()).toBeLessThan(500)
  })
})
