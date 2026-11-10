import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  APP_ROOT_REDIRECT,
  isMarketingHost,
  normalizeHost,
  resolveMarketingPathForHost,
  resolveRootForHost,
} from '../components/marketing/hosts'

describe('marketing home route check', () => {
  it('keeps every pre-home page path resolving to the same page or a redirect', () => {
    const script = path.join(process.cwd(), 'scripts/verify-marketing-home-routes.mjs')
    const output = execFileSync(process.execPath, [script], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    expect(output).toContain('## PASS')
    expect(output).toContain('## Host policy for /')
  })
})

describe('marketing host policy for /', () => {
  const cases: { host: string; root: 'marketing-home' | 'redirect'; other: 'render' | 'not-found' }[] = [
    { host: 'transovo.ai', root: 'marketing-home', other: 'render' },
    { host: 'www.transovo.ai', root: 'marketing-home', other: 'render' },
    { host: 'www.transovo.ai:443', root: 'marketing-home', other: 'render' },
    { host: 'voice.transovo.ai', root: 'redirect', other: 'not-found' },
    { host: 'www.voice.transovo.ai', root: 'redirect', other: 'not-found' },
    { host: 'voice.transovo.ai:443', root: 'redirect', other: 'not-found' },
    { host: 'localhost', root: 'marketing-home', other: 'render' },
    { host: 'localhost:3100', root: 'marketing-home', other: 'render' },
    { host: '127.0.0.1', root: 'marketing-home', other: 'render' },
    { host: '127.0.0.1:3000', root: 'marketing-home', other: 'render' },
    { host: '::1', root: 'marketing-home', other: 'render' },
    { host: '[::1]:3000', root: 'marketing-home', other: 'render' },
    { host: 'preview.transovo.ai', root: 'marketing-home', other: 'render' },
    { host: 'app.transovo.ai', root: 'redirect', other: 'not-found' },
    { host: 'unknown.example.com', root: 'redirect', other: 'not-found' },
  ]

  it('normalizes forwarded hosts and ports', () => {
    expect(normalizeHost('WWW.TRANSOVO.AI:443, other')).toBe('www.transovo.ai')
    expect(normalizeHost('[::1]:3000')).toBe('::1')
  })

  it('allow-lists transovo.ai / www and localhost/preview; voice and every other host keep the /app/home redirect', () => {
    const lines: string[] = [
      '| Host | `/` resolves to | `/ai-clips` and `/video-editing` |',
      '| --- | --- | --- |',
    ]
    for (const c of cases) {
      const root = resolveRootForHost(c.host)
      const other = resolveMarketingPathForHost(c.host)
      expect(isMarketingHost(c.host)).toBe(c.root === 'marketing-home')
      expect(root.kind).toBe(c.root)
      if (c.root === 'redirect') {
        expect(root.redirectTo).toBe(APP_ROOT_REDIRECT)
        expect(APP_ROOT_REDIRECT).toBe('/app/home')
      } else {
        expect(root.redirectTo).toBeNull()
      }
      expect(other).toBe(c.other)
      const rootLabel =
        root.kind === 'marketing-home'
          ? 'marketing home `(marketing)/page.tsx`'
          : `redirect \`${root.redirectTo}\` (today's behavior)`
      lines.push(`| \`${c.host}\` | ${rootLabel} | ${other} |`)
    }
    // Printed so the PR / script runner can paste results.
    console.log(['', '## Host policy for /', ...lines, ''].join('\n'))
  })
})
