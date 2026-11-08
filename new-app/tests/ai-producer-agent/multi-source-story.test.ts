import {describe,expect,it,vi,afterEach} from 'vitest'
import type {ClipWord} from '@/lib/clips/edits'
import type {MultiStorySource,MultiStoryOutline} from '@/lib/ai-producer-agent/multi-source-story'
import {validateMultiStorySources,validateMultiStoryOutline,validateMultiStoryCuts,planMultiSourceStory} from '@/lib/ai-producer-agent/multi-source-story'
import {__setLunaImpl} from '@/lib/ai-producer-agent/luna-client'

const make=(id:string,project:string,offset=0):MultiStorySource=>({
  source:{sourceId:id,kind:'upload',projectId:project,
    rangeMs:[0,120_000],durationMs:120_000,title:'Interview '+id},
  words:Array.from({length:40},(_,i):ClipWord=>({
    w:'word'+i,s:offset+i*2,e:offset+i*2+1,
  })),
})
const a=make('a','proj_a'),b=make('b','proj_b'),c=make('c','proj_c')
const outline:MultiStoryOutline={title:'A shared problem',logline:'Two people reflect on failure',
  endingRule:'Conclude with a supported quote',beats:[
    {id:'setup',purpose:'introduce',sourceIds:['a']},
    {id:'conflict',purpose:'problem',sourceIds:['a','b']},
    {id:'payoff',purpose:'conclusion',sourceIds:['b']},
  ]}

