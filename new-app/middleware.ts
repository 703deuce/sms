import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isScreenwritingEnabled } from '@/lib/features/screenwriting'

const NO_STORE = 'private, no-store, must-revalidate'

function screenwritingBlocked(pathname: string): boolean {
  if (isScreenwritingEnabled()) return false
  return (
    pathname === '/app/sw' ||
    pathname.startsWith('/app/sw/') ||
    pathname.startsWith('/api/sw/') ||
    pathname.startsWith('/s/')
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (screenwritingBlocked(pathname)) {
    return new NextResponse('Not Found', { status: 404 })
  }

  if (pathname === '/app/clips/exports') {
    const url = request.nextUrl.clone()
    url.pathname = '/app/exports'
    return NextResponse.redirect(url)
  }

  const response = NextResponse.next()

  const isDocument =
    !pathname.startsWith('/_next/static') &&
    !pathname.startsWith('/_next/image') &&
    !pathname.startsWith('/api/') &&
    !pathname.match(/\.[a-z0-9]+$/i)

  if (isDocument) {
    response.headers.set('Cache-Control', NO_STORE)
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Vary', 'Cookie, Accept-Encoding')
  }

  if (pathname.startsWith('/_next/static/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/image|favicon.ico).*)'],
}
