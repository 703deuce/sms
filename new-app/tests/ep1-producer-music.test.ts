import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/storage', () => ({ getClipStorage: () => ({ getJson: async () => null }) }))

import { defaultEdits, type ClipBounds, type ClipEditsV2 } from '@/lib/clips/edits'
import { honestProducerReply, promoteMusicIntentFromMessage, userAsksForMusic } from '@/lib/clips/producer-honesty'
import { runProducerOnClip } from '@/lib/server/clips/producer-run'

/** EP1: the live LLM answered "add background music" with a text question and no tool → no cost card. */
const bounds: ClipBounds = { clipStartMs: 0, clipEndMs: 30000, trimMinMs: 0, trimMaxMs: 30000 }
const base = (): ClipEditsV2 => defaultEdits(bounds)

describe('EP1 producer music cost card', () => {
  it('detects music asks, ignores removals', () => {
    for (const m of ['add background music', 'Add some upbeat music please', 'can you put a song behind this', 'bg music', 'I want music'])
      expect(userAsksForMusic(m), m).toBe(true)
    for (const m of ['remove the music', 'no music', 'make captions bold', 'mute the track', ''])
      expect(userAsksForMusic(m), m).toBe(false)
  })

  it('LLM returned no tools + asked in text → generate_music pending, honest reply, 0 changes', () => {
    const r = runProducerOnClip(base(), bounds, [], [], 'Want me to generate background music? It uses credits.', 'add background music')
    expect(r.changeCount).toBe(0)
    expect(r.pendingPaid.map((t) => t.name)).toEqual(['generate_music'])
    expect(r.pendingPaid[0]!.args.prompt).toMatch(/music/)
    expect(r.reply).toMatch(/press Generate/)
    expect(r.reply).not.toMatch(/\?/)
  })

  it('keeps the style word in the prompt', () => {
    const t = promoteMusicIntentFromMessage(base(), [], 'add chill music')
    expect(t[0]!.args.prompt).toBe('chill instrumental background music')
  })

  it('no double queue when the model already sent generate_music; untouched when music exists or not asked', () => {
    const g = [{ name: 'generate_music' as const, args: { prompt: 'x' } }]
    expect(promoteMusicIntentFromMessage(base(), g, 'add music')).toBe(g)
    const withMusic = { ...base(), audio: { music: { generationId: 'g', volume: 0.5, duckDepth: 0.5 } } } as unknown as ClipEditsV2
    expect(promoteMusicIntentFromMessage(withMusic, [], 'add music')).toEqual([])
    expect(promoteMusicIntentFromMessage(base(), [], 'make captions bold')).toEqual([])
  })

  it('a pending paid tool replaces a confirmation question even without claim words', () => {
    const r = honestProducerReply('Should I go ahead?', 0, [{ name: 'generate_music', args: {} }], ['Pending generate_music'])
    expect(r).toMatch(/press Generate/)
  })
})