afterEach(()=>__setLunaImpl(null))
describe('isolated multi-source story planner',()=>{
  it('supports 2-5 independent validated sources',()=>{
    expect(()=>validateMultiStorySources([a])).toThrow('2_to_5')
    expect(()=>validateMultiStorySources([a,b])).not.toThrow()
    expect(()=>validateMultiStorySources([a,a,c])).toThrow('duplicate')
    expect(()=>validateMultiStorySources([a,b,c])).not.toThrow()
  })
  it('rejects invented source references in the planned story',()=>{
    expect(()=>validateMultiStoryOutline({...outline,beats:[
      ...outline.beats.slice(0,2),{id:'payoff',purpose:'ending',sourceIds:['fake']},
    ]},[a,b,c])).toThrow('invalid_beat_sources')
  })
  it('preserves local word IDs per source and permits interwoven source order',()=>{
    const cuts=validateMultiStoryCuts([
      {sourceId:'a',firstWordId:2,lastWordId:4,beatId:'setup',reason:'opening'},
      {sourceId:'b',firstWordId:3,lastWordId:5,beatId:'conflict',reason:'challenge'},
      {sourceId:'a',firstWordId:8,lastWordId:10,beatId:'conflict',reason:'response'},
      {sourceId:'b',firstWordId:9,lastWordId:11,beatId:'payoff',reason:'answer'},
    ],[a,b,c],outline)
    expect(cuts.map(x=>[x.sourceId,x.startMs,x.endMs])).toEqual([
      ['a',4000,9000],['b',6000,11000],['a',16000,21000],['b',18000,23000],
    ])
    expect(cuts[0]!.sourceProjectId).toBe('proj_a')
    expect(cuts[1]!.sourceProjectId).toBe('proj_b')
  })
  it('rejects overlapping cuts from a source and fake story beats',()=>{
    expect(()=>validateMultiStoryCuts([
      {sourceId:'a',firstWordId:2,lastWordId:8,beatId:'setup',reason:'a'},
      {sourceId:'a',firstWordId:5,lastWordId:11,beatId:'conflict',reason:'b'},
      {sourceId:'b',firstWordId:3,lastWordId:5,beatId:'conflict',reason:'c'},
    ],[a,b,c],outline)).toThrow('overlapping')
    expect(()=>validateMultiStoryCuts([
      {sourceId:'a',firstWordId:2,lastWordId:3,beatId:'made-up',reason:'a'},
      {sourceId:'b',firstWordId:3,lastWordId:5,beatId:'conflict',reason:'b'},
    ],[a,b,c],outline)).toThrow('wrong_source_or_beat')
  })
  it('passes per-recording Gemini video/audio observations with full transcripts to Story and Footage',async()=>{
    const seen:Array<{name:string;payload:any}>=[]
    let n=0
    const first={...a,visualObservations:[
      {startMs:4000,endMs:8000,observation:'[coarse_3s] speaker opens a box'},
      {startMs:4500,endMs:6500,observation:'[focused_1fps] speaker reacts to damaged contents'},
    ]}
    const second={...b,visualObservations:[
      {startMs:10000,endMs:15000,observation:'[focused_1fps] speaker demonstrates repair'},
    ]}
    __setLunaImpl(async ({tools,messages})=>{
      const name=tools[0]!.name
      const payload=JSON.parse(String(messages[1]!.content))
      seen.push({name,payload})
      const args=name==='submit_multi_source_story'?outline:
        name==='submit_multi_source_footage'?{selections:[
          {sourceId:'a',firstWordId:2,lastWordId:4,beatId:'setup',reason:'opening'},
          {sourceId:'b',firstWordId:9,lastWordId:11,beatId:'payoff',reason:'ending'},
        ]}:{selectionIndices:[0,1],joinReviews:[{leftIndex:0,rightIndex:1,status:'flows',reason:'Logical transition'}],justification:'Supported progression'}
      return {message:{role:'assistant',content:null,tool_calls:[{
        id:'call_'+(++n),type:'function',function:{name,arguments:JSON.stringify(args)},
      }]}}
    })
    await planMultiSourceStory([first,second,c])
    for(const step of seen.filter(x=>x.name!=='submit_multi_source_flow')){
      expect(step.payload.sources).toHaveLength(3)
      expect(step.payload.sources[0].sourceId).toBe('a')
      expect(step.payload.sources[1].sourceId).toBe('b')
      expect(step.payload.sources[2].sourceId).toBe('c')
      expect(step.payload.sources[0].transcript).toHaveLength(40)
      expect(step.payload.sources[1].transcript).toHaveLength(40)
      expect(step.payload.sources[0].visualObservations).toEqual(first.visualObservations)
      expect(step.payload.sources[1].visualObservations).toEqual(second.visualObservations)
    }
    expect(seen.map(x=>x.name)).toEqual([
      'submit_multi_source_story','submit_multi_source_footage','submit_multi_source_flow',
    ])
  })
  it('allows a Story-approved silent visual-only source cut with exact observed bounds',()=>{
    const visual={...c,words:[],visualObservations:[
      {startMs:30000,endMs:42000,observation:'A silent experiment visibly fails'},
    ]}
    const storyboard=validateMultiStoryOutline({...outline,visualBeats:[{
      id:'c:visual_0',sourceId:'c',startMs:30000,endMs:42000,
      purpose:'show the failure instead of describing it',
    }],beats:[...outline.beats,{id:'visual',purpose:'visual proof',sourceIds:['c']}]},[a,b,visual])
    const chosen=validateMultiStoryCuts([
      {sourceId:'a',firstWordId:2,lastWordId:4,beatId:'setup',reason:'setup'},
      {sourceId:'c',kind:'visual_action',visualBeatId:'c:visual_0',
        startMs:31000,endMs:41500,beatId:'visual',reason:'show silent failure'},
    ],[a,b,visual],storyboard)
    expect(chosen[1]).toMatchObject({kind:'visual_action',sourceId:'c',
      sourceProjectId:'proj_c',startMs:31000,endMs:41500,firstWordId:-1})
    expect(()=>validateMultiStoryCuts([{
      sourceId:'c',kind:'visual_action',visualBeatId:'c:visual_0',
      startMs:29000,endMs:41500,beatId:'visual',reason:'unobserved expansion',
    }],[a,b,visual],storyboard)).toThrow('outside_observation')
  })
  it('lets Flow correct word boundaries and remove weak cuts without changing source identity',async()=>{
    let step=0
    __setLunaImpl(async ({tools})=>{
      const name=tools[0]!.name
      const args=name==='submit_multi_source_story'?outline:
        name==='submit_multi_source_footage'?{selections:[
          {sourceId:'a',firstWordId:2,lastWordId:4,beatId:'setup',reason:'begin'},
          {sourceId:'a',firstWordId:8,lastWordId:10,beatId:'conflict',reason:'weak'},
          {sourceId:'b',firstWordId:9,lastWordId:11,beatId:'payoff',reason:'ending'},
        ]}:{selectionIndices:[0,2],corrections:[{
          index:0,firstWordId:1,lastWordId:5,reason:'complete the opening thought',
        }],joinReviews:[{leftIndex:0,rightIndex:1,status:'flows',reason:'Transition completes the lesson'}],justification:'Removed repetition'}
      return {message:{role:'assistant',content:null,tool_calls:[{
        id:'call_'+(++step),type:'function',function:{name,arguments:JSON.stringify(args)},
      }]}}
    })
    const plan=await planMultiSourceStory([a,b,c])
    expect(plan.cuts).toHaveLength(2)
    expect(plan.cuts[0]).toMatchObject({sourceId:'a',sourceProjectId:'proj_a',
      startMs:2000,endMs:11000,firstWordId:1,lastWordId:5})
    expect(plan.cuts[1]).toMatchObject({sourceId:'b',startMs:18000,endMs:23000})
  })
  it('uses three separate LLM specialist passes and returns exact validated source-aware cuts',async()=>{
    let n=0
    __setLunaImpl(async ({tools})=>{
      const name=tools[0]!.name
      const args=name==='submit_multi_source_story'?outline:
        name==='submit_multi_source_footage'?{selections:[
          {sourceId:'a',firstWordId:2,lastWordId:4,beatId:'setup',reason:'opening'},
          {sourceId:'b',firstWordId:9,lastWordId:11,beatId:'payoff',reason:'ending'},
        ]}:{selectionIndices:[0,1],joinReviews:[{leftIndex:0,rightIndex:1,status:'flows',reason:'Natural close'}],justification:'Logical progression'}
      n++
      return {message:{role:'assistant',content:null,tool_calls:[{
        id:'call_'+n,type:'function',function:{name,arguments:JSON.stringify(args)},
      }]}}
    })
    const plan=await planMultiSourceStory([a,b,c])
    expect(n).toBe(3)
    expect(plan.mode).toBe('multi_source_story_v1')
    expect(plan.cuts.map(c=>c.sourceProjectId)).toEqual(['proj_a','proj_b'])
    expect(plan.estimatedDurationMs).toBe(10000)
  })
})
