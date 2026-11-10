import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('marketing home route check', () => {
  it('keeps every pre-home page path resolving to the same page or a redirect', () => {
    const script = path.join(process.cwd(), 'scripts/verify-marketing-home-routes.mjs')
    const output = execFileSync(process.execPath, [script], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    expect(output).toContain('## PASS')
  })
})
