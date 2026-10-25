import { NextResponse } from 'next/server'
import { hasClipsAccessFromRequest } from '@/lib/clips-access-cookie'

/**
 * Protects /api/clips/* until Auth.js (M15).
 * Browser: shared-password cookie. Automation: x-transovo-dev-key when TRANSOVO_DEV_API_KEY is set.
 */
export function assertClipsRouteAccess(request: Request): NextResponse | null {
  const password = process.env.CLIPS_ACCESS_PASSWORD
  if (hasClipsAccessFromRequest(request, password)) return null

  const key = process.env.TRANSOVO_DEV_API_KEY?.trim()
  if (key) {
    const provided = request.headers.get('x-transovo-dev-key')?.trim()
    if (provided === key) return null
  }

  if (!password?.trim() && !key) return null

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
