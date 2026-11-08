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
const a=make('a','proj_a'),b=make('b','proj_b')
const outline:MultiStoryOutline={title:'A shared problem',logline:'Two people reflect on failure',
  endingRule:'Conclude with a supported quote',beats:[
    {id:'setup',purpose:'introduce',sourceIds:['a']},
    {id:'conflict',purpose:'problem',sourceIds:['a','b']},
    {id:'payoff',purpose:'conclusion',sourceIds:['b']},
  ]}

afterEach(()=>__setLunaImpl(null))
describe('isolated multi-source story planner',()=>{
  it('requires 2-5 independent validated sources',()=>{
    expect(()=>validateMultiStorySources([a])).toThrow('2_to_5')
    expect(()=>validateMultiStorySources([a,a])).toThrow('duplicate')
    expect(()=>validateMultiStorySources([a,b])).not.toThrow()
  })
  it('rejects invented source references in the planned story',()=>{
    expect(()=>validateMultiStoryOutline({...outline,beats:[
      ...outline.beats.slice(0,2),{id:'payoff',purpose:'ending',sourceIds:['fake']},
    ]},[a,b])).toThrow('invalid_beat_sources')
  })
  it('preserves local word IDs per source and permits interwoven source order',()=>{
    const cuts=validateMultiStoryCuts([
      {sourceId:'a',firstWordId:2,lastWordId:4,beatId:'setup',reason:'opening'},
      {sourceId:'b',firstWordId:3,lastWordId:5,beatId:'conflict',reason:'challenge'},
      {sourceId:'a',firstWordId:8,lastWordId:10,beatId:'conflict',reason:'response'},
      {sourceId:'b',firstWordId:9,lastWordId:11,beatId:'payoff',reason:'answer'},
    ],[a,b],outline)
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
    ],[a,b],outline)).toThrow('overlapping')
    expect(()=>validateMultiStoryCuts([
      {sourceId:'a',firstWordId:2,lastWordId:3,beatId:'made-up',reason:'a'},
      {sourceId:'b',firstWordId:3,lastWordId:5,beatId:'conflict',reason:'b'},
    ],[a,b],outline)).toThrow('wrong_source_or_beat')
  })
  it('uses three separate LLM specialist passes and returns exact validated source-aware cuts',async()=>{
    let n=0
    __setLunaImpl(async ({tools})=>{
      const name=tools[0]!.name
      const args=name==='submit_multi_source_story'?outline:
        name==='submit_multi_source_footage'?{selections:[
          {sourceId:'a',firstWordId:2,lastWordId:4,beatId:'setup',reason:'opening'},
          {sourceId:'b',firstWordId:9,lastWordId:11,beatId:'payoff',reason:'ending'},
        ]}:{selectionIndices:[0,1],justification:'Logical progression'}
      n++
      return {message:{role:'assistant',content:null,tool_calls:[{
        id:'call_'+n,type:'function',function:{name,arguments:JSON.stringify(args)},
      }]}}
    })
    const plan=await planMultiSourceStory([a,b])
    expect(n).toBe(3)
    expect(plan.mode).toBe('multi_source_story_v1')
    expect(plan.cuts.map(c=>c.sourceProjectId)).toEqual(['proj_a','proj_b'])
    expect(plan.estimatedDurationMs).toBe(10000)
  })
})
