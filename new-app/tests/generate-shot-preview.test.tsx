import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { generatePreviewCandidates, clampGeneratePreviewSeek } from '@/lib/clips/editor/generate-preview-media'

const urls = { segment: 'segment', source: 'source', proxy: 'proxy', preview: 'preview', poster: null }
describe('Generate preview (playback only)', () => {
  it('tries authorized segment, source, proxy, then composite with correct offsets', () => {
    const candidates = generatePreviewCandidates({
      authorizedSegment: { url: 'segment', offsetMs: 60000 }, authorizedSource: null,
      urls, segmentStartMs: 60000, segmentEndMs: 70000, clipStartMs: 60000, clipEndMs: 70000,
    })
    expect(candidates.map((candidate) => [candidate.kind, candidate.offsetMs])).toEqual([
      ['segment', 60000], ['source', 0], ['proxy', 0], ['composite', 60000],
    ])
    expect(clampGeneratePreviewSeek(66350, candidates[0]!, 6)).toBe(5.95)
    expect(clampGeneratePreviewSeek(66350, candidates[1]!, 120)).toBe(66.35)
    expect(clampGeneratePreviewSeek(66350, candidates[3]!, 10)).toBeCloseTo(6.35)
  })
  it('deduplicates and handles missing duration without confusing the provider input', () => {
    const candidates = generatePreviewCandidates({ authorizedSegment: null, authorizedSource: { url:'source', offsetMs:0 },
      urls, segmentStartMs: null, segmentEndMs: null, clipStartMs:0, clipEndMs:20000 })
    expect(candidates.map((x) => x.url)).toEqual(['source','proxy','preview'])
    expect(clampGeneratePreviewSeek(-100, candidates[0]!, Number.NaN)).toBe(0)
  })
})

describe('Generate editor source and playback contracts', () => {
  it('preserves provider range guard and keeps preview candidates out of generation', () => {
    const root = process.cwd().endsWith('/new-app') ? process.cwd() : join(process.cwd(), 'new-app')
    const shell = readFileSync(join(root, 'components/clips/editor/generate-shot-editor-shell.tsx'), 'utf8')
    expect(shell).toContain("mode: 'source_video_edit'")
    expect(shell).toContain('sourceConfig')
    expect(shell).toContain('previewCandidates')
    expect(shell).toContain('Retry preview')
    expect(shell).toContain('window.setTimeout')
    expect(shell).toContain('<StandaloneEditorChrome')
  })
})
