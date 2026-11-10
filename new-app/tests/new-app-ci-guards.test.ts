import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('new-app CI guards', () => {
  it('app route dynamic segment names are consistent among siblings', () => {
    console.log('[new-app-ci-guards.test] Step 1: run dynamic route segment guard')
    const script = path.join(process.cwd(), 'scripts/verify-app-route-dynamic-segments.mjs')
    expect(() => {
      execFileSync(process.execPath, [script], { cwd: process.cwd(), stdio: 'pipe' })
    }).not.toThrow()
    console.log('[new-app-ci-guards.test] PASS: dynamic segment guard')
  })

  it('migration REFERENCES use schema table names', () => {
    console.log('[new-app-ci-guards.test] Step 1: run migration table reference guard')
    const script = path.join(process.cwd(), 'scripts/verify-migration-table-refs.mjs')
    expect(() => {
      execFileSync(process.execPath, [script], { cwd: process.cwd(), stdio: 'pipe' })
    }).not.toThrow()
    console.log('[new-app-ci-guards.test] PASS: migration table reference guard')
  })

  it('marketing home keeps every previous page path resolving', () => {
    console.log('[new-app-ci-guards.test] Step 1: execute marketing route inventory guard')
    const script = path.join(process.cwd(), 'scripts/verify-marketing-home-routes.mjs')
    let output: string
    try {
      output = execFileSync(process.execPath, [script], {
        cwd: process.cwd(),
        encoding: 'utf8',
      })
    } catch (error) {
      const stdout = (error as { stdout?: Buffer | string }).stdout?.toString() ?? ''
      console.log('[new-app-ci-guards.test] Route guard failure details:')
      console.log(stdout.split('\n').filter((line) => line.startsWith('- ')).join('\n'))
      throw error
    }
    expect(output).toContain('## PASS')
    console.log('[new-app-ci-guards.test] Step 2: verify the authenticated Home exception was recorded')
    expect(output).toContain('`/app` renders the dashboard; `/app/home` is its alias')
    console.log('[new-app-ci-guards.test] PASS: preserved routes and real Home dashboard')
  })
})
