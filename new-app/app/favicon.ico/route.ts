import { NextResponse } from 'next/server'

/** Browsers request /favicon.ico by default; serve the app SVG icon. */
export function GET(request: Request) {
  const url = new URL('/icon.svg', request.url)
  return NextResponse.redirect(url, 308)
}
