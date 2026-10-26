import { describe, expect, it } from 'vitest'
import { applyProducerTool } from '@/lib/clips/edits-reducer'
import { defaultEdits } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

describe('edits-reducer', () => {
  it('trims clip range', () => {
    const base = defaultEdits(bounds)
    const { edits, summary } = applyProducerTool(base, bounds, {
      name: 'trim',
      args: { inMs: 1000, outMs: 20_000 },
    })
    expect(edits.trim.in).toBe(1000)
    expect(edits.trim.out).toBe(20_000)
    expect(summary).toContain('Trimmed')
  })

  it('flags paid tools as pending', () => {
    const base = defaultEdits(bounds)
    const res = applyProducerTool(base, bounds, {
      name: 'generate_music',
      args: { prompt: 'lofi' },
    })
    expect(res.pendingPaid?.name).toBe('generate_music')
  })

  it('apply_brand sets logo and captions', () => {
    const base = defaultEdits(bounds)
    const { edits } = applyProducerTool(base, bounds, {
      name: 'apply_brand',
      args: {
        logoKey: 'brand/ws/logo.png',
        settings: {
          logoPosition: 'BL',
          logoSizePct: 15,
          logoOpacity: 0.8,
          primaryColor: '#ff00aa',
          defaultMusicMood: 'chill',
          captionPreset: { presetId: 'minimal', animation: 'slideup' },
        },
      },
    })
    expect((edits.brand as { logoKey?: string })?.logoKey).toBe('brand/ws/logo.png')
    expect(edits.captions?.presetId).toBe('minimal')
    expect(edits.captions?.colors?.a).toBe('#ff00aa')
  })

  it('dub tool requires confirmation', () => {
    const base = defaultEdits(bounds)
    const res = applyProducerTool(base, bounds, { name: 'dub', args: { targetLang: 'fr' } })
    expect(res.pendingPaid?.name).toBe('dub')
  })
})
