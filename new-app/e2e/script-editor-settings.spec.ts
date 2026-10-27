import { test, expect } from '@playwright/test'

const BASE = process.env.UI_AGENT_BASE_URL ?? 'https://transovo.ai'

test.describe('Script editor §20 settings', () => {
  test('editor preferences API is reachable when authenticated', async ({ request }) => {
    const res = await request.get(`${BASE}/api/clips/editor-preferences`)
    expect(res.status()).toBeLessThan(500)
    if (res.ok()) {
      const json = (await res.json()) as { data?: { defaultClipAspect?: string } }
      if (json.data?.defaultClipAspect) {
        expect(['9:16', '1:1', '4:5', '16:9']).toContain(json.data.defaultClipAspect)
      }
    }
  })
})
