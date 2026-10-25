/** Edge + Node safe clips gate cookie (HMAC of CLIPS_ACCESS_PASSWORD). */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { CLIPS_ACCESS_COOKIE } from '@/lib/clips-access-constants'

export { CLIPS_ACCESS_COOKIE }
const PAYLOAD = 'clips-gate-v1'

export function clipsAccessTokenFromPassword(password: string): string {
  return createHmac('sha256', password).update(PAYLOAD).digest('base64url')
}

export function parseCookieHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return rest.join('=') || ''
  }
  return null
}

export function hasClipsAccessFromRequest(request: Request, password: string | undefined): boolean {
  const pw = password?.trim()
  if (!pw) return true
  const expected = clipsAccessTokenFromPassword(pw)
  const got = parseCookieHeader(request.headers.get('cookie'), CLIPS_ACCESS_COOKIE)
  if (!got) return false
  try {
    const a = Buffer.from(got)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}
