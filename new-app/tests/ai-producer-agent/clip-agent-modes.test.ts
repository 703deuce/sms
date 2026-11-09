import {afterEach,describe,expect,it,vi} from 'vitest'
import {__setLunaImpl} from '@/lib/ai-producer-agent/luna-client'
import {createEditorialHandoff} from '@/lib/ai-producer-agent/specialists'
import {Budget} from '@/lib/ai-producer-agent/budget'
import type {ToolCtx} from '@/lib/ai-producer-agent/tools/registry'
import type {OutputState} from '@/lib/ai-producer-agent/orchestrator'

vi.mock('@/lib/ai-producer-agent/log',()=>({
  logAiProducerStep:vi.fn(async()=>undefined),redactArgs:(x:unknown)=>x,
}))
vi.mock('@/lib/ai-producer-agent/tools/registry',()=>({
  runTool:vi.fn(async()=>{throw Error('transcript is complete; fragment reads forbidden')}),
}))

const words=Array.from({length:600},(_,i)=>({
  w:'word',s:i*0.5+0.1,e:i*0.5+0.3,
}))
const outline={
  logline:'A speaker describes a real event from setup to payoff',
  audiencePromise:'Follow the event',
  beats:['setup','action','reaction','payoff'],
  intendedPayoff:'The source-recorded reaction',
  essentialSetup:'The opening situation',
  excludeAsides:[],endingRule:'End at the source-recorded payoff',
  highlightCriteria:'A complete self-contained event',
}
const span=(a:number,b:number)=>({
  firstWordId:a,lastWordId:b,beat:'event',
  reason:'Complete source-backed thought',
})
const joins=(n:number)=>Array.from({length:Math.max(0,n-1)},(_,i)=>({
  leftIndex:i,rightIndex:i+1,status:'flows',reason:'Complete contextual transition',
}))
const setup=(mode:'clip_moment_v1'|'clip_story_v1')=>({
  ctx:{runId:'agent-'+mode,sources:[{sourceId:'recording',rangeMs:[0,300000]}],
    cache:{words,momentsSummary:[],inventorySummary:{}},
    config:{storyMode:mode,editMode:'just_chatting_rough_cut',roughCutIntent:'story',
      targetLengthS:[50,70],visualEvidenceMode:'transcript_baseline'},
  } as unknown as ToolCtx,
  out:{index:0,outputType:'story',builder:null,notes:[]} as unknown as OutputState,
})
type Call = {name:string;payload:Record<string,unknown>;system:string;toolSchema:unknown}
function harness(footage:ReturnType<typeof span>[],options?:{
  repair?:ReturnType<typeof span>[]
  flowChanges?:Array<Record<string,unknown>>
  failFlow?:boolean
}){
  const calls:Call[]=[]
  let storyDone=false,footageCount=0,flowCount=0
  __setLunaImpl(async ({messages,tools})=>{
    const requested=tools.find(t=>t.name.startsWith('submit_'))
    const name=requested?.name??''
    const payload=JSON.parse(messages.find(m=>m.role==='user')!.content!) as Record<string,unknown>
    calls.push({name,payload,system:messages[0]!.content??'',toolSchema:requested})
    let data:Record<string,unknown>
    if(name==='submit_story_outline'){
      expect(storyDone).toBe(false);storyDone=true;data=outline
    }else if(name==='submit_footage_word_selections'){
      footageCount++
      data={selections:footageCount===1?footage:(options?.repair??footage)}
    }else if(name==='submit_story_flow_review'){
      flowCount++
      const items=payload.assembledPassages as Array<unknown>
      const changes=options?.failFlow
        ? [{passageIndex:0,action:'replace',firstWordId:100,lastWordId:115,reason:'start'},
          {passageIndex:0,action:'replace',firstWordId:180,lastWordId:219,reason:'end'}]
        : options?.flowChanges??[]
      data={assessment:'Reviewed complete source moment',joinReviews:joins(items.length),changes}
    }else throw Error('Unexpected specialist tool '+name)
    return {message:{role:'assistant',content:null,tool_calls:[{
      id:name+calls.length,type:'function',
      function:{name,arguments:JSON.stringify(data)},
    }]},usage:{prompt_tokens:200,completion_tokens:120}}
  })
  return calls
}
afterEach(()=>__setLunaImpl(null))

