import { existsSync } from 'node:fs'

export function clipperE2eEnabled(): boolean {
  return process.env.CLIPPER_E2E_ENABLED === '1' || process.env.CLIPPER_E2E_ENABLED === 'true'
}

export function clipperE2eBaseUrl(): string {
  return (
    process.env.PLAYWRIGHT_BASE_URL ||
    process.env.BASE_URL ||
    process.env.UI_AGENT_BASE_URL ||
    'https://transovo.ai'
  )
}

export function clipperE2eFixturePath(): string | null {
  const p = process.env.CLIPPER_E2E_FIXTURE_PATH?.trim()
  if (!p) return null
  if (!existsSync(p)) throw new Error(`CLIPPER_E2E_FIXTURE_PATH missing on disk: ${p}`)
  return p
}

export function clipperE2eCredentials(): { email: string; password: string } | null {
  const email = (process.env.CLIPPER_E2E_EMAIL || process.env.E2E_ROOMS_EMAIL || '').trim()
  const password = (process.env.CLIPPER_E2E_PASSWORD || process.env.E2E_ROOMS_PASSWORD || '').trim()
  if (!email || !password) return null
  return { email, password }
}

export function clipperE2eStorageStatePath(): string | null {
  const p = process.env.ROOMS_E2E_STORAGE_STATE || process.env.E2E_STORAGE_STATE
  return p && existsSync(p) ? p : null
}

export function clipperE2eSkipReason(): string | null {
  if (!clipperE2eEnabled()) {
    return 'Set CLIPPER_E2E_ENABLED=1 to run clipper prod smoke'
  }
  if (!clipperE2eFixturePath()) {
    return 'Set CLIPPER_E2E_FIXTURE_PATH to a 20–60s MP4/MOV/WebM fixture'
  }
  if (!clipperE2eStorageStatePath() && !clipperE2eCredentials()) {
    return 'Set E2E_STORAGE_STATE or CLIPPER_E2E_EMAIL + CLIPPER_E2E_PASSWORD (or E2E_ROOMS_*)'
  }
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!clipperE2eStorageStatePath() && (!supabaseUrl || !anonKey)) {
    return 'Password login requires SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY when storage state is unset'
  }
  return null
}
