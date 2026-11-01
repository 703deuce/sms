import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('new-app CI guards', () => {
  it('app route dynamic segment names are consistent among siblings', () => {
    const script = path.join(process.cwd(), 'scripts/verify-app-route-dynamic-segments.mjs')
    expect(() => {
      execFileSync(process.execPath, [script], { cwd: process.cwd(), stdio: 'pipe' })
    }).not.toThrow()
  })

  it('migration REFERENCES use schema table names', () => {
    const script = path.join(process.cwd(), 'scripts/verify-migration-table-refs.mjs')
    expect(() => {
      execFileSync(process.execPath, [script], { cwd: process.cwd(), stdio: 'pipe' })
    }).not.toThrow()
  })
})
