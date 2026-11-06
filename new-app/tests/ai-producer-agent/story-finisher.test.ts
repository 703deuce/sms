import { afterEach, describe, expect, it, vi } from 'vitest'
import { __setLunaImpl } from '@/lib/ai-producer-agent/luna-client'
import { finisherRepairHint, fullFinisherTranscript, repairFinisherEdges, runStoryFinisher, runStoryBoundaryFinisher, resolveStoryWordBoundaries, boundaryWordContext, verifyStoryFinish } from '@/lib/ai-producer-agent/story-finisher'
import { createEditorialHandoff, validateFootagePreferredEdits } from '@/lib/ai-producer-agent/specialists'
import { Budget } from '@/lib/ai-producer-agent/budget'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'

vi.mock('@/lib/ai-producer-agent/log', () => ({
  logAiProducerStep: vi.fn(async () => undefined),
  redactArgs: (v: unknown) => v,
}))
vi.mock('@/lib/ai-producer-agent/tools/registry', () => ({
  runTool: vi.fn(async () => ({ ok: false, summary: 'unused' })),
}))

const part = (startMs: number, endMs: number, beat = 'story') =>
  ({ startMs, endMs, beat, reason: 'evidenced interview' })
// Reproduce six selections across 5:00–11:39, with a 99-second tail.
const footage = [
  part(300675, 311880, 'invitation'),
  part(450670, 478885, 'English challenge'),
  part(548520, 560245, 'recruitment'),
  part(561305, 564885, 'first attempt'),
  part(566750, 600040, 'preparation'),
  part(600040, 699275, 'passed test and unrelated later discussion'),
]
const compressed = [...footage.slice(0, 5), part(600040, 608040, 'passing the test')]
const payoff = { startMs: 604000, endMs: 606200, quote: 'passed it the second time' }
const outline = {
  logline: 'How a learner recovered from a failed entrance test',
  beats: ['challenge', 'first failure', 'prepared and passed'],
  audiencePromise: 'Learn how the candidate passed on her second attempt',
  intendedPayoff: 'Passing the written test on the second attempt',
  essentialSetup: 'Language struggle and initial failure',
  excludeAsides: ['Unrelated ride-along discussion'],
  endingRule: 'Stop at the complete spoken resolution',
  highlightCriteria: 'Separate memorable moments with standalone conclusions',
}
const words = [
  ...footage.flatMap((s, i) => Array.from({ length: 6 }, (_, j) => ({
    w: 'source', s: (s.startMs + 400 + j * 350) / 1000,
    e: (s.startMs + 550 + j * 350) / 1000,
  }))),
  ...['passed', 'it', 'the', 'second', 'time.'].map((w, i) => ({
    w, s: 604.1 + i * 0.4, e: 604.3 + i * 0.4,
  })),
  { w: 'In', s: 698.1, e: 698.3 }, { w: 'the', s: 698.5, e: 698.7 },
  // Outside every selected passage: only a genuinely full transcript includes it.
  { w: 'late-discussion-context', s: 1401.1, e: 1401.4 },
]
const ctx = (): ToolCtx => ({
  runId: 'real-187s-regression',
  sources: [{ sourceId: 'recording', rangeMs: [300000, 1500000] }],
  config: { editMode: 'just_chatting_rough_cut', roughCutIntent: 'story', targetLengthS: [75, 105] },
  cache: { words, momentsSummary: [], inventorySummary: [] },
} as unknown as ToolCtx)
const out = (): OutputState => ({
  index: 0, outputType: 'story', builder: null, notes: [],
} as unknown as OutputState)
const response = (name: string, args: unknown, id: string) => ({
  message: { role: 'assistant' as const, content: null, tool_calls: [{
    id, type: 'function' as const, function: { name, arguments: JSON.stringify(args) },
  }] },
  usage: { prompt_tokens: 120, completion_tokens: 80 },
})
afterEach(() => __setLunaImpl(null))

