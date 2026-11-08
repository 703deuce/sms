import {describe,expect,it} from 'vitest'
import {defaultEdits,normalizeEdits} from '@/lib/clips/edits'
import {buildMultiStoryInsertEdits} from '@/lib/ai-producer-agent/multi-source-assembly'
import type {MultiStoryPlan} from '@/lib/ai-producer-agent/multi-source-story'
import {insertWindows,insertAudio} from '@/lib/clips/editor/inserts'

const cuts=[
  {sourceId:'a',sourceProjectId:'proj_a',firstWordId:0,lastWordId:10,
    startMs:10000,endMs:16000,beatId:'setup',reason:'open'},
  {sourceId:'b',sourceProjectId:'proj_b',firstWordId:20,lastWordId:29,
    startMs:30000,endMs:38000,beatId:'problem',reason:'contrast'},
  {sourceId:'a',sourceProjectId:'proj_a',firstWordId:11,lastWordId:18,
    startMs:44000,endMs:50000,beatId:'problem',reason:'revisit'},
  {sourceId:'c',sourceProjectId:'proj_c',firstWordId:40,lastWordId:51,
    startMs:60000,endMs:70000,beatId:'payoff',reason:'end'},
]
const plan:MultiStoryPlan={
  mode:'multi_source_story_v1',
  outline:{title:'Example',logline:'One story',endingRule:'true ending',
    beats:[{id:'setup',purpose:'open',sourceIds:['a']},
      {id:'problem',purpose:'contrast',sourceIds:['a','b']},
      {id:'payoff',purpose:'end',sourceIds:['c']}]},
  cuts,estimatedDurationMs:30000,
}
const uploads=[
  {id:'upload_a',durationMs:120000,label:'A'},
  {id:'upload_b',durationMs:120000,label:'B'},
  {id:'upload_a',durationMs:120000,label:'A'},
  {id:'upload_c',durationMs:120000,label:'C'},
]

describe('multi-source finished video assembly via existing E5b renderer',()=>{
  it('builds one 16:9 base passage followed by all real source-audio inserts in story order',()=>{
    const bounds={clipStartMs:10000,clipEndMs:16000,trimMinMs:0,trimMaxMs:16000}
    const draft=buildMultiStoryInsertEdits(defaultEdits(bounds),plan,uploads)
    expect(draft.trim).toEqual({in:10000,out:16000})
    expect(draft.sources?.map(x=>x.refId)).toEqual([
      'upload_a','upload_b','upload_a','upload_c',
    ])
    expect(draft.inserts?.map(x=>[x.sourceId,x.inMs,x.durMs,insertAudio(x),x.append])).toEqual([
      ['multi_1',30000,8000,'source',true],
      ['multi_2',44000,6000,'source',true],
      ['multi_3',60000,10000,'source',true],
    ])
    const saved=normalizeEdits(draft,bounds)
    expect(saved.inserts).toHaveLength(3)
    const windows=insertWindows([[10000,16000]],saved.inserts)
    expect(windows.map(w=>[w.startMs,w.endMs])).toEqual([
      [6000,14000],[14000,20000],[20000,30000],
    ])
    expect(saved.layout.mode).toBe('full_frame')
    expect(saved.aspectRatio).toBe('16:9')
  })
  it('rejects silent clamping of a selected sentence after the uploaded video ends',()=>{
    const bounds={clipStartMs:10000,clipEndMs:16000,trimMinMs:0,trimMaxMs:16000}
    const tooShort=[uploads[0]!,{...uploads[1]!,durationMs:36000},...uploads.slice(2)]
    expect(()=>buildMultiStoryInsertEdits(defaultEdits(bounds),plan,tooShort)).toThrow('duration_clamped')
  })
})
