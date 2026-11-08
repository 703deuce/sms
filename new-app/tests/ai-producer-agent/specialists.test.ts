import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai-producer-agent/tools/registry', () => ({
  runTool: vi.fn(),
}))
vi.mock('@/lib/ai-producer-agent/log', () => ({
  logAiProducerStep: vi.fn(), redactArgs: (args: unknown) => args,
}))
import { checkEditorialSelections, snapEditorialSelections, recoverEditorialSelections, recoverFootageWordSelections, footageRecoveryQuality, resolveFootageWordSelections } from '@/lib/ai-producer-agent/specialists'
import { FILM_EDITING_THEORY, SPECIALIST_ROLES } from '@/lib/ai-producer-agent/film-theory'
import type { ClipWord } from '@/lib/clips/edits'

const words: ClipWord[] = Array.from({ length: 150 }, (_, i) => ({
  w: 'word', s: i * 2 + 0.3, e: i * 2 + 0.8,
}))
const source: [number, number] = [0, 300_000]
const approved = [
  { startMs: 0, endMs: 110_000, beat: 'setup', reason: 'complete topic' },
  { startMs: 140_000, endMs: 290_000, beat: 'payoff', reason: 'complete response' },
]
describe('AI Producer specialist editorial handoff', () => {
  it('defines separate film-trained roles with distinct responsibilities', () => {
    expect(FILM_EDITING_THEORY).toContain('emotion, story, rhythm')
    expect(FILM_EDITING_THEORY).toContain('J/L cuts')
    expect(SPECIALIST_ROLES.story).toContain('paper-edit')
    expect(SPECIALIST_ROLES.footage).toContain('FOOTAGE SELECTOR')
    expect(SPECIALIST_ROLES.dialogue).toContain('DIALOGUE/CUT EDITOR')
    expect(SPECIALIST_ROLES.assembly).toContain('PICTURE EDITOR')
    expect(SPECIALIST_ROLES.qa).toContain('QUALITY CONTROL')
  })

  it('recovers the real Super Mario gameplay Footage failure without fabricating, sorting, or including broad overlaps', () => {
    const start=178894
    const gameWords:ClipWord[]=Array.from({length:1251},(_,i)=>({
      w:'game_'+i,s:(start+i*750)/1000,e:(start+i*750+350)/1000,
    }))
    const bounds:[number,number]=[start,1378894]
    const ids=[
      [253,264],[306,323],[341,349],[555,559],[738,752],
      [797,809],[853,861],[882,897],[1016,1028],
      [113,1219],[1220,1231],
    ]
    const proposals=ids.map(([firstWordId,lastWordId],i)=>({
      firstWordId,lastWordId,beat:i===9?'broken giant acceptance':i===10?'real closing': 'beat '+i,
      reason:i===9?'invalid overlapping monster cut': 'recorded gaming story beat',
    }))
    expect(()=>resolveFootageWordSelections(proposals,gameWords,bounds))
      .toThrow('footage_nonchronological_or_overlapping_passage_9')
    const recovered=recoverFootageWordSelections(proposals,gameWords,bounds)
    expect(recovered.retainedIndices).toEqual([0,1,2,3,4,5,6,7,8,10])
    expect(recovered.rejected).toMatchObject([{index:9,
      reason:'footage_nonchronological_or_overlapping_passage'}])
    expect(recovered.selections).toHaveLength(10)
    expect(recovered.selections[9]!.endMs).toBe(Math.round(gameWords[1231]!.e*1000))
    expect(recovered.selections.every((c,i,a)=>i===0||
      c.startMs>=a[i-1]!.endMs)).toBe(true)
    // On the second actual invalid attempt word 806 revisits the time
    // already selected at 797–809; never repeat or sort it into the edit.
    const second=[...proposals.slice(0,8),{
      firstWordId:806,lastWordId:809,beat:'backwards',reason:'duplicate PB confirmation',
    },...proposals.slice(9)]
    const recoveredSecond=recoverFootageWordSelections(second,gameWords,bounds)
    expect(recoveredSecond.rejected.map(x=>x.index)).toEqual([8,9])
  })

  it('recovery never emits an authored story with its opening or ending missing', () => {
    const valid = [
      { firstWordId:1,lastWordId:5,beat:'opening',reason:'real opening' },
      { firstWordId:10,lastWordId:15,beat:'development',reason:'real middle' },
      { firstWordId:20,lastWordId:25,beat:'payoff',reason:'real ending' },
    ]
    const openingMissing=[{...valid[0],firstWordId:-1},...valid.slice(1)]
    const endingMissing=[...valid.slice(0,2),{...valid[2],lastWordId:9999}]
    const openingRecovery=recoverFootageWordSelections(openingMissing,words,source)
    const endingRecovery=recoverFootageWordSelections(endingMissing,words,source)
    expect(openingRecovery.selections).toHaveLength(2)
    expect(endingRecovery.selections).toHaveLength(2)
    expect(footageRecoveryQuality(openingRecovery,openingMissing)).toBe(-1)
    expect(footageRecoveryQuality(endingRecovery,endingMissing)).toBe(-1)
    expect(footageRecoveryQuality(recoverFootageWordSelections(valid,words,source),valid))
      .toBeGreaterThan(0)
  })

  it('ranks the proportion of genuinely valid cuts instead of rewarding noisy proposals', () => {
    const good=[
      {firstWordId:1,lastWordId:5,beat:'opening',reason:'story setup'},
      {firstWordId:20,lastWordId:25,beat:'ending',reason:'story payoff'},
    ]
    const noisy=[good[0],...Array.from({length:8},(_,i)=>({
      firstWordId:6+i,lastWordId:7+i,beat:'overlap '+i,reason:'bad duplicate cut',
    })),good[1]]
    const reliable=recoverFootageWordSelections(good,words,source)
    const unreliable=recoverFootageWordSelections(noisy,words,source)
    expect(unreliable.selections.length).toBeGreaterThan(reliable.selections.length)
    expect(footageRecoveryQuality(reliable,good))
      .toBeGreaterThan(footageRecoveryQuality(unreliable,noisy))
  })

  it('never interprets out-of-range word IDs as usable millisecond boundaries', () => {
    const bad=[{firstWordId:words.length,lastWordId:words.length+3,beat:'fake',reason:'not sourced'}]
    expect(()=>resolveFootageWordSelections(bad,words,source))
      .toThrow('footage_invalid_or_reversed_word_ids_passage_0')
    expect(recoverFootageWordSelections(bad,words,source).selections).toEqual([])
  })

  it('accepts chronological sourced whole-thought footage', () => {
    const actual = checkEditorialSelections(approved, source, words)
    expect(actual).toHaveLength(2)
    expect(actual[0].startMs).toBe(0)
  })

  it('prevents the cutting specialist from adding unapproved footage', () => {
    expect(() => checkEditorialSelections([
      { startMs: 0, endMs: 90_000, beat: 'setup', reason: 'supported' },
      { startMs: 116_000, endMs: 270_000, beat: 'payoff', reason: 'not curated' },
    ], source, words, approved)).toThrow('outside_curated')
  })

  it('rejects missing transcript, reversed cuts, and out-of-source edits', () => {
    expect(() => checkEditorialSelections([
      approved[1], approved[0],
    ], source, words)).toThrow('non_chronological')
    expect(() => checkEditorialSelections([
      { ...approved[0], startMs: -500 },
      approved[1],
    ], source, words)).toThrow('invalid_source')
    expect(() => checkEditorialSelections([
      approved[0], { ...approved[1], endMs: 320_000 },
    ], source, words)).toThrow('invalid_source')
    expect(() => checkEditorialSelections([
      { ...approved[0], startMs: 500, endMs: 10500 },
      approved[1],
    ], source, words)).toThrow('cut_inside_word')
    expect(() => checkEditorialSelections([
      approved[0],
      { ...approved[1], startMs: 296_000, endMs: 299_500 },
    ], source, words)).toThrow('no_speech_evidence')
  })

  it('repairs only sub-300ms word-edge errors and then fully revalidates', () => {
    const repaired = snapEditorialSelections([
      { ...approved[0], startMs: 500, endMs: 110_000 },
      approved[1],
    ], source, words)
    expect(repaired[0].startMs).toBe(270)
    expect(repaired[1]).toEqual(approved[1])
    expect(() => snapEditorialSelections([
      { ...approved[0], startMs: 500, endMs: 110_000 },
      { ...approved[1], startMs: 116_000 },
    ], source, words, approved)).toThrow('outside_curated')
    expect(() => snapEditorialSelections([
      { ...approved[0], startMs: -100 },
      approved[1],
    ], source, words)).toThrow('invalid_source')
  })

  it('repairs across overlapping ASR words instead of landing in another word', () => {
    const denseWords: ClipWord[] = [
      { w: 'a', s: 0.3, e: 0.8 },
      { w: 'b', s: 0.7, e: 1.2 },
      ...Array.from({ length: 12 }, (_, i) => ({ w: 'word', s: i + 2, e: i + 2.5 })),
      ...Array.from({ length: 12 }, (_, i) => ({ w: 'word', s: i + 140, e: i + 140.5 })),
    ]
    const approvedDense = [
      { ...approved[0], startMs: 740, endMs: 12_900 },
      { ...approved[1], startMs: 140_000, endMs: 150_000 },
    ]
    const fixed = snapEditorialSelections(approvedDense, source, denseWords)
    expect(fixed[0].startMs).toBe(270)
    expect(checkEditorialSelections(fixed, source, denseWords)).toEqual(fixed)
  })

  it('does not silently move more than 1.5 seconds in uninterrupted dense speech', () => {
    const denseWords: ClipWord[] = Array.from({ length: 80 }, (_, i) => ({
      w: 'word', s: i * 0.1, e: i * 0.1 + 0.14,
    }))
    expect(() => snapEditorialSelections([
      { ...approved[0], startMs: 4000, endMs: 16_000 },
      { ...approved[1], startMs: 140_000, endMs: 150_000 },
    ], source, [...denseWords, ...words.filter((w) => w.s >= 140)])).toThrow('cut_inside_word')
  })

  it('rejects microcuts below three seconds', () => {
    expect(() => checkEditorialSelections([
      { ...approved[0], endMs: 2500 }, approved[1],
    ], source, words)).toThrow('invalid_source')
  })
  it('snaps Dialogue edges rejected by the final 30ms word guard', () => {
    const crowded: ClipWord[] = [
      { w: 'So', s: 300.690, e: 300.930 },
      { w: 'heard', s: 324.680, e: 324.890 },
      { w: 'aspirations', s: 399.780, e: 400.060 },
      { w: 'was', s: 429.280, e: 429.510 },
      ...Array.from({ length: 35 }, (_, i) => ({ w: 'speech', s: 301 + i * 0.65, e: 301.4 + i * 0.65 })),
      ...Array.from({ length: 40 }, (_, i) => ({ w: 'speech', s: 401 + i * 0.65, e: 401.4 + i * 0.65 })),
    ]
    const proposed = [
      { startMs: 300_705, endMs: 324_705, beat: 'setup', reason: 'real dialogue' },
      { startMs: 399_810, endMs: 429_310, beat: 'payoff', reason: 'complete answer' },
    ]
    const windows = [
      { ...proposed[0], startMs: 300_000, endMs: 325_000 },
      { ...proposed[1], startMs: 399_000, endMs: 430_000 },
    ]
    expect(() => checkEditorialSelections(proposed, [300_000, 430_000], crowded, windows)).toThrow('cut_inside_word')
    const repaired = snapEditorialSelections(proposed, [300_000, 430_000], crowded, windows)
    expect(repaired).toHaveLength(2)
    expect(repaired.some((x, i) => x.startMs !== proposed[i]?.startMs || x.endMs !== proposed[i]?.endMs)).toBe(true)
    expect(checkEditorialSelections(repaired, [300_000, 430_000], crowded, windows)).toEqual(repaired)
  })

  it('salvages good Footage intervals when an ending has no legal gap in dense ASR', () => {
    const dense: ClipWord[] = [
      ...Array.from({ length: 1000 }, (_, i) => ({
        w: 'speech', s: 1040 + i * 0.12, e: 1040 + i * 0.12 + 0.15,
      })),
      ...Array.from({ length: 40 }, (_, i) => ({
        w: 'speech', s: 300 + i * 0.5, e: 300.2 + i * 0.5,
      })),
    ]
    const raw = [
      { startMs: 300_000, endMs: 318_000, beat: 'setup', reason: 'complete context' },
      { startMs: 1041_000, endMs: 1065_000, beat: 'payoff', reason: 'dense conversation' },
    ]
    const result = recoverEditorialSelections(raw, [300_000, 1200_000], dense)
    expect(result.selections.length).toBeGreaterThan(0)
    expect(result.selections.every((x, i, a) => i === 0 || x.startMs >= a[i - 1]!.endMs)).toBe(true)
    // An unavoidable mid-word edge is not a reason to lose the whole edit.
    expect(result.unsafeEdges).toBeGreaterThan(0)
  })

  it('drops unusable proposals but preserves chronological valid footage', () => {
    const raw = [
      approved[0],
      { ...approved[1], startMs: 320_000, endMs: 330_000 },
      approved[1],
    ]
    const result = recoverEditorialSelections(raw, source, words)
    expect(result.dropped).toBe(1)
    expect(result.selections).toEqual(approved)
  })

})
