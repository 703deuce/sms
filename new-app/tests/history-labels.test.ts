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
    const b = { ...a, cutRanges: [[100, 200] as [number, number]] }
    expect(describeEditsChange(a, b)).toBe('Deleted segment 0.1s–0.2s')
  })

  it('labels trim', () => {
    const a = base()
    const b = { ...a, trim: { in: 100, out: 9000 } }
    expect(describeEditsChange(a, b)).toBe('Trimmed Video in/out to 0.1s')
  })

  it('labels captions', () => {
    const a = base()
    const b = { ...a, captions: { ...a.captions, size: 80 } }
    expect(describeEditsChange(a, b)).toBe('Caption size 80')
  })

  it('labels textItems', () => {
    const a = base()
    const b = { ...a, textItems: [{ id: 't1', text: 'x', startMs: 0, endMs: 1000, x: 50, y: 50, style: a.textItems?.[0]?.style ?? {} as never }] }
    expect(describeEditsChange(a, b)).toBe('Added text “x”')
  })

  it('Retest4 N14 gives a readable fallback label for multi-part text templates', () => {
    const a = base()
    const style = { font: 'Poppins', size: 100, align: 'center', color: '#FFFFFF' } as const
    const b: ClipEditsV2 = { ...a, textItems: [
      { id: 'q1', text: '', kind: 'shape', shape: { type: 'rounded', w: 800, h: 100 },
        x: 50, y: 50, startMs: 1000, endMs: 3000, style },
      { id: 'q2', text: 'Your quote goes here', x: 50, y: 45, startMs: 1000, endMs: 3000, style },
      { id: 'q3', text: '— Name', x: 50, y: 70, startMs: 1500, endMs: 3000, style },
    ] }
    expect(describeEditsChange(a, b)).toBe('Added text group (3 items)')
  })

  it('labels layout', () => {
    const a = base()
    const b = { ...a, layout: { ...a.layout, mode: 'facecam' as const } }
    expect(describeEditsChange(a, b)).toBe('Changed layout to facecam')
  })

  it('labels audio', () => {
    const a = base()
    const b = { ...a, audio: { ...a.audio, musicVolume: 0.5 } }
    expect(describeEditsChange(a, b)).toBe('Music volume 50%')
  })

  it('labels AI voiceover placement', () => {
    const a = base()
    const b = addVoiceoverClip(a, 'upl_v', 5000, 2000, () => 'x')
    expect(describeEditsChange(a, b)).toBe('Added AI voiceover')
  })

  it('labels broll', () => {
    const a = base()
    const b = { ...a, broll: [{ id: 'b1', refId: 'u1', startMs: 0, endMs: 1000, x: 0, y: 0, w: 100, h: 100 }] }
    expect(describeEditsChange(a, b)).toBe('Added B-roll clip')
  })

  it('labels color', () => {
    const a = base()
    const b = { ...a, color: { ...a.color, exposure: 0.2 } }
    expect(describeEditsChange(a, b)).toBe('Adjusted color')
  })

  it('labels wordFixes before captions when both change', () => {
    const a = defaultEdits({ clipStartMs: 0, clipEndMs: 1000 })
    const b = {
      ...a,
      wordFixes: { '1': 'x' },
      captions: { ...a.captions, size: 7 },
    }
    expect(describeEditsChange(a, b)).toBe('Corrected transcript wording')
  })
  it('labels wordFixes', () => {
    const a = base()
    const b = { ...a, wordFixes: [{ wordIndex: 0, text: 'hello' }] }
    expect(describeEditsChange(a, b)).toBe('Corrected transcript wording')
  })

  it('D1 describes SFX addition by its actual generation reference', () => {
    const a = base()
    const b: ClipEditsV2 = { ...a, audio: { ...a.audio, sfx: [
      ...(a.audio?.sfx ?? []), { generationId: 'Whoosh', atMs: 1000 },
    ] } }
    expect(describeEditsChange(a, b)).toBe('Added SFX Whoosh')
  })

  it('D1 describes a rotation keyframe with the angle and layer', () => {
    const a = base()
    const b: ClipEditsV2 = { ...a, keyframes: [{ target: 'video', prop: 'rotation', value: 15, points: [] }] }
    expect(describeEditsChange(a, b)).toBe('Rotation 15° · Video')
  })

  it('D1 describes text deletion using the saved text', () => {
    const a: ClipEditsV2 = { ...base(), textItems: [{ id: 'title', text: 'Welcome back', startMs: 0, endMs: 1000, x: 50, y: 50, style: {} as never }] }
    const b = { ...a, textItems: [] }
    expect(describeEditsChange(a, b)).toBe('Deleted text “Welcome back”')
  })

  it('names background removal activation and deactivation', () => {
    const a = base()
    const b: ClipEditsV2 = { ...a, bgRemoval: { enabled: true, quality: 'standard',
      refine: { feather: 10, choke: 0 }, background: { type: 'blur', amount: 50 } } }
    expect(describeEditsChange(a, b)).toBe('Background removal on')
    expect(describeEditsChange(b, { ...b, bgRemoval: { ...b.bgRemoval!, enabled: false } })).toBe('Background removal off')
  })

  it('names horizontal and vertical flip changes', () => {
    const a = base()
    const b: ClipEditsV2 = { ...a, layerProps: [{ target: 'video', flipH: true }] }
    expect(describeEditsChange(a, b)).toBe('Flipped horizontally')
    expect(describeEditsChange(b, { ...b, layerProps: [] })).toBe('Unflipped horizontally')
    const c: ClipEditsV2 = { ...a, layerProps: [{ target: 'video', flipV: true }] }
    expect(describeEditsChange(a, c)).toBe('Flipped vertically')
  })

  it('Batch 3 F12 labels split before incidental layout changes', () => {
    const a = base()
    const b: ClipEditsV2 = { ...a, videoSplits: [5000], layout: { ...a.layout, mode: 'full_frame' } }
    expect(describeEditsChange(a, b)).toBe('Split Video clip')
  })

  it('Retest7 F10 names Join differently from Split', () => {
    const initial = base()
    const cut = { ...initial, videoSplits: [5000] }
    expect(describeEditsChange(initial, cut)).toBe('Split Video clip')
    expect(describeEditsChange(cut, initial)).toBe('Joined Video clips · restored cut')
  })

  it('Batch 3 F12 identifies aspect and timeline toggles', () => {
    const a = base()
    expect(describeEditsChange(a, { ...a, aspectRatio: '16:9' })).toBe('Changed aspect to 16:9')
    expect(describeEditsChange(a, { ...a, timelineOpts: { magnet: false } })).toContain('Timeline magnet')
  })

  it('falls back to Edit', () => {
    const a = base()
    const b = { ...a, layersV: 3 as const }
    expect(describeEditsChange(a, b)).toBe('Updated clip settings')
  })
})
