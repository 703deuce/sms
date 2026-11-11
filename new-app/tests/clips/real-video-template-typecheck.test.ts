import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'

/**
 * The new-app repo has existing unrelated tsc baseline failures. This runs the
 * actual TS compiler and fails on ALL errors in B3-owned files while allowing
 * unrelated pre-existing errors to remain visible in their original CI jobs.
 */
describe('B3 scoped TypeScript gate', () => {
  it('runs full new-app tsc with zero diagnostics in Batch 3-owned files', () => {
    const run = spawnSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.typecheck.json',
      '--noEmit', '--pretty', 'false'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 180000,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=6144' },
    })
    if (run.error) throw run.error
    const text = [run.stdout || '', run.stderr || ''].join('\n')
    const diagnostics = text.split(/\r?\n/).filter(line =>
      /^(lib\/clips\/real-video-templates\/|lib\/clips\/editor\/(sources|motion-frame)\.ts|lib\/clips\/edits(-version-hash)?\.ts|lib\/server\/clips\/real-video-template-instances\.ts|components\/clips\/editor\/(motion-preview|preview-stage|script-view-compact-timeline|media-panel|editor-shell)\.(ts|tsx)|app\/api\/clips\/(video-templates\/publish|clips\/\[id\]\/template-authoring|projects\/\[id\]\/template-instance)\/route\.ts|tests\/clips\/real-video-template)/.test(line)
      && /error TS\d+/.test(line))
    expect(diagnostics, diagnostics.join('\n')).toEqual([])
  }, 190000)
})
