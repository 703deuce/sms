import type { BrowserContext, Page } from '@playwright/test'
import { clipperE2eBaseUrl, clipperE2eCredentials, clipperE2eStorageStatePath } from './clipper-e2e-env'

export async function ensureClipperAuthenticated(context: BrowserContext, page: Page): Promise<void> {
  const storage = clipperE2eStorageStatePath()
  if (storage) {
    await page.goto('/app/clips', { waitUntil: 'domcontentloaded', timeout: 120_000 })
    return
  }
  const creds = clipperE2eCredentials()
  if (!creds) throw new Error('clipper e2e credentials missing')

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) throw new Error('Supabase env missing for clipper e2e login')

  const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  })
  const tokenJson = (await tokenRes.json()) as Record<string, unknown>
  if (!tokenRes.ok) {
    throw new Error(`Supabase sign-in failed: ${tokenRes.status}`)
  }

  const base = clipperE2eBaseUrl()
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const storageKey = `sb-${projectRef}-auth-token`
  const sessionPayload = JSON.stringify({
    access_token: tokenJson.access_token,
    refresh_token: tokenJson.refresh_token,
    expires_at: tokenJson.expires_at,
    expires_in: tokenJson.expires_in,
    token_type: tokenJson.token_type,
    user: tokenJson.user,
  })

  await context.addCookies([
    {
      name: storageKey,
      value: encodeURIComponent(sessionPayload),
      domain: new URL(base).hostname,
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
    },
  ])

  await page.goto('/app/clips', { waitUntil: 'domcontentloaded', timeout: 120_000 })
}
