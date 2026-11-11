import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { CAPTION_PRESETS, presetSlugToId } from '@/lib/clips/caption-presets'
import { buildCaptionsAss } from '@/lib/clips/render-plan/captions-ass'

describe('B2B preview-worker parity for all authored recipes', () => {
  it('emits byte-identical libass scripts for each of 120 designs at all three aspect ratios', () => {
    const python = spawnSync('python', ['../worker/scripts/b2b_caption_parity.py'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, PYTHONPATH: resolve(process.cwd(), '..', 'worker') },
      maxBuffer: 32 * 1024 * 1024,
      timeout: 120_000,
    })
    if (python.status !== 0) throw new Error('worker parity fixture failed: ' + python.stderr)
    const frames = JSON.parse(python.stdout) as Record<string, string>
    const designs = CAPTION_PRESETS.filter(p => p.slug.startsWith('b2b-'))
    expect(designs).toHaveLength(120)
    const words = [
      { i: 0, w: 'VISIBLE', s: 0, e: 0.5 },
      { i: 1, w: 'WORDS', s: 0.5, e: 1.0 },
    ]
    for (const recipe of designs) {
      const id = presetSlugToId(recipe.slug)
      for (const [w, h] of [[180, 320], [240, 240], [320, 180]] as const) {
        const key = id + '|' + w + 'x' + h
        expect(frames[key], key + ' worker frame').toBeDefined()
        const preview = buildCaptionsAss(words, { enabled: true, presetId: id }, w, h)
        expect(preview, key + ' preview/export ASS mismatch').toBe(frames[key])
      }
    }
    expect(Object.keys(frames)).toHaveLength(360)
  })
})
