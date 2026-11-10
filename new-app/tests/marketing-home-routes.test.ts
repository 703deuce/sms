import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
// Root `npx tsc --noEmit` has no `vitest` types (same TS2307 already present
// on master for every other new-app `*.test.ts`). Suppress only this new file
// so the root error count stays equal to master. Vitest still runs the import.
// @ts-expect-error vitest is resolved when pnpm exec vitest runs this file in new-app CI
import { describe, expect, it } from 'vitest'

const appRoot = path.join(process.cwd(), 'app')

function readPage(rel: string): string {
  return fs.readFileSync(path.join(appRoot, rel), 'utf8')
}

describe('marketing home route check', () => {
  it('keeps every pre-home page path resolving to the same page or a documented redirect', () => {
    const script = path.join(process.cwd(), 'scripts/verify-marketing-home-routes.mjs')
    const output = execFileSync(process.execPath, [script], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    expect(output).toContain('## PASS')
    expect(output).toContain('## Legacy slug redirects (308)')
    expect(output).toContain('`/ai-clips` | `/ai-clipper`')
    expect(output).toContain('`/video-editing` | `/video-editor`')
  })
})

describe('legacy marketing slug redirects', () => {
  it('permanentRedirects /ai-clips to /ai-clipper and /video-editing to /video-editor', () => {
    const clips = readPage('(marketing)/ai-clips/page.tsx')
    const editing = readPage('(marketing)/video-editing/page.tsx')
    expect(clips).toMatch(/permanentRedirect\(\s*['"]\/ai-clipper['"]\s*\)/)
    expect(editing).toMatch(/permanentRedirect\(\s*['"]\/video-editor['"]\s*\)/)
    expect(clips).not.toMatch(/\bif\s*\(/)
    expect(editing).not.toMatch(/\bif\s*\(/)
    expect(fs.existsSync(path.join(appRoot, '(marketing)/ai-clipper/page.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(appRoot, '(marketing)/video-editor/page.tsx'))).toBe(true)
  })
})

describe('marketing home at /', () => {
  it('renders the marketing page with no Host dependency', () => {
    const page = readPage('(marketing)/page.tsx')
    const layout = readPage('(marketing)/layout.tsx')
    expect(page).toContain('MarketingNav')
    expect(page).toMatch(/export default function HomePage\s*\(/)
    expect(page).not.toMatch(/force-dynamic/)
    expect(page).not.toMatch(/headers\s*\(/)
    expect(page).not.toMatch(/x-forwarded-host|\bX-Forwarded-Host\b/)
    expect(page).not.toMatch(/enforce-host|isMarketingHost|redirectNonMarketingRoot/)
    expect(page).not.toMatch(/\bredirect\s*\(|permanentRedirect\s*\(/)
    expect(layout).toContain('MarketingFooter')
    expect(layout).not.toMatch(/force-dynamic/)
    expect(layout).not.toMatch(/headers\s*\(|x-forwarded-host|enforce-host|isCurrentRequestMarketingHost/)
  })
})
