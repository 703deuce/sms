import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

/** Browsers request /favicon.ico by default; serve the app SVG (200, not redirect). */
export function GET() {
  try {
    const svg = readFileSync(path.join(process.cwd(), 'app', 'icon.svg'), 'utf8')
    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
