import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('migration table refs', () => {
  it('REFERENCES only schema-mapped table names', () => {
    const script = path.join(process.cwd(), 'scripts/verify-migration-table-refs.mjs')
    expect(() => {
      execFileSync(process.execPath, [script], { cwd: process.cwd(), stdio: 'pipe' })
    }).not.toThrow()
  })
})
