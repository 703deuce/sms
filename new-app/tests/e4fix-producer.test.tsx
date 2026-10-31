import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/storage', () => ({ getClipStorage: () => ({ getJson: async () => null }) }))

import { ToolCallCard } from '@/components/clips/producer/tool-call-card'
import { defaultEdits, type ClipBounds, type ClipEditsV2 } from '@/lib/clips/edits'
import {
  appliedProducerSummaries,
  honestProducerReply,
  isNoopProducerSummary,
  promoteMusicMixWithoutMusic,
} from '@/lib/clips/producer-honesty'
import { runProducerOnClip } from '@/lib/server/clips/producer-run'

/** E4fix: "add background music" on a clip with no music must be a cost card, never a fake "Added…/Applied". */
const bounds: ClipBounds = { clipStartMs: 0, clipEndMs: 30000, trimMinMs: 0, trimMaxMs: 30000 }
const base = (): ClipEditsV2 => defaultEdits(bounds)

describe('E4fix producer honesty', () => {
  it('no-op summaries never count as applied changes', () => {
    expect(isNoopProducerSummary('No music to mix')).toBe(true)
    expect(isNoopProducerSummary('No caption change needed')).toBe(true)
    expect(appliedProducerSummaries(['No music to mix', 'Pending generate_music', 'Updated captions'])).toEqual(['Updated captions'])
  })

  it('set_music_mix without music → generate_music queued for confirm; with music → untouched', () => {
    const t = promoteMusicMixWithoutMusic(base(), [{ name: 'set_music_mix', args: { volumeDb: -18 } }])
    expect(t.map((x) => x.name)).toEqual(['set_music_mix', 'generate_music'])
    const withMusic = { ...base(), audio: { music: { generationId: 'g', volume: 0.5, duckDepth: 0.5 } } } as unknown as ClipEditsV2
    expect(promoteMusicMixWithoutMusic(withMusic, [{ name: 'set_music_mix', args: {} }]).length).toBe(1)
  })

  it('"add background music" end-to-end: 0 changes, pending generate_music, honest reply', () => {
    const r = runProducerOnClip(base(), bounds, [{ name: 'set_music_mix', args: { volumeDb: -18 } }], [], 'Added upbeat background music at -18 dB.')
    expect(r.changeCount).toBe(0)
    expect(r.pendingPaid.map((t) => t.name)).toEqual(['generate_music'])
    expect(r.reply).not.toMatch(/added/i)
    expect(r.reply).toMatch(/Generate/)
    expect(r.edits.audio?.music).toBeFalsy()
  })

  it('"already" replies are kept; real changes keep the model reply', () => {
    expect(honestProducerReply('Captions are already bold — no change was needed.', 0, [], [])).toMatch(/already bold/)
    expect(honestProducerReply('Updated captions.', 1, [], ['Updated captions'])).toBe('Updated captions.')
    expect(honestProducerReply('Added music.', 0, [], ['No music to mix'])).toBe('No changes made (No music to mix).')
  })

  it('ToolCallCard: noop says "No change", not "Applied"', () => {
    const html = renderToStaticMarkup(<ToolCallCard summary="No music to mix" status="noop" />)
    expect(html).toContain('No change')
    expect(html).not.toContain('Applied')
    expect(renderToStaticMarkup(<ToolCallCard summary="Updated captions" />)).toContain('Applied')
  })
})
