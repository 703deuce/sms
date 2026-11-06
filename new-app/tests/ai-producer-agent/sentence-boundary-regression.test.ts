import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/ai-producer-agent/log', () => ({
  logAiProducerStep: vi.fn(async () => undefined),
  redactArgs: (v: unknown) => v,
}))
vi.mock('@/lib/ai-producer-agent/tools/registry', () => ({
  runTool: vi.fn(async () => ({ ok: false, summary: 'unused' })),
}))
import { verifyFinishedThoughts, verifyStoryFinish } from '@/lib/ai-producer-agent/story-finisher'
import type { ClipWord } from '@/lib/clips/edits'
import type { EditorialSelection } from '@/lib/ai-producer-agent/specialists'

const make = (startMs: number, endMs: number, beat = 'interview'): EditorialSelection =>
  ({ startMs, endMs, beat, reason: 'sourced interview words' })
const words: ClipWord[] = [
  // Real word edges and spoken endings in aprun_788b211c. The full source
  // transcript has far more words; only the decision-critical rows matter.
  [310810,311050,'yeah.'], [311050,311210,'Come'],[311210,311370,'on'],
  [311370,311850,'over.'],[312170,312410,'So'],[312410,312570,'I'],
  [312570,312730,'came'],[312730,313290,'over,'],
  [315610,316010,'Christian.'],[328865,329105,'I'],[329105,329345,'wanna'],
  [329345,329585,'do.'],[330625,330945,'dreams.'],[330945,331105,'I'],
  [331105,331345,'wanted'],[331345,331505,'to'],[331505,331825,'be'],
  [391525,391765,'came'],[391765,392405,'back'],[392130,392290,'my'],
  [392290,392850,'family.'],[392850,393090,'And'],
  [593615,593855,'But'],[593855,594015,'that'],[594015,594255,"didn't"],
  [594255,594655,'discourage'],[594655,594895,'me.'],[594895,594975,'I'],
  [594975,595215,'I'],[595215,595455,'knew'],[595455,595775,'I'],
  [595775,596015,'really'],[596015,596335,'wanted'],[596335,596495,'to'],
  [596495,596655,'do,'],
  [597910,598390,"I'd"],[598390,598710,'be'],[598710,599350,'employed'],
  [600470,600710,'with'],[600710,601670,'CHP.'],
  [603590,603910,'I'],[603910,604150,'took'],[604150,604310,'the'],
  [604310,604550,'course'],[604550,604790,'with'],[604790,605190,'Stevie'],
  [605190,605830,'Daniels...'],[605830,606230,'Daniels.'],
  [607430,608070,'And,'],[608710,609030,'yeah,'],
  [609030,609270,'passed'],[609270,609430,'it'],[609430,609590,'the'],
  [609590,609830,'second'],[609830,610070,'time.'],
  [610070,610150,'That'],[610150,610310,'was'],[610310,610550,'very,'],
  [610550,610710,'very'],[610710,611190,'helpful.'],
  [611190,611350,'And'],[611350,611750,'if'],[611750,611990,'not'],
  [611990,612230,'that'],[612230,612550,'course,'],
].map(([startMs,endMs,w])=>({
  s: (startMs as number)/1000, e: (endMs as number)/1000, w: w as string,
})) as ClipWord[]

const bad = [
  make(300675,313320,'father'),make(313900,331855,'religious influence'),
  make(388535,393120,'moving'),make(593585,596685,'setback'),
  make(597880,601700,'CHP'),make(603560,612580,'test course'),
]
const fixed = [
  make(300675,311880,'father'),make(313900,330945,'religious influence'),
  make(388535,392850,'moving'),make(593585,594895,'setback'),
  make(597880,601700,'CHP'),make(603560,611190,'test course'),
]
describe('aprun_788b211c: exact sentence-boundary failures', () => {
  it('rejects each of the five dangling transcript tails independently', () => {
    for (const [index, segment] of bad.entries()) {
      if (index === 4) continue // "CHP." is a real completed sentence.
      expect(() => verifyFinishedThoughts([segment], words))
        .toThrow('finisher_incomplete_segment_0')
    }
  })
  it('accepts full-sentence end timestamps with source words unchanged', () => {
    expect(() => verifyFinishedThoughts(fixed, words)).not.toThrow()
  })
  it('prevents approving the real 51-second cut even with a verified payoff tag', () => {
    expect(() => verifyStoryFinish({
      selections: bad,
      payoff: { startMs: 609030,endMs:610070,quote:'passed it the second time' },
      editorialReason: 'This should NOT be accepted with dangling joins',
    }, bad, words, [300000,1500000],[75,105]))
      .toThrow(/finisher_incomplete_segment/)
  })
  it('accepts a normal complete sentence but not a connector or comma', () => {
    expect(() => verifyFinishedThoughts([make(597880,601700)],words)).not.toThrow()
    expect(() => verifyFinishedThoughts([make(603560,612580)],words))
      .toThrow('finisher_incomplete_segment_0')
  })
})