describe('clip-only specialist modes; original Producer untouched',()=>{
  it('a repeated invalid Flow review cannot sink one continuous moment',async()=>{
    const calls=harness([span(100,219)],{failFlow:true})
    const {ctx,out}=setup('clip_moment_v1')
    const result=await createEditorialHandoff(ctx,out,new Budget(),null)
    expect(result.cutPlan).toHaveLength(1)
    expect(result.cutPlan[0]).toMatchObject({startMs:50100,endMs:109800})
    expect(result.flowReview?.applied).toBe(false)
    expect(calls.filter(x=>x.name==='submit_story_flow_review').length).toBe(2)
    expect(calls.at(-1)?.system).toContain('SINGLE CONTINUOUS MOMENT MODE')
  })
  it('moment Flow may tighten an END but never make internal jump cuts',async()=>{
    harness([span(100,239)],{flowChanges:[
      {passageIndex:0,action:'replace',firstWordId:100,lastWordId:219,reason:'clean ending'},
    ]})
    const {ctx,out}=setup('clip_moment_v1')
    const result=await createEditorialHandoff(ctx,out,new Budget(),null)
    expect(result.cutPlan).toHaveLength(1)
    expect(result.cutPlan[0]!.endMs).toBe(109800)
    expect(result.cutPlan[0]!.startMs).toBe(50100)
  })
  it('moment length repair picks a closer valid one-take candidate',async()=>{
    const calls=harness([span(100,253)],{repair:[span(100,219)]})
    const {ctx,out}=setup('clip_moment_v1')
    const result=await createEditorialHandoff(ctx,out,new Budget(),null)
    expect(result.cutPlan).toHaveLength(1)
    expect(result.cutPlan[0]!.endMs).toBe(109800)
    expect(calls.filter(c=>c.name==='submit_footage_word_selections')).toHaveLength(2)
  })
  it('story clip uses Producer narrative baseline with passage sums and repair',async()=>{
    const footage=[span(40,65),span(140,164),span(300,325)]
    const repair=[span(40,65),span(140,175),span(230,260),span(300,325)]
    const calls=harness(footage,{repair})
    const {ctx,out}=setup('clip_story_v1')
    const result=await createEditorialHandoff(ctx,out,new Budget(),null)
    expect(result.cutPlan.length).toBeGreaterThanOrEqual(3)
    expect(result.cutPlan.reduce((n,s)=>n+(s.endMs-s.startMs),0)/1000).toBeGreaterThan(50)
    const story=calls.find(c=>c.name==='submit_story_outline')!
    expect(story.system).toContain('SHORT STORY CLIP BASELINE')
    expect(story.system).not.toContain('SHORT HIGHLIGHT OVERRIDE')
    expect(story.system).not.toContain('Keep the long-form gaming producer unchanged')
    expect(story.payload.instruction).toContain('Define the main story, intended resolution')
    const flow=calls.find(c=>c.name==='submit_story_flow_review')!
    expect(flow.system).toContain('SHORT STORY CLIP:')
    expect((flow.payload.constraints as any).targetSeconds).toEqual([50,70])
  })
  it('short complete story can publish with note instead of failing',async()=>{
    harness([span(40,65),span(140,162),span(300,322)])
    const {ctx,out}=setup('clip_story_v1')
    const result=await createEditorialHandoff(ctx,out,new Budget(),null)
    expect(result.cutPlan.length).toBeGreaterThanOrEqual(2)
    expect(out.notes.some(x=>x.includes('outside target'))).toBe(true)
  })
})
