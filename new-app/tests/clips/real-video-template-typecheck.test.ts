import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'

/**
 * The new-app repo has existing unrelated tsc baseline failures. This runs the
 * actual TS compiler and fails on ALL errors in B3-owned files while allowing
 * unrelated pre-existing errors to remain visible in their original CI jobs.
 */
describe('B3 scoped TypeScript gate', () => {
  it('has zero TypeScript diagnostics in new real-video-template files', () => {
    const run = spawnSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.real-video-templates.json',
      '--noEmit', '--pretty', 'false'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=6144' },
    })
    if (run.error) throw run.error
    const text = [run.stdout || '', run.stderr || ''].join('\n')
    const diagnostics = text.split(/\r?\n/).filter(line =>
      /^(lib\/clips\/real-video-templates\/|lib\/server\/clips\/real-video-template-instances\.ts|tests\/clips\/real-video-template)/.test(line)
      && /error TS\d+/.test(line))
    expect(diagnostics, diagnostics.join('\n')).toEqual([])
  }, 130000)
})
