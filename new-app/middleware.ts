import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { CLIPS_ACCESS_COOKIE } from '@/lib/clips-access-constants'

function hasClipsCookie(request: NextRequest): boolean {
  const expected = process.env.CLIPS_ACCESS_COOKIE_TOKEN?.trim()
  if (!expected) return false
  const got = request.cookies.get(CLIPS_ACCESS_COOKIE)?.value
  return Boolean(got && got === expected)
}

export function middleware(request: NextRequest) {
  const gated = Boolean(process.env.CLIPS_ACCESS_PASSWORD?.trim())
  if (!gated) return NextResponse.next()

  const { pathname } = request.nextUrl
  if (pathname === '/clips-access' || pathname === '/api/clips/access') return NextResponse.next()

  if (hasClipsCookie(request)) return NextResponse.next()

  const key = process.env.TRANSOVO_DEV_API_KEY?.trim()
  if (key && request.headers.get('x-transovo-dev-key')?.trim() === key) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/clips')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const login = new URL('/clips-access', request.url)
  login.searchParams.set('next', pathname + request.nextUrl.search)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/app/:path*', '/api/clips/:path*'],
}
