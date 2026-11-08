import { afterEach, describe, expect, it, vi } from 'vitest'
import { __setLunaImpl } from '@/lib/ai-producer-agent/luna-client'
import { Budget } from '@/lib/ai-producer-agent/budget'
import { createEditorialHandoff, runEditorialRole, completeMissingStoryVisualActions } from '@/lib/ai-producer-agent/specialists'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'

vi.mock('@/lib/ai-producer-agent/log', () => ({
  logAiProducerStep: vi.fn(async () => undefined),
  redactArgs: (args: unknown) => args,
}))
vi.mock('@/lib/ai-producer-agent/tools/registry', () => ({
  runTool: vi.fn(async () => ({ ok: false, summary: 'not_used' })),
}))

afterEach(() => __setLunaImpl(null))

describe('AI Producer specialist execution', () => {
  it('independently considers an observed silent gaming beat after Footage omitted all video actions',async()=>{
    const observations=[{sourceRangeMs:[210_000,218_000] as [number,number],
      observation:'Visible game win screen and physical celebration',
      whyInteresting:'A real victory confirms the payoff',category:'gaming',
      spokenContext:'',analysisTier:'coarse_3s' as const}]
    const words=Array.from({length:80},(_,i)=>({w:'speech',s:i,e:i+0.3}))
    let checked=0
    __setLunaImpl(async ({tools,messages})=>{
      checked++
      expect(tools.map(t=>t.name)).toEqual(['submit_story_visual_action_completion'])
      const payload=JSON.parse(String(messages[1]!.content))
      expect(payload.approvedEvents[0].sourceRangeMs).toEqual([210_000,218_000])
      expect(payload.selectedSpeechWindows).toEqual([[10_000,30_000]])
      return {message:{role:'assistant',content:null,tool_calls:[{
        id:'visual_'+checked,type:'function',
        function:{name:'submit_story_visual_action_completion',
          arguments:JSON.stringify({visualActions:[{
            visualBeatId:'visual_0',startMs:210_100,endMs:215_000,
            beat:'Observed real win',reason:'Game result is visible without dialogue',
          }],rationale:'Keep the game payoff even with no speech'}),
        },
      }]},usage:{prompt_tokens:140,completion_tokens:60}}
    })
    const ctx={runId:'visual-game',sources:[{sourceId:'recording',
      rangeMs:[0,300_000]}],cache:{words,visualEvidence:{
      coarse:observations,focused:[],metadata:{originalAudioAttached:true},
    }},config:{visualEvidenceMode:'visual_audio'}} as unknown as ToolCtx
    const result=await completeMissingStoryVisualActions(ctx,new Budget(),{
      logline:'Gaming victory',audiencePromise:'See the win',
      beats:['setup','gameplay','finish'],essentialSetup:'Actual run',
      intendedPayoff:'Actual win',endingRule:'Finish with reality',
      excludeAsides:[],highlightCriteria:'Real events',
      visualBeats:[{id:'visual_0',whyFunnyToWatch:'Real game victory',
        narrativePurpose:'Payoff'}],
    },[{startMs:10_000,endMs:30_000,beat:'setup',reason:'Spoken context'}])
    expect(checked).toBe(1)
    expect(result.selections).toMatchObject([{kind:'visual_action',
      visualBeatId:'visual_0',startMs:210_100,endMs:215_000}])
  })

  it('recovers actual game Footage submissions and retains independently observed gameplay actions after the third indexed repair',async()=>{
    const start=178894
    const words=Array.from({length:1251},(_,i)=>({
      w:'game_'+i,s:(start+i*750)/1000,e:(start+i*750+350)/1000,
    }))
    const idPairs=[
      [253,264],[306,323],[341,349],[555,559],[738,752],
      [797,809],[853,861],[882,897],[1016,1028],
      [113,1219],[1220,1231],
    ]
    const visualActions=[{
      visualBeatId:'visual_0',startMs:1_180_000,endMs:1_185_000,
      beat:'Recorded gameplay victory',reason:'Observed visual release',
    }]
    let turn=0
    __setLunaImpl(async ({tools,messages})=>{
      expect(tools.map(t=>t.name)).toContain('submit_footage_word_selections')
      const ids=idPairs.map(([firstWordId,lastWordId],i)=>({
        firstWordId,lastWordId,
        beat:i===9?'bad oversized segment':'game beat '+i,
        reason:'Recorded chronological story event',
      }))
      if(turn===1){
        // Backward word IDs from the actual second live submission.
        ids[8]={firstWordId:806,lastWordId:809,
          beat:'duplicate',reason:'Incorrect backward repeat'}
      }
      if(turn===2){
        const feedback=messages.filter(m=>m.role==='tool').at(-1)
        expect(String(feedback?.content)).toContain('retainedPassages')
        expect(String(feedback?.content)).toContain('nonoverlapping')
      }
      const actionProposal=turn===1?visualActions:[]
      turn++
      return {message:{role:'assistant',content:null,tool_calls:[{
        id:'game_'+turn,type:'function',
        function:{name:'submit_footage_word_selections',
          arguments:JSON.stringify({selections:ids,visualActions:actionProposal})},
      }]},usage:{prompt_tokens:100,completion_tokens:25}}
    })
    const ctx={
      runId:'game-recovery',sources:[{sourceId:'recording',rangeMs:[start,1378894]}],
      cache:{words,visualEvidence:{coarse:[{
        sourceRangeMs:[1_180_000,1_185_000],
        observation:'Victory cutscene on screen',
        whyInteresting:'Recorded finish',category:'gameplay',
        spokenContext:'',analysisTier:'coarse_3s',
      }],focused:[],metadata:{originalAudioAttached:true}}},
      config:{editMode:'just_chatting_rough_cut',roughCutIntent:'story',
        targetLengthS:[75,105],visualEvidenceMode:'visual_audio'},
    } as unknown as ToolCtx
    const out={index:0,outputType:'story',builder:null,notes:[]} as unknown as OutputState
    const result=await runEditorialRole(ctx,out,new Budget(),'footage',{
      fullTranscriptWordIndexed:true,fullTranscript:words.map((w,i)=>[i,w.s,w.e,w.w]),
      storyOutline:{visualBeats:[{id:'visual_0',whyFunnyToWatch:'On-screen victory',
        narrativePurpose:'True gameplay payoff'}]},
    })
    expect(turn).toBe(3)
    expect((result.selections as unknown[])).toHaveLength(10)
    expect((result.visualActions as Array<{startMs:number;endMs:number}>)[0])
      .toMatchObject({startMs:1_180_000,endMs:1_185_000})
    expect((result.selections as Array<{startMs:number;endMs:number}>)
      .every((c,i,a)=>i===0||c.startMs>=a[i-1]!.endMs)).toBe(true)
  })

  it('invokes distinct role prompts and isolated tool menus, carrying a validated handoff', async () => {
    const sequence = ['submit_story_outline', 'submit_footage_selections', 'submit_dialogue_cut_plan']
    const toolNames: string[][] = []
    const prompts: string[] = []
    const selected = [
      { startMs: 0, endMs: 110_000, beat: 'setup', reason: 'complete opening topic' },
      { startMs: 140_000, endMs: 290_000, beat: 'payoff', reason: 'complete follow-up' },
    ]
    const submissions = [
      { logline: 'A streamer explains and reacts to a story', audiencePromise: 'Understand the topic', beats: ['setup','detail','payoff'],
  intendedPayoff: 'Actual recorded result to verify',
  essentialSetup: 'Source-grounded setup',
  excludeAsides: [],
  endingRule: 'Finish on a complete resolution',
  highlightCriteria: 'Independent, compelling moments' },
      { selections: selected },
      { selections: selected },
    ]
    let index = 0
    __setLunaImpl(async ({ messages, tools }) => {
      const stage = index++
      toolNames.push(tools.map((tool) => tool.name))
      prompts.push(messages[0]!.content)
      return {
        message: {
          role: 'assistant', content: null,
          tool_calls: [{
            id: `specialist_${stage}`, type: 'function',
            function: { name: sequence[stage]!, arguments: JSON.stringify(submissions[stage]) },
          }],
        },
        usage: { prompt_tokens: 200, completion_tokens: 50 },
      }
    })
    const words = Array.from({ length: 150 }, (_, i) =>
      ({ w: 'word', s: i * 2 + 0.3, e: i * 2 + 0.8 }))
    const ctx = {
      runId: 'run1', sources: [{ sourceId:'source1', rangeMs:[0,300_000] }],
      cache: { words, momentsSummary: [{ start_s: 4, end_s: 40 }], inventorySummary: { rows: [] } },
      config: { targetLengthS: [180, 480] },
    } as unknown as ToolCtx
    const out = { index: 0, outputType:'story', builder: null, notes: [] } as unknown as OutputState
    const budget = new Budget()
    const handoff = await createEditorialHandoff(ctx, out, budget, 'Make this conversational')
    expect(handoff.outline.beats).toEqual(['setup','detail','payoff'])
    expect(handoff.footage).toHaveLength(2)
    expect(handoff.cutPlan).toEqual(selected)
    expect(prompts).toHaveLength(3)
    expect(prompts[0]).toContain('STORY EDITOR')
    expect(prompts[1]).toContain('FOOTAGE SELECTOR')
    expect(prompts[2]).toContain('DIALOGUE/CUT EDITOR')
    for (const names of toolNames) {
      expect(names).not.toContain('add_clip_segment')
      expect(names).not.toContain('create_project')
    }
    // Story now has every transcript word in its initial context and has no
    // reason to retrieve disconnected snippets.
    expect(toolNames[0]).not.toContain('get_transcript')
    expect(toolNames[0]).toContain('submit_story_outline')
    expect(toolNames[1]).toContain('analyze_visual')
    expect(toolNames[2]).toContain('get_audio_energy')
    expect(budget.steps).toBe(3)
  })
  it('delivers a coherent short cut instead of rejecting the edit for duration', async () => {
    const selected = [
      { startMs: 0, endMs: 55_000, beat: 'setup', reason: 'complete opening' },
      { startMs: 140_000, endMs: 200_000, beat: 'payoff', reason: 'complete response' },
    ]
    const submissions = [
      ['submit_story_outline', { logline: 'A story', audiencePromise: 'Context', beats: ['setup', 'detail', 'payoff'],
  intendedPayoff: 'Actual recorded result to verify',
  essentialSetup: 'Source-grounded setup',
  excludeAsides: [],
  endingRule: 'Finish on a complete resolution',
  highlightCriteria: 'Independent, compelling moments' }],
      ['submit_footage_selections', { selections: selected }],
      ['submit_dialogue_cut_plan', { selections: selected }],
    ] as const
    let callIndex = 0
    __setLunaImpl(async ({ tools }) => {
      const [name, args] = submissions[callIndex++]!
      expect(tools.some((t) => t.name === name)).toBe(true)
      return {
        message: { role: 'assistant', content: null, tool_calls: [
          { id: `short_${callIndex}`, type: 'function', function: { name, arguments: JSON.stringify(args) } },
        ] },
        usage: { prompt_tokens: 200, completion_tokens: 50 },
      }
    })
    const words = Array.from({ length: 150 }, (_, i) =>
      ({ w: 'word', s: i * 2 + 0.3, e: i * 2 + 0.8 }))
    const ctx = {
      runId: 'short-run', sources: [{ sourceId: 'source1', rangeMs: [0, 300_000] }],
      cache: { words, momentsSummary: [], inventorySummary: { rows: [] } },
      config: { targetLengthS: [180, 480] },
    } as unknown as ToolCtx
    const out = { index: 0, outputType: 'story', builder: null, notes: [] } as unknown as OutputState
    const handoff = await createEditorialHandoff(ctx, out, new Budget(), null)
    expect(callIndex).toBe(3)
    expect(handoff.cutPlan).toEqual(selected)
  })

  it('recovers an unsnappable Footage proposal without retrying seven times', async () => {
    const selected = [
      { startMs: 10_000, endMs: 20_000, beat: 'setup', reason: 'complete discussion' },
      { startMs: 140_000, endMs: 190_000, beat: 'payoff', reason: 'complete follow-up' },
    ]
    const payload = [
      ['submit_story_outline', { logline: 'Discussion', audiencePromise: 'A conversation',
        beats: ['opening', 'discussion', 'conclusion'],
  intendedPayoff: 'Actual recorded result to verify',
  essentialSetup: 'Source-grounded setup',
  excludeAsides: [],
  endingRule: 'Finish on a complete resolution',
  highlightCriteria: 'Independent, compelling moments' }],
      ['submit_footage_selections', { selections: selected }],
      ['submit_dialogue_cut_plan', { selections: selected }],
    ] as const
    let called = 0
    __setLunaImpl(async () => {
      const [name, body] = payload[called++]!
      return {
        message: { role: 'assistant', content: null, tool_calls: [{
          id: 'dense_' + called, type: 'function',
          function: { name, arguments: JSON.stringify(body) },
        }] },
        usage: { prompt_tokens: 150, completion_tokens: 50 },
      }
    })
    const dense = Array.from({ length: 350 }, (_, i) => ({
      w: 'speech', s: i * 0.12, e: i * 0.12 + 0.15,
    }))
    const second = Array.from({ length: 100 }, (_, i) => ({
      w: 'speech', s: 140 + i * 0.5, e: 140 + i * 0.5 + 0.2,
    }))
    const ctx = {
      runId: 'dense-run', sources: [{ sourceId: 'source1', rangeMs: [0, 300_000] }],
      cache: { words: [...dense, ...second], momentsSummary: [], inventorySummary: { rows: [] } },
      config: { targetLengthS: [180, 480] },
    } as unknown as ToolCtx
    const out = { index: 0, outputType: 'story', builder: null, notes: [] } as unknown as OutputState
    const handoff = await createEditorialHandoff(ctx, out, new Budget(), null)
    expect(called).toBe(3)
    expect(handoff.footage.length).toBeGreaterThan(0)
    expect(handoff.cutPlan.length).toBeGreaterThan(0)
  })

})
