import {describe,it,expect,afterEach} from 'vitest'
import type {ClipWord} from '@/lib/clips/edits'
import {__setLunaImpl} from '@/lib/ai-producer-agent/luna-client'
import {validateCleanTakeSelections,planCleanTake,type CleanTakeSource} from '@/lib/ai-producer-agent/clean-take'
import {buildMultiStoryInsertEdits} from '@/lib/ai-producer-agent/multi-source-assembly'
import {defaultEdits} from '@/lib/clips/edits'
import {insertWindows} from '@/lib/clips/editor/inserts'

const make=(id:string):CleanTakeSource=>({
  source:{sourceId:id,kind:'upload',projectId:'proj_'+id,
    rangeMs:[0,120000],durationMs:120000,title:'Raw take '+id},
  words:Array.from({length:60},(_,i):ClipWord=>({
    w:i===0?'Um,':i===5?'Wait,':i===6?'restart.':
      i===10?'Here':i===11?'is':i===12?'the':i===13?'real':
      i===14?'point.':'word_'+i,
    s:i*1.5,e:i*1.5+1,spk:0,
  })),
})
const a=make('a'),b=make('b')
afterEach(()=>__setLunaImpl(null))

describe('isolated Clean Take mode',()=>{
  it('permits a single recording and validates exact non-overlapping best-take cuts',()=>{
    expect(validateCleanTakeSelections([
      {sourceId:'a',firstWordId:10,lastWordId:14,reason:'fluent second attempt'},
      {sourceId:'a',firstWordId:20,lastWordId:29,reason:'complete following idea'},
    ],[a]).map(c=>[c.sourceId,c.startMs,c.endMs])).toEqual([
      ['a',15000,22000],['a',30000,44500],
    ])
    expect(()=>validateCleanTakeSelections([
      {sourceId:'a',firstWordId:10,lastWordId:14,reason:'good take'},
      {sourceId:'a',firstWordId:12,lastWordId:18,reason:'duplicate take'},
    ],[a])).toThrow('overlapping')
    expect(()=>validateCleanTakeSelections([
      {sourceId:'b',firstWordId:10,lastWordId:14,reason:'invalid recording'},
    ],[a])).toThrow('invalid_source')
  })
  it('selects the corrected take instead of an earlier flub and preserves speaker identity',async()=>{
    const called:string[]=[]
    __setLunaImpl(async ({tools,messages})=>{
      const tool=tools[0]!.name
      called.push(tool)
      const payload=JSON.parse(String(messages[1]!.content))
      if(tool==='submit_clean_take'){
        expect(payload.sources).toHaveLength(1)
        expect(payload.sources[0].words).toHaveLength(60)
        expect(payload.sources[0].words[5][3]).toBe('Wait,')
      }
      const args=tool==='submit_clean_take'?{
        title:'My cleaned talking head',
        summary:'One complete explanation, without abandoned retake',
        endingRule:'Conclude with the last real statement',
        droppedTakeReasons:['Initial false start at source a words 0–6'],
        selections:[
          {sourceId:'a',firstWordId:10,lastWordId:14,reason:'best second take'},
          {sourceId:'a',firstWordId:20,lastWordId:29,reason:'complete following thought'},
        ],
      }:{pass:true,issues:[]}
      return {message:{role:'assistant',content:null,tool_calls:[{
        id:'call_'+tool,type:'function',function:{name:tool,arguments:JSON.stringify(args)},
      }]}}
    })
    const result=await planCleanTake([a])
    expect(called).toEqual(['submit_clean_take','review_clean_take'])
    expect(result.plan.mode).toBe('clean_take_v1')
    expect(result.plan.cuts.map(c=>[c.sourceId,c.firstWordId,c.lastWordId]))
      .toEqual([['a',10,14],['a',20,29]])
    expect(result.droppedTakeReasons).toHaveLength(1)
    expect(result.review.pass).toBe(true)
    const edits=buildMultiStoryInsertEdits(
      defaultEdits({clipStartMs:15000,clipEndMs:22000,trimMinMs:0,trimMaxMs:120000}),
      result.plan,
      [{id:'upl_a',durationMs:120000,label:'raw.mp4'},
       {id:'upl_a',durationMs:120000,label:'raw.mp4'}],
    )
    expect(edits.trim).toEqual({in:15000,out:22000})
    expect(edits.inserts?.[0]).toMatchObject({inMs:30000,durMs:14500,append:true})
    // normalizeInserts omits audio='source' by design; the effective E5b
    // playback window MUST still carry the original selected recording audio.
    expect(insertWindows([[15000,22000]],edits.inserts)[0]).toMatchObject({
      inMs:30000,durMs:14500,audio:'source',startMs:7000,endMs:21500,
    })
  })
  it('allows one session to contain replacement takes from several recordings without generating a documentary',async()=>{
    __setLunaImpl(async ({tools})=>{
      const name=tools[0]!.name
      return {message:{role:'assistant',content:null,tool_calls:[{
        id:'call_'+name,type:'function',function:{name,arguments:JSON.stringify(
          name==='submit_clean_take'?{
            title:'Full script',summary:'One session from two camera takes',
            endingRule:'Complete the intended explanation',
            selections:[
              {sourceId:'a',firstWordId:10,lastWordId:14,reason:'opening'},
              {sourceId:'b',firstWordId:12,lastWordId:17,reason:'replacement paragraph'},
              {sourceId:'a',firstWordId:25,lastWordId:30,reason:'closing'},
            ],
          }:{pass:true,issues:[]},
        )},
      }]}}
    })
    const result=await planCleanTake([a,b])
    expect(result.plan.cuts.map(c=>c.sourceId)).toEqual(['a','b','a'])
    expect(result.plan.cuts.map(c=>c.sourceProjectId)).toEqual([
      'proj_a','proj_b','proj_a',
    ])
  })
  it('repairs an invalid span via model feedback instead of changing test data',async()=>{
    let calls=0
    __setLunaImpl(async ({tools})=>{
      const name=tools[0]!.name
      if(name==='submit_clean_take')calls++
      const selects=calls===1?[
        {sourceId:'a',firstWordId:17,lastWordId:16,reason:'bad order'},
      ]:[{sourceId:'a',firstWordId:10,lastWordId:14,reason:'repaired real words'}]
      return {message:{role:'assistant',content:null,tool_calls:[{
        id:'call_'+calls,type:'function',function:{
          name,arguments:JSON.stringify(name==='submit_clean_take'?{
            title:'Clean',summary:'Real',
            endingRule:'End properly',selections:selects,
          }:{pass:true,issues:[]}),
        },
      }]}}
    })
    const result=await planCleanTake([a])
    expect(calls).toBe(2)
    expect(result.plan.cuts).toHaveLength(1)
    expect(result.plan.cuts[0]!.firstWordId).toBe(10)
  })
})
