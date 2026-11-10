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
  console.log(`[marketing-home-routes.test] Reading route source: ${rel}`)
  return fs.readFileSync(path.join(appRoot, rel), 'utf8')
}

describe('marketing home route check', () => {
  it('keeps every pre-home page path resolving to the same page or a documented redirect', () => {
    console.log('[marketing-home-routes.test] Step 1: execute the full route inventory guard')
    const script = path.join(process.cwd(), 'scripts/verify-marketing-home-routes.mjs')
    let output: string
    try {
      output = execFileSync(process.execPath, [script], {
        cwd: process.cwd(),
        encoding: 'utf8',
      })
    } catch (error) {
      const stdout = (error as { stdout?: Buffer | string }).stdout?.toString() ?? ''
      console.log('[marketing-home-routes.test] Route guard failure details:')
      console.log(stdout.split('\n').filter((line) => line.startsWith('- ')).join('\n'))
      throw error
    }
    expect(output).toContain('## PASS')
    expect(output).toContain('## Legacy slug redirects (308)')
    expect(output).toContain('`/ai-clips` | `/ai-clipper`')
    expect(output).toContain('`/video-editing` | `/video-editor`')
    console.log('[marketing-home-routes.test] Step 2: confirm documented home semantics')
    expect(output).toContain('`/app` renders the dashboard; `/app/home` is its alias')
    console.log('[marketing-home-routes.test] PASS: inventory, 308 slugs, and home exceptions')
  })
})

describe('legacy marketing slug redirects', () => {
  it('permanentRedirects /ai-clips to /ai-clipper and /video-editing to /video-editor', () => {
    console.log('[marketing-home-routes.test] Step 1: inspect legacy slug redirect pages')
    const clips = readPage('(marketing)/ai-clips/page.tsx')
    const editing = readPage('(marketing)/video-editing/page.tsx')
    expect(clips).toMatch(/permanentRedirect\(\s*['"]\/ai-clipper['"]\s*\)/)
    expect(editing).toMatch(/permanentRedirect\(\s*['"]\/video-editor['"]\s*\)/)
    expect(clips).not.toMatch(/\bif\s*\(/)
    expect(editing).not.toMatch(/\bif\s*\(/)
    expect(fs.existsSync(path.join(appRoot, '(marketing)/ai-clipper/page.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(appRoot, '(marketing)/video-editor/page.tsx'))).toBe(true)
    console.log('[marketing-home-routes.test] PASS: legacy slug redirects and new pages')
  })
})

describe('authenticated Home at /app and /app/home', () => {
  it('renders the /app dashboard and sends /app/home to the dashboard, not clips', () => {
    console.log('[marketing-home-routes.test] Step 1: inspect authenticated Home dashboard')
    const dashboard = readPage('app/page.tsx')
    expect(dashboard).toContain('export default async function AppDashboardPage')
    expect(dashboard).toContain('<PageHeader title="Home"')
    expect(dashboard).not.toMatch(/\b(?:permanentRedirect|redirect)\s*\(/)
    console.log('[marketing-home-routes.test] Step 2: inspect /app/home alias destination')
    const alias = readPage('app/home/page.tsx')
    expect(alias).toMatch(/permanentRedirect\s*\(\s*withQuery\s*\(\s*routes\.app\s*\(\s*\)/)
    expect(alias).not.toMatch(/routes\.clips\s*\(|['"]\/app\/clips['"]|['"]\/app\/clips\/['"]|routes\.clipsNew\s*\(/)
    console.log('[marketing-home-routes.test] PASS: both URLs lead to the real Home dashboard')
  })
})

describe('marketing home at /', () => {
  it('renders the marketing page with no Host dependency', () => {
    console.log('[marketing-home-routes.test] Step 1: inspect public marketing home and layout')
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
    console.log('[marketing-home-routes.test] PASS: public marketing home is host-independent')
  })
})
