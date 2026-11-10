/**
 * Host policy for public marketing routes.
 *
 * transovo-web serves more than one hostname, including voice.transovo.ai.
 * Marketing pages at `/`, `/ai-clips`, and `/video-editing` are only for
 * transovo.ai / www.transovo.ai (plus localhost/preview for dev). Every other
 * host — including voice.transovo.ai and www.voice.transovo.ai — must keep
 * today's `/` behavior: redirect to /app/home (which then goes to /app/clips).
 */
export const APP_ROOT_REDIRECT = '/app/home' as const

const MARKETING_HOSTS = new Set(['transovo.ai', 'www.transovo.ai'])

/** Strip port and normalize a Host / X-Forwarded-Host value. */
export function normalizeHost(header: string | null | undefined): string {
  const raw = (header ?? '').split(',')[0]?.trim().toLowerCase() ?? ''
  if (!raw) return ''
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']')
    if (end !== -1) return raw.slice(1, end)
  }
  // hostname:port, but not bare IPv6 like ::1
  if (raw.includes(':') && !raw.includes('::')) {
    return raw.split(':')[0] ?? ''
  }
  return raw
}

function isLocalDevHost(host: string): boolean {
  if (!host) return false
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
    return true
  }
  if (host.endsWith('.localhost') || host.endsWith('.local')) return true
  return false
}

function isDevPreviewHost(host: string): boolean {
  if (!host) return false
  if (host === 'preview.transovo.ai' || host.endsWith('.preview.transovo.ai')) return true
  if (host.startsWith('preview.') || host.includes('.preview.')) return true
  return false
}

export function isMarketingHost(header: string | null | undefined): boolean {
  const host = normalizeHost(header)
  if (!host) return false
  if (MARKETING_HOSTS.has(host)) return true
  if (isLocalDevHost(host) || isDevPreviewHost(host)) return true
  return false
}

export type RootResolution =
  | { kind: 'marketing-home'; file: 'new-app/app/(marketing)/page.tsx'; redirectTo: null }
  | { kind: 'redirect'; file: 'new-app/app/(marketing)/page.tsx'; redirectTo: typeof APP_ROOT_REDIRECT }

/** What `/` should do for a given Host header. */
export function resolveRootForHost(header: string | null | undefined): RootResolution {
  if (isMarketingHost(header)) {
    return { kind: 'marketing-home', file: 'new-app/app/(marketing)/page.tsx', redirectTo: null }
  }
  return { kind: 'redirect', file: 'new-app/app/(marketing)/page.tsx', redirectTo: APP_ROOT_REDIRECT }
}

/** Other marketing paths (`/ai-clips`, `/video-editing`) on a non-marketing host. */
export function resolveMarketingPathForHost(
  header: string | null | undefined,
): 'render' | 'not-found' {
  return isMarketingHost(header) ? 'render' : 'not-found'
}
