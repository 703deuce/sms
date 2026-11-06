import { afterEach, describe, expect, it, vi } from 'vitest'
import { __setLunaImpl } from '@/lib/ai-producer-agent/luna-client'
import { runHighlightsFinisher, verifyHighlightsFinish } from '@/lib/ai-producer-agent/story-finisher'
import { Budget } from '@/lib/ai-producer-agent/budget'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import type { EditorialSelection } from '@/lib/ai-producer-agent/specialists'

vi.mock('@/lib/ai-producer-agent/log', () => ({
  logAiProducerStep: vi.fn(async () => undefined),
  redactArgs: (v: unknown) => v,
}))
vi.mock('@/lib/ai-producer-agent/tools/registry', () => ({
  runTool: vi.fn(async () => ({ ok: false, summary: 'not_used' })),
}))

const seg = (startMs: number, endMs: number, beat = 'memorable source moment') =>
  ({ startMs, endMs, beat, reason: 'interesting spoken interview evidence' })
const originals = [
  seg(300675, 323795, 'father California'),
  seg(689670, 704695, 'motorcycle ride along'),
  seg(1109485, 1183350, 'academy language'),
]
const trimmed = [
  seg(300675, 311880, 'father invitation payoff'),
  seg(691620, 704185, 'motorcycle exchange payoff'),
  seg(1124330, 1147575, 'roommates support academy'),
]
const landings = [
  { startMs: 311050, endMs: 311850, quote: 'Come on over' },
  { startMs: 703625, endMs: 704185, quote: 'he was Okay' },
  { startMs: 1146455, endMs: 1147575, quote: 'didn\'t know' },
]
const wordEvidence = [
  { w: 'So', s: 300.705, e: 300.945 },
  { w: 'I', s: 300.945, e: 301.105 },
  { w: 'reached', s: 301.105, e: 301.265 },
  { w: 'out', s: 301.265, e: 301.425 },
  { w: 'to', s: 301.425, e: 301.505 },
  { w: 'dad', s: 301.505, e: 301.825 },
  { w: 'Come', s: 311.050, e: 311.210 },
  { w: 'on', s: 311.210, e: 311.370 },
  { w: 'over.', s: 311.370, e: 311.850 },
  { w: 'So', s: 691.620, e: 691.860 },
  { w: 'he\'s', s: 691.860, e: 692.100 },
  { w: 'on', s: 692.100, e: 692.260 },
  { w: 'a', s: 692.260, e: 692.420 },
  { w: 'motorcycle.', s: 692.420, e: 693.220 },
  { w: 'he', s: 703.625, e: 703.785 },
  { w: 'was.', s: 703.785, e: 703.945 },
  { w: 'Okay.', s: 703.945, e: 704.185 },
  { w: 'And', s: 704.185, e: 704.665 },
  { w: 'Did', s: 1124.330, e: 1124.570 },
  { w: 'you', s: 1124.570, e: 1124.730 },
  { w: 'have', s: 1124.730, e: 1124.970 },
  { w: 'roommates', s: 1124.970, e: 1125.610 },
  { w: 'that', s: 1125.610, e: 1125.850 },
  { w: 'supported', s: 1125.850, e: 1126.410 },
  { w: 'that?', s: 1126.410, e: 1126.890 },
  { w: 'I', s: 1146.455, e: 1146.615 },
  { w: 'just', s: 1146.615, e: 1146.775 },
  { w: 'didn\'t', s: 1146.775, e: 1147.015 },
  { w: 'know.', s: 1147.015, e: 1147.575 },
  { w: 'read', s: 1109.515, e: 1109.835 },
  { w: 'the', s: 1109.835, e: 1109.995 },
  { w: 'policies,', s: 1109.995, e: 1110.555 },
  { w: 'And', s: 1183.110, e: 1183.350 },
].sort((a,b) => a.s - b.s)
const candidate = () => ({
  moments: trimmed.map((selection,i) => ({
    selection: { ...selection }, landing: { ...landings[i]! },
    editorialReason: 'Standalone setup with a source-backed closing line',
  })),
  editorialReason: 'Trim each distinct sourced moment separately and keep the original three moments',
})
const ctx = (): ToolCtx => ({
  runId: 'highlights-112-seconds-retest',
  sources: [{ sourceId: 'recording', rangeMs: [300000,1500000] }],
  config: { editMode: 'just_chatting_rough_cut', roughCutIntent:'highlights',targetLengthS:[50,75] },
  cache: { words: wordEvidence, momentsSummary:[],inventorySummary:{} },
} as unknown as ToolCtx)
afterEach(() => __setLunaImpl(null))

describe('Highlights Finisher: independent endings', () => {
  it('shortens the real 112s 3-moment retest to ~47 seconds without collapsing diversity', () => {
    const result = verifyHighlightsFinish(candidate(), originals, wordEvidence, [300000,1500000],[50,75])
    expect(result.selections).toHaveLength(3)
    expect(result.selections[0]!.startMs).toBe(300675)
    expect(result.selections[1]!.startMs).toBeGreaterThan(680000)
    expect(result.selections[2]!.startMs).toBeGreaterThan(1100000)
    expect(result.selections.reduce((n,s)=>n+s.endMs-s.startMs,0)/1000).toBeCloseTo(47.015,1)
  })
  it('rejects a fabricated landing or overlong third highlight', () => {
    const invented = candidate()
    invented.moments[1]!.landing = { startMs: 703945,endMs:704185,quote:'made up words' }
    expect(() => verifyHighlightsFinish(invented, originals, wordEvidence,[300000,1500000],[50,75]))
      .toThrow('highlights_finisher_unsourced_landing')
    const overlong = candidate()
    overlong.moments[2]!.selection=originals[2]!
    expect(() => verifyHighlightsFinish(overlong,originals,wordEvidence,[300000,1500000],[50,75]))
      .toThrow('highlights_finisher_kept_talk_after_landing')
  })
  it('rejects an unfinished ending or a missing curated highlight', () => {
    const dangling = candidate()
    dangling.moments[1]!.selection=seg(691620,704695)
    dangling.moments[1]!.landing={startMs:704185,endMs:704665,quote:'Okay And'}
    expect(() => verifyHighlightsFinish(dangling,originals,wordEvidence,[300000,1500000],[50,75]))
      .toThrow('highlights_finisher_mid_sentence_ending')
    const missing = candidate()
    missing.moments.splice(1,1)
    expect(() => verifyHighlightsFinish(missing,originals,wordEvidence,[300000,1500000],[50,75]))
      .toThrow('highlights_finisher_must_keep_all_curated_moments')
  })
  it('runs the additional specialist with timed words and retryable evidence validation', async () => {
    let attempts=0
    __setLunaImpl(async ({tools,messages})=>{
      expect(tools.map(t=>t.name)).toEqual(['submit_highlights_finish'])
      expect(messages[1]?.content).toContain('timedWords')
      const proposed=candidate()
      if(attempts++===0) proposed.moments[1]!.landing.quote='fictional phrase'
      return {
        message:{role:'assistant',content:null,tool_calls:[{
          id:'attempt-'+attempts,type:'function',
          function:{name:'submit_highlights_finish',arguments:JSON.stringify(proposed)},
        }]},
        usage:{prompt_tokens:80,completion_tokens:50},
      }
    })
    const result=await runHighlightsFinisher(ctx(),new Budget(),{
      logline:'Three interesting exchanges',audiencePromise:'Best moments',beats:['one','two','three'],
    }, originals as EditorialSelection[])
    expect(attempts).toBe(2)
    expect(result.selections).toHaveLength(3)
  })
})
