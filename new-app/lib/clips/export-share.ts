import { createId } from '@/lib/supabase/id'

/** Public path segment for render export share links (unguessable slug). */
export const RENDER_SHARE_SLUG_MIN_LEN = 12
export const RENDER_SHARE_SLUG_MAX_LEN = 24
export const RENDER_SHARE_SLUG_RE = /^[a-z0-9]{12,24}$/

export type RenderShareAccess = 'link' | 'revoked'

export type RenderShareLinkDto = {
  id: string
  renderId: string
  slug: string
  allowDownload: boolean
  expiresAt: string | null
  revokedAt: string | null
  viewCount: number
  shareUrl: string
  pageUrl: string
  createdAt: string
}

export type CreateRenderShareInput = {
  allowDownload?: boolean
  expiresAt?: Date | null
}

export type UpdateRenderShareInput = {
  allowDownload?: boolean
  expiresAt?: Date | null
}

export function generateRenderShareSlug(): string {
  const raw = createId('rex').replace(/[^a-z0-9]/gi, '').toLowerCase()
  const slug = raw.slice(0, 16)
  if (slug.length >= RENDER_SHARE_SLUG_MIN_LEN) return slug
  return (createId('rex').replace(/[^a-z0-9]/gi, '').toLowerCase() + createId('rex')).slice(0, 16)
}

export function isValidRenderShareSlug(slug: string): boolean {
  return RENDER_SHARE_SLUG_RE.test(slug)
}

export function renderSharePublicApiPath(slug: string): string {
  return `/api/public/share/renders/${encodeURIComponent(slug)}`
}

export function renderSharePagePath(slug: string, accessToken?: string | null): string {
  const base = `/share/renders/${encodeURIComponent(slug)}`
  if (!accessToken?.trim()) return base
  return `${base}?t=${encodeURIComponent(accessToken.trim())}`
}

export function buildRenderShareUrls(
  origin: string,
  slug: string,
  accessToken?: string | null,
): { shareUrl: string; pageUrl: string; apiPath: string } {
  const base = origin.replace(/\/$/, '')
  const pagePath = renderSharePagePath(slug, accessToken)
  const apiPath = renderSharePublicApiPath(slug)
  const tokenQuery = accessToken?.trim() ? `?t=${encodeURIComponent(accessToken.trim())}` : ''
  return {
    pageUrl: `${base}${pagePath}`,
    shareUrl: `${base}${pagePath}`,
    apiPath: `${base}${apiPath}${tokenQuery}`,
  }
}

export function parseRenderShareAccessToken(requestUrl: string): string | null {
  try {
    const t = new URL(requestUrl).searchParams.get('t')
    return t?.trim() ? t.trim() : null
  } catch {
    return null
  }
}
