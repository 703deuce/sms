import { afterEach, describe, expect, it, vi } from 'vitest'
import { __setLunaImpl } from '@/lib/ai-producer-agent/luna-client'
import { createEditorialHandoff, completeTranscriptWords, resolveFootageWordSelections } from '@/lib/ai-producer-agent/specialists'
import { Budget } from '@/lib/ai-producer-agent/budget'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'

vi.mock('@/lib/ai-producer-agent/log',()=>({
  logAiProducerStep:vi.fn(async()=>undefined),redactArgs:(x:unknown)=>x,
}))
vi.mock('@/lib/ai-producer-agent/tools/registry',()=>({
  runTool:vi.fn(async()=>{throw Error('Full transcription already supplied; no fragments should be read')}),
}))

const outline={
  logline:'A discussion moves from problem to resolution',
  audiencePromise:'Understand what happened',
  beats:['setup','development','payoff'],
  intendedPayoff:'Passing the written test on the second attempt',
  essentialSetup:'Language struggle and initial failure',
  excludeAsides:[],endingRule:'Stop at the complete spoken resolution',
  highlightCriteria:'Standalone source-grounded moments',
}
const words=Array.from({length:600},(_,i)=>({
  w:i===599?'final-word.':'word',s:i*0.5+0.1,e:i*0.5+0.3,
}))
function context():ToolCtx{
  return {runId:'full-story',sources:[{sourceId:'recording',rangeMs:[0,300000]}],
    cache:{words,momentsSummary:[],inventorySummary:{}},
    config:{editMode:'just_chatting_rough_cut',roughCutIntent:'story',targetLengthS:[75,105]},
  } as unknown as ToolCtx
}
const output=()=>({index:0,outputType:'story',builder:null,notes:[]} as unknown as OutputState)
const selection=(firstWordId:number,lastWordId:number,beat:string)=>({
  firstWordId,lastWordId,beat,reason:'Complete sourced thought in story order',
})
const complete=[
  selection(40,95,'setup'),selection(140,193,'development'),selection(300,367,'payoff'),
]
function run(choices:typeof complete, transcriptCheck=true){
  let calls=0
  __setLunaImpl(async ({messages,tools})=>{
    const stage=calls++
    const name=stage===0?'submit_story_outline':'submit_footage_word_selections'
    expect(tools.some(t=>t.name===name)).toBe(true)
    const payload=JSON.parse(messages[1]!.content!)
    if(transcriptCheck){
      expect(payload.transcriptSamples).toBeUndefined()
      expect(payload.fullTranscript).toHaveLength(words.length)
      expect(payload.fullTranscript[599][0]).toBe(599)
      expect(payload.fullTranscript[599].at(-1)).toBe('final-word.')
    }
    if(stage===1){
      expect(payload.storyOutline.logline).toBe(outline.logline)
      expect(payload.fullTranscript[40]).toEqual([40,20100,20300,'word'])
    }
    if(stage>1)throw Error('Unexpected Finisher/Dialogue re-edit')
    return {message:{role:'assistant',content:null,tool_calls:[{
      id:'stage-'+stage,type:'function',
      function:{name,arguments:JSON.stringify(stage===0?outline:{selections:choices})},
    }]},usage:{prompt_tokens:500,completion_tokens:100}}
  })
  return ()=>calls
}
afterEach(()=>__setLunaImpl(null))

describe('full-transcript Story/Footage handoff',()=>{
  it('delivers the entire recording to Story and every timestamped word to Footage',async()=>{
    const calls=run(complete)
    const edit=await createEditorialHandoff(context(),output(),new Budget(),null)
    expect(calls()).toBe(2)
    expect(edit.cutPlan).toHaveLength(3)
    expect(edit.cutPlan).toEqual(edit.footage)
    expect(edit.cutPlan[0]).toMatchObject({startMs:20100,endMs:47800})
    expect(edit.cutPlan[2]).toMatchObject({startMs:150100,endMs:183800})
  })
  it('does not silently trim a source transcript to twelve overview windows',()=>{
    expect(completeTranscriptWords(words,false)).toHaveLength(600)
    expect(completeTranscriptWords(words,true)[599]).toEqual([599,299600,299800,'final-word.'])
  })
  it('retains one coherent long passage without forcing extra story beats',async()=>{
    const one=[selection(100,280,'complete speech')]
    const calls=run(one as typeof complete)
    const edit=await createEditorialHandoff(context(),output(),new Budget(),null)
    expect(calls()).toBe(2)
    expect(edit.cutPlan).toHaveLength(1)
    expect(edit.cutPlan[0]).toMatchObject({startMs:50100,endMs:140300})
  })
  it('applies exact selected timestamps even when ASR words overlap and no legal silence seam exists',()=>{
    const dense = Array.from({length:80},(_,i)=>({
      w:'spoken', s: 10+i*0.09, e: 10+i*0.09+0.15,
    }))
    const edit=resolveFootageWordSelections([
      selection(0,40,'dense speech'),
    ],dense,[0,20000])
    expect(edit).toHaveLength(1)
    expect(edit[0]).toMatchObject({startMs:10000,endMs:13750})
  })
  it('rejects malformed and reversed word IDs instead of treating them as timestamps',()=>{
    expect(()=>resolveFootageWordSelections([
      selection(95,40,'reversed'),selection(140,193,'another'),
    ],words,[0,300000])).toThrow('footage_invalid_or_reversed_word_ids')
    expect(()=>resolveFootageWordSelections([
      selection(9999,10000,'invalid'),
    ],words,[0,300000])).toThrow('footage_invalid_or_reversed_word_ids')
  })
  it('rejects overlapping passage selections without another agent fixing the story',()=>{
    expect(()=>resolveFootageWordSelections([
      selection(40,95,'setup'),selection(80,140,'overlap'),
    ],words,[0,300000])).toThrow('footage_nonchronological_or_overlapping_passage')
  })
})
