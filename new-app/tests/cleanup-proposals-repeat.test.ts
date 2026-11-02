import { describe, expect, it } from 'vitest'
import { fillerProposals } from '@/lib/clips/editor/cleanup-proposals'
import { optInPhraseAt } from '@/lib/clips/editor/filler-opt-in'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

function w(text: string, t0: number, t1: number, extra?: Partial<EditorWord>): EditorWord {
  return {
    id: `${text}-${t0}`,
    text,
    t0Ms: t0,
    t1Ms: t1,
    isFiller: extra?.isFiller,
    fillerKind: extra?.fillerKind,
    ...extra,
  } as EditorWord
}

describe('multi-word opt-in fillers', () => {
  const words: EditorWord[] = [
    w('well', 0, 400),
    w('you', 500, 700, { isFiller: true, fillerKind: 'lexicon' }),
    w('know', 720, 900, { isFiller: true, fillerKind: 'lexicon' }),
    w('then', 1000, 1200),
    w('I', 1300, 1400, { isFiller: true, fillerKind: 'lexicon' }),
    w('mean', 1420, 1600, { isFiller: true, fillerKind: 'lexicon' }),
  ]

  it('matches you know and i mean spans when enabled', () => {
    const enabled = new Set(['you know', 'i mean'])
    expect(optInPhraseAt(words, 1, new Set(), enabled)?.phrase).toBe('you know')
    expect(optInPhraseAt(words, 4, new Set(), enabled)?.phrase).toBe('i mean')
    const props = fillerProposals(words, new Set(), { enabledOptInFillers: enabled })
    expect(props).toHaveLength(2)
    expect(props.map((p) => p.label).sort()).toEqual(['i mean', 'you know'])
  })
})

describe('repeat filler proposals', () => {
  it('merges N-way repeats and labels repeat kind', () => {
    const words: EditorWord[] = [
      w('and', 1000, 1100),
      w('and', 1120, 1220, { isFiller: true, fillerKind: 'repeat' }),
      w('and', 1240, 1340, { isFiller: true, fillerKind: 'repeat' }),
      w('and', 1360, 1460, { isFiller: true, fillerKind: 'repeat' }),
      w('then', 2000, 2200),
    ]
    const props = fillerProposals(words, new Set(), { strength: 'normal' })
    expect(props).toHaveLength(1)
    expect(props[0]?.kind).toBe('repeat')
    expect(props[0]?.label).toMatch(/repeat · "and and and"/)
    expect(props[0]?.range).toEqual([1120, 1460])
  })

  it('pairs like like stutter', () => {
    const words: EditorWord[] = [
      w('like', 100, 200),
      w('like', 220, 320, { isFiller: true, fillerKind: 'repeat' }),
      w('this', 400, 500),
    ]
    const props = fillerProposals(words, new Set(), { strength: 'normal' })
    expect(props[0]?.kind).toBe('repeat')
  })
})