describe('source-verified Story Finisher', () => {
  it('includes every authorized word even when transcript has more than 950 entries', () => {
    const long = Array.from({ length: 1800 }, (_, i) => ({
      w: i === 1799 ? 'very-last-word' : 'spoken',
      s: 300.1 + i * 0.6, e: 300.3 + i * 0.6,
    }))
    const full = fullFinisherTranscript(long, [300000,1500000])
    expect(full).toHaveLength(1800)
    expect(full[1799]?.[2]).toBe('very-last-word')
    expect(full[0]?.[0]).toBe(300100)
  })
  it('can extend a selected passage slightly for conversational context, never arbitrarily', () => {
    const candidate = compressed.map(s => ({ ...s }))
    candidate[1]!.startMs -= 7000
    expect(() => verifyStoryFinish({
      selections: candidate, payoff, editorialReason: 'Restore the question before the answer.',
    }, footage, words, [300000,1500000], [75,105])).not.toThrow()
    candidate[1]!.startMs -= 9000
    expect(() => verifyStoryFinish({
      selections: candidate, payoff, editorialReason: 'Too far before source selection.',
    }, footage, words, [300000,1500000], [75,105]))
      .toThrow('specialist_cut_outside_curated_footage')
  })
  it('repairs only tiny timing drift, never silently bridges excluded footage', () => {
    const allowed = [{ ...footage[0], startMs: 300000, endMs: 326880 },
      { ...footage[1], startMs: 435670, endMs: 493885 }]
    const tiny = part(326920, 331000)
    const fixed = repairFinisherEdges([tiny], allowed) as typeof footage
    expect(fixed[0]?.startMs).toBe(326920)
    expect(fixed[0]?.endMs).toBe(331000) // cannot compress below 3s by clamping
    const repairable = part(300675, 326980)
    const repaired = repairFinisherEdges([repairable], allowed) as typeof footage
    expect(repaired[0]?.endMs).toBe(326880)
    const acrossGap = part(310000, 451000)
    expect(repairFinisherEdges([acrossGap], allowed)).toEqual([acrossGap])
    const hint = finisherRepairHint([acrossGap], footage, [300000,1500000])
    expect(hint.invalid[0]).toMatchObject({ index: 0, problem: 'outside_curated_footage' })
  })
  it('keeps meaningful 1.7-second reaction cuts instead of rejecting the entire edit', () => {
    const split = [...compressed.slice(0,-1),
      part(600040,601750,'brief reaction'),part(602400,608040,'final spoken payoff')]
    const result = verifyStoryFinish({
      selections: split, payoff, editorialReason: 'Keep an intentional short reaction.',
    }, footage, words, [300000,1500000],[75,105])
    expect(result.selections).toHaveLength(split.length)
    expect(result.selections[result.selections.length-2]?.endMs).toBe(601750)
  })
  it('reports real invalid reasons instead of an empty outside-range hint', () => {
    const tooTiny = part(604000,604200)
    const missingReason = { ...part(610000,612000), reason: '' }
    const hint = finisherRepairHint([tooTiny,missingReason], footage, [300000,1500000],[75,105])
    expect(hint.invalid).toEqual(expect.arrayContaining([
      expect.objectContaining({ index: 0, problem: 'too_short_to_play' }),
      expect.objectContaining({ index: 1, problem: 'missing_beat_or_reason' }),
    ]))
    expect(hint.instruction).toContain('Repair ONLY listed')
  })
  it('accepts a complete 106.0-second near miss without losing a good story', () => {
    const near = compressed.map(s=>({ ...s }))
    near[1]!.endMs += 10000
    const result = verifyStoryFinish({
      selections: near, payoff, editorialReason: 'Preserve complete payoff and setup.',
    }, footage, words, [300000,1500000],[75,105])
    expect(result.selections.reduce((n,s)=>n+(s.endMs-s.startMs),0)/1000)
      .toBeCloseTo(106.015,2)
    near[1]!.endMs += 4000
    expect(()=>verifyStoryFinish({
      selections: near,payoff,editorialReason: 'Too far above target.',
    },footage,words,[300000,1500000],[75,105])).toThrow('finisher_still_over_target')
  })
  it('rejects a materially overlong edit rather than treating all durations as valid', () => {
    const tooLong = [...footage.slice(0, 5), part(600040, 631500)]
    // Source-grounded even when the selection extends deep into the curated tail.
    expect(() => verifyStoryFinish({
      selections: tooLong, payoff: { ...payoff, startMs: 629000, endMs: 630000, quote: 'source' },
      editorialReason: 'Still too long',
    }, footage, words, [300000,1500000], [75,105])).toThrow()
  })
  it('can use a focused rescue prompt while retaining full transcript context', async () => {
    __setLunaImpl(async ({ messages }) => {
      expect(messages[0]?.content).toContain('RECOVERY PASS')
      expect(messages[0]?.content).toContain('OMIT')
      expect(messages[1]?.content).toContain('entireAuthorizedTranscript')
      return response('submit_story_finish', {
        selections: compressed, payoff, editorialReason: 'Short sourced passages and exact ending',
      }, 'rescue')
    })
    const result = await runStoryFinisher(ctx(), new Budget(), outline, footage, 'rescue')
    expect(result.selections).toEqual(compressed)
  })
  it('compresses the 187s story to approximately 95s and ends near the real payoff', () => {
    const valid = verifyStoryFinish({
      selections: compressed, payoff,
      editorialReason: 'End after the second successful attempt; omit unrelated academy conversation.',
    }, footage, words, [300000, 1500000], [75, 105])
    expect(valid.selections).toEqual(compressed)
    expect(valid.selections.reduce((n, s) => n + s.endMs - s.startMs, 0) / 1000)
      .toBeCloseTo(96.015, 2)
    expect(valid.payoff.quote).toBe('passed it the second time')
  })
  it('rejects a fabricated payoff even if the timing seems plausible', () => {
    expect(() => verifyStoryFinish({
      selections: compressed, payoff: { ...payoff, quote: 'the DUI was dismissed' },
      editorialReason: 'Invented outcome',
    }, footage, words, [300000, 1500000], [75, 105]))
      .toThrow('finisher_unsourced_payoff_quote')
  })
  it('rejects retaining unrelated conversation or a dangling ending', () => {
    expect(() => verifyStoryFinish({
      selections: footage, payoff, editorialReason: 'Keep everything',
    }, footage, words, [300000, 1500000], [75, 105]))
      .toThrow('finisher_kept_conversation_after_payoff')
    expect(() => verifyStoryFinish({
      selections: [...footage.slice(0, 5), part(600040, 699275)],
      payoff: { startMs: 698000, endMs: 698800, quote: 'In the' },
      editorialReason: 'Mid-phrase is not a payoff',
    }, footage, words, [300000, 1500000], [75, 105]))
      .toThrow('finisher_still_over_target')
  })
  it('retries invalid evidence then returns a real sourced short edit', async () => {
    let n = 0
    __setLunaImpl(async ({ messages, tools }) => {
      expect(tools.map(t => t.name)).toEqual(['submit_story_finish'])
      expect(messages[1]?.content).toContain('entireAuthorizedTranscript')
      expect(messages[1]?.content).toContain('late-discussion-context')
      const userContext = JSON.parse(messages[1]!.content)
      expect(userContext.storyIntent).toEqual({
        intendedPayoff: outline.intendedPayoff,
        essentialSetup: outline.essentialSetup,
        excludeAsides: outline.excludeAsides,
        endingRule: outline.endingRule,
      })
      expect(userContext.outline.audiencePromise).toBe(outline.audiencePromise)
      return response('submit_story_finish', {
        selections: compressed,
        payoff: n++ === 0 ? { ...payoff, quote: 'a fabricated DUI payoff' } : payoff,
        editorialReason: 'Trim to the spoken result.',
      }, 'finish' + n)
    })
    const decision = await runStoryFinisher(ctx(), new Budget(), outline, footage)
    expect(n).toBe(2)
    expect(decision.selections).toEqual(compressed)
  })
  it('validates candidate and preferred ranges without allowing an arbitrary source extension', () => {
    const hints = footage.map((selection, index) => ({
      candidateStartMs: selection.startMs,
      candidateEndMs: selection.endMs,
      preferredStartMs: selection.startMs,
      preferredEndMs: selection.startMs + Math.min(5000, selection.endMs-selection.startMs),
      intendedPoint: 'Story beat ' + index,
      endingCue: 'Stop after the relevant thought',
    }))
    expect(validateFootagePreferredEdits(hints, footage, [300000,1500000])).toHaveLength(6)
    expect(validateFootagePreferredEdits(hints.slice(1), footage, [300000,1500000])).toHaveLength(5)
    const outside = hints.map((h, i) => i === 1 ? { ...h, preferredEndMs: h.candidateEndMs + 1000 } : h)
    expect(validateFootagePreferredEdits(outside, footage, [300000,1500000])).toHaveLength(5)
    const overlapping = hints.map((h,i) => i === 1 ? { ...h, candidateStartMs: 310000 } : h)
    expect(validateFootagePreferredEdits(overlapping, footage, [300000,1500000])).toHaveLength(6)
  })
  it('maps word IDs to safe ends, trims dangling words, and retains a valid opening', () => {
    const original = [part(1000,7000),part(10000,18000)]
    const speech = [
      {w:'This',s:1.2,e:1.5},{w:'helps.',s:5.7,e:6.0},
      {w:'And',s:6.4,e:6.65},{w:'then',s:6.7,e:6.9},
      {w:'We',s:10.2,e:10.5},{w:'finished.',s:17.5,e:17.8},
    ]
    const result=resolveStoryWordBoundaries([
      {index:0,firstWordId:0,lastWordId:1},
      {index:1,firstWordId:4,lastWordId:5},
    ],original,speech,[0,25000])
    expect(result.selections[0]!.endMs).toBe(6030)
    expect(result.selections[0]!.startMs).toBe(1170)
    expect(result.selections[1]!.endMs).toBe(17830)
    expect(result.diagnostics.every(d=>d.end==='resolved_word_id')).toBe(true)
  })
  it('restores beginning words when original edit starts mid-thought', () => {
    const original=[part(10400,16000)]
    const speech=[
      {w:'So',s:9.5,e:9.7},{w:'we',s:9.8,e:9.95},
      {w:'started',s:10.1,e:10.38},{w:'today.',s:15.5,e:15.8},
    ]
    const result=resolveStoryWordBoundaries([
      {index:0,firstWordId:0,lastWordId:3},
    ],original,speech,[0,25000])
    expect(result.selections[0]!.startMs).toBe(9470)
    expect(result.selections[0]!.endMs).toBe(15830)
  })
  it('accepts independent fixes when another passage has an invalid word ID', () => {
    const original=[part(1000,7000),part(10000,18000)]
    const speech=[
      {w:'Good',s:1.2,e:1.5},{w:'end.',s:5.7,e:6.0},
      {w:'Bad',s:10.2,e:10.4},{w:'word',s:17.5,e:17.8},
    ]
    const result=resolveStoryWordBoundaries([
      {index:0,firstWordId:0,lastWordId:1},
      {index:1,firstWordId:9999,lastWordId:9998},
    ],original,speech,[0,25000])
    expect(result.selections[0]!.endMs).toBe(6030)
    expect(result.selections[1]).toEqual(original[1])
    expect(result.diagnostics[1]!.start).toBe('invalid_or_unavailable_first_word_id')
  })
  it('handles overlapping ASR words without making an unsafe cut', () => {
    const original=[part(1000,7000)]
    const speech=[
      {w:'I',s:1.2,e:1.5},{w:'finished.',s:5.7,e:6.0},
      {w:'overlap',s:5.95,e:6.2},{w:'later',s:6.4,e:6.6},
    ]
    const result=resolveStoryWordBoundaries([
      {index:0,firstWordId:0,lastWordId:1},
    ],original,speech,[0,8000])
    expect(result.selections[0]!.endMs).toBe(6230)
  })
  it('includes full selected passage plus two entire sentences each side even for slow speech', () => {
    const speech=[
      {w:'Before.',s:0.1,e:12.0},
      {w:'Long',s:13.0,e:23.0},{w:'preceding.',s:24,e:34},
      {w:'Another',s:35,e:43},{w:'sentence.',s:44,e:52},
      {w:'Selected',s:53,e:54},{w:'thought.',s:55,e:56},
      {w:'Following',s:57,e:69},{w:'sentence.',s:70,e:80},
      {w:'Even',s:81,e:90},{w:'later.',s:91,e:100},
      {w:'Extra.',s:101,e:110},
    ]
    const selected=[part(53000,56000)]
    const context=boundaryWordContext(speech,selected,[0,112000])
    expect(context[0]!.words.map(w=>w.text)).toEqual([
      'Long','preceding.','Another','sentence.','Selected','thought.',
      'Following','sentence.','Even','later.',
    ])
    // A real 34-second late opening is legal if it belongs to nearby
    // sentences, regardless of the former 2s limit.
    const fixed=resolveStoryWordBoundaries([
      {index:0,firstWordId:1,lastWordId:5},
    ],selected,speech,[0,112000])
    expect(fixed.selections[0]!.startMs).toBe(12970)
    expect(fixed.selections[0]!.endMs).toBe(56030)
  })
  it('can trim an entire trailing sentence, not only three seconds', () => {
    const speech=[
      {w:'Important',s:10,e:12},{w:'conclusion.',s:13,e:14},
      {w:'Unrelated',s:15,e:22},{w:'tangent.',s:23,e:31},
      {w:'Next.',s:32,e:33},
    ]
    const original=[part(10000,31000)]
    const result=resolveStoryWordBoundaries([
      {index:0,firstWordId:0,lastWordId:1},
    ],original,speech,[0,35000])
    expect(result.selections[0]!.endMs).toBe(14030)
    expect(result.diagnostics[0]!.end).toBe('resolved_word_id')
  })
  it('does not use unrelated word IDs beyond the two adjacent sentences', () => {
    const speech=[
      {w:'Unrelated.',s:1,e:2},{w:'Nearby.',s:5,e:6},
      {w:'Before.',s:9,e:10},{w:'Chosen.',s:13,e:14},
      {w:'After.',s:17,e:18},{w:'Later.',s:21,e:22},
      {w:'Unrelated.',s:25,e:26},
    ]
    const selected=[part(13000,14000)]
    const result=resolveStoryWordBoundaries([
      {index:0,firstWordId:0,lastWordId:3},
    ],selected,speech,[0,30000])
    expect(result.selections[0]!.startMs).toBe(13000)
    expect(result.diagnostics[0]!.start).toBe('invalid_or_unavailable_first_word_id')
  })
  it('supplies numbered local words, not a full transcript or timestamp tool', async () => {
    const transcript=boundaryWordContext(words,compressed,[300000,1500000])
    expect(transcript).toHaveLength(compressed.length)
    expect(transcript.every(p=>p.words.every(w=>Number.isInteger(w.id)))).toBe(true)
    __setLunaImpl(async ({tools,messages})=>{
      expect(tools.map(t=>t.name)).toEqual(['submit_story_word_boundaries'])
      const context=JSON.parse(messages[1]!.content!)
      expect(context.passages).toHaveLength(compressed.length)
      expect(context.entireAuthorizedTranscript).toBeUndefined()
      expect(messages[1]?.content).not.toContain('late-discussion-context')
      return response('submit_story_word_boundaries',{passages:context.passages.map((p:{
        index:number;words:Array<{id:number;currentlyKept:boolean}>,
      })=>{
        const kept=p.words.filter(w=>w.currentlyKept)
        return {index:p.index,firstWordId:kept[0]!.id,lastWordId:kept[kept.length-1]!.id}
      })},'polish')
    })
    const result=await runStoryBoundaryFinisher(ctx(),new Budget(),outline,compressed)
    expect(result).toHaveLength(compressed.length)
    expect(result.every((r,i)=>r.startMs>=compressed[i]!.startMs-2000 &&
      r.endMs<=compressed[i]!.endMs+2000)).toBe(true)
  })
  it('Footage owns the edit; boundary Finisher is word-based and never rescouts', async () => {
    const names:string[]=[]
    __setLunaImpl(async ({tools,messages})=>{
      const name=tools[tools.length-1]!.name
      names.push(name)
      if(name==='submit_story_outline')return response(name,outline,'story')
      if(name==='submit_footage_selections')return response(name,{selections:compressed},'footage')
      if(name==='submit_story_word_boundaries'){
        const context=JSON.parse(messages[1]!.content!)
        expect(context.entireAuthorizedTranscript).toBeUndefined()
        const passages=context.passages.map((p:{
          index:number;words:Array<{id:number;currentlyKept:boolean}>,
        })=>{
          const kept=p.words.filter(w=>w.currentlyKept)
          return {index:p.index,firstWordId:kept[0]!.id,lastWordId:kept[kept.length-1]!.id}
        })
        return response(name,{passages},'polish')
      }
      if(name==='submit_dialogue_cut_plan')return response(name,{selections:compressed},'dialogue')
      throw new Error('Unexpected tool '+name)
    })
    const edit=await createEditorialHandoff(ctx(),out(),new Budget(),null)
    expect(names[0]).toBe('submit_story_outline')
    expect(names.filter(n=>n==='submit_footage_selections').length).toBeGreaterThanOrEqual(1)
    expect(names.filter(n=>n==='submit_story_word_boundaries')).toHaveLength(1)
    expect(names[names.length-1]).toBe('submit_dialogue_cut_plan')
    expect(edit.cutPlan).toHaveLength(compressed.length)
    expect(edit.cutPlan.reduce((sum,s)=>sum+s.endMs-s.startMs,0)).toBeLessThan(110000)
    expect(edit.finisher).toBeUndefined()
  })
})
