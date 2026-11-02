import { describe, expect, it } from 'vitest'
import { defaultEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { describeEditsChange } from '@/lib/clips/editor/history-labels'
import { addVoiceoverClip } from '@/lib/clips/editor/recording'

const bounds = { clipStartMs: 0, clipEndMs: 10_000, trimMinMs: 0, trimMaxMs: 10_000 }

function base(): ClipEditsV2 {
  return defaultEdits(bounds)
}

describe('describeEditsChange', () => {
  it('labels cutRanges', () => {
    const a = base()
    const b = { ...a, cutRanges: [{ startMs: 100, endMs: 200 }] }
    expect(describeEditsChange(a, b)).toBe('Cut')
  })

  it('labels trim', () => {
    const a = base()
    const b = { ...a, trim: { in: 100, out: 9000 } }
    expect(describeEditsChange(a, b)).toBe('Trim')
  })

  it('labels captions', () => {
    const a = base()
    const b = { ...a, captions: { ...a.captions, size: 80 } }
    expect(describeEditsChange(a, b)).toBe('Captions')
  })

  it('labels textItems', () => {
    const a = base()
    const b = { ...a, textItems: [{ id: 't1', text: 'x', startMs: 0, endMs: 1000, x: 50, y: 50, style: a.textItems?.[0]?.style ?? {} as never }] }
    expect(describeEditsChange(a, b)).toBe('Text')
  })

  it('labels layout', () => {
    const a = base()
    const b = { ...a, layout: { ...a.layout, mode: 'facecam' as const } }
    expect(describeEditsChange(a, b)).toBe('Layout')
  })

  it('labels audio', () => {
    const a = base()
    const b = { ...a, audio: { ...a.audio, musicVolume: 0.5 } }
    expect(describeEditsChange(a, b)).toBe('Audio')
  })

  it('labels AI voiceover placement', () => {
    const a = base()
    const b = addVoiceoverClip(a, 'upl_v', 5000, 2000, () => 'x')
    expect(describeEditsChange(a, b)).toBe('AI voiceover')
  })

  it('labels broll', () => {
    const a = base()
    const b = { ...a, broll: [{ id: 'b1', refId: 'u1', startMs: 0, endMs: 1000, x: 0, y: 0, w: 100, h: 100 }] }
    expect(describeEditsChange(a, b)).toBe('B-roll')
  })

  it('labels color', () => {
    const a = base()
    const b = { ...a, color: { ...a.color, exposure: 0.2 } }
    expect(describeEditsChange(a, b)).toBe('Color')
  })

  it('labels wordFixes before captions when both change', () => {
    const a = defaultEdits({ clipStartMs: 0, clipEndMs: 1000 })
    const b = {
      ...a,
      wordFixes: { '1': 'x' },
      captions: { ...a.captions, size: 7 },
    }
    expect(describeEditsChange(a, b)).toBe('Word fix')
  })
  it('labels wordFixes', () => {
    const a = base()
    const b = { ...a, wordFixes: [{ wordIndex: 0, text: 'hello' }] }
    expect(describeEditsChange(a, b)).toBe('Word fix')
  })

  it('falls back to Edit', () => {
    const a = base()
    const b = { ...a, layersV: 3 as const }
    expect(describeEditsChange(a, b)).toBe('Edit')
  })
})
