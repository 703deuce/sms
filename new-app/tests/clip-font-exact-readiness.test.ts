import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { CLIP_FONT_MANIFEST } from '@/lib/clips/font-manifest'

describe('clip font readiness invariant', () => {
  it('checks the registered pinned face rather than every CSS face with its family', () => {
    const source = readFileSync(new URL('../lib/clips/font-manifest.ts', import.meta.url), 'utf8')
    expect(source).toContain("face.status !== 'loaded' || !document.fonts.has(face)")
    expect(source).not.toContain('document.fonts.check(')
    expect(CLIP_FONT_MANIFEST.find(row => row.id === 'Bangers')?.browserGitBlobSha1).toMatch(/^[a-f0-9]{40}$/)
  })
})
