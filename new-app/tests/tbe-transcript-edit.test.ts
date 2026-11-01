import { describe, expect, it } from 'vitest'
import {
  activeWordAt,
  collapseCutRuns,
  isWordIgnored,
  nextIgnoreState,
  normalizeSpeakerNames,
  paragraphStarts,
  selectionHasCuts,
  setSpeakerName,
  setWordsIgnored,
} from '@/lib/clips/editor/transcript-edit'
import { defaultEdits, editsPayloadForSave, normalizeEdits, wordsAfterEdits, type ClipEditsV2 } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 10_000, trimMinMs: 0, trimMaxMs: 10_000 }
const words = [
  { i: 0, idx: 0, w: 'I', s: 0.0, e: 0.2 },
  { i: 1, idx: 1, w: 'think', s: 0.2, e: 0.5 },
  { i: 2, idx: 2, w: 'above.', s: 0.5, e: 0.9 },
  { i: 3, idx: 3, w: 'Yeah.', s: 1.8, e: 2.1 },
  { i: 4, idx: 4, w: '100%.', s: 2.2, e: 2.8 },
  { i: 5, idx: 5, w: 'Smile.', s: 5.0, e: 5.4 },
]

describe('TBE transcript-edit (pure)', () => {
  it('setWordsIgnored on/off and meta', () => {
    const fixes = { '1': 'thinks' }
    const on = setWordsIgnored(fixes, undefined, [words[3]!], true)
    expect(on.wordFixes['3']).toBe('')
    expect(on.wordFixMeta!['3']).toEqual({ s: 1.8, w: 'Yeah.' })
    expect(on.wordFixes['1']).toBe('thinks')
    const off = setWordsIgnored(on.wordFixes, on.wordFixMeta, [words[3]!], false)
    expect(off.wordFixes['3']).toBeUndefined()
    expect(off.wordFixMeta).toBeUndefined()
    expect(off.wordFixes['1']).toBe('thinks')
  })

  it('nextIgnoreState and isWordIgnored', () => {
    expect(nextIgnoreState([words[3]!], { '3': '' })).toBe(false)
    expect(nextIgnoreState([words[3]!, words[4]!], { '3': '' })).toBe(true)
    expect(nextIgnoreState([], {})).toBe(true)
    expect(isWordIgnored(3, { '3': '' })).toBe(true)
    expect(isWordIgnored(3, {})).toBe(false)
    expect(isWordIgnored(3, { '3': 'x' })).toBe(false)
  })

  it('selectionHasCuts', () => {
    expect(selectionHasCuts([[1800, 2100]], 2000, 2500)).toBe(true)
    expect(selectionHasCuts([[1800, 2100]], 2100, 2500)).toBe(false)
  })

  it('collapseCutRuns', () => {
    const cut = (w: (typeof words)[0]) => w.i === 3 || w.i === 4
    const runs = collapseCutRuns(words, cut)
    expect(runs.map((r) => r.kind)).toEqual(['word', 'word', 'word', 'removed', 'word'])
    expect(runs[3]).toMatchObject({ kind: 'removed', range: [1800, 2800] })
    expect(collapseCutRuns([words[3]!], () => true)[0]).toMatchObject({ kind: 'removed', words: [words[3]] })
  })

  it('paragraphStarts', () => {
    const paras = paragraphStarts(words, (w) => w.w)
    expect(paras.has(3)).toBe(true)
    expect(paras.has(5)).toBe(true)
    expect(paras.has(4)).toBe(false)
    expect(paras.has(0)).toBe(false)
    const many = Array.from({ length: 61 }, (_, n) => ({ i: n, w: 'word', s: n, e: n + 0.1 }))
    expect(paragraphStarts(many, (w) => w.w).size).toBe(0)
  })

  it('activeWordAt', () => {
    expect(activeWordAt(words, 300)).toBe(1)
    expect(activeWordAt(words, 1000)).toBeNull()
    expect(activeWordAt(words, null)).toBeNull()
    expect(activeWordAt(words, NaN)).toBeNull()
    expect(activeWordAt(words, 5399)).toBe(5)
    expect(activeWordAt(words, 5400)).toBeNull()
    expect(activeWordAt([], 100)).toBeNull()
  })

  it('normalizeSpeakerNames and setSpeakerName', () => {
    expect(normalizeSpeakerNames({ A: ' Chad ', B: '   ' })).toEqual({ A: 'Chad' })
    expect(normalizeSpeakerNames({ A: 'x'.repeat(40) })!.A.length).toBe(32)
    expect(normalizeSpeakerNames({ '!!': 'x' })).toBeUndefined()
    expect(setSpeakerName({ A: 'Old' }, 'A', '  ')).toBeUndefined()
  })

  it('normalizeEdits + payload + wordsAfterEdits ignore', () => {
    const raw = { ...defaultEdits(bounds), speakerNames: { A: ' Chad ' } }
    const e = normalizeEdits(raw, bounds)
    expect(e.speakerNames).toEqual({ A: 'Chad' })
    const payload = editsPayloadForSave({ ...e, speakerNames: undefined }, bounds)
    expect(payload.speakerNames).toBeNull()
    const withIgnore: ClipEditsV2 = {
      ...e,
      wordFixes: { '3': '' },
      wordFixMeta: { '3': { s: 1.8, w: 'Yeah.' } },
    }
    const out = wordsAfterEdits(words, withIgnore)
    expect(out.words.find((w) => w.idx === 3)).toBeUndefined()
    expect(out.words.find((w) => w.idx === 4)?.s).toBe(2.2)
  })
})
