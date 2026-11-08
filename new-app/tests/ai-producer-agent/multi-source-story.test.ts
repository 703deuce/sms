import {describe,expect,it,vi,afterEach} from 'vitest'
import type {ClipWord} from '@/lib/clips/edits'
import type {MultiStorySource,MultiStoryOutline} from '@/lib/ai-producer-agent/multi-source-story'
import {validateMultiStorySources,validateMultiStoryOutline,validateMultiStoryCuts,planMultiSourceStory} from '@/lib/ai-producer-agent/multi-source-story'
import {__setLunaImpl} from '@/lib/ai-producer-agent/luna-client'
import {reviewMultiSourceStory,reviseMultiSourceStoryFromQa} from '@/lib/ai-producer-agent/multi-source-qa'

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
      expect(step.payload.sources[0].visualObservations).toEqual(
        first.visualObservations!.map((o,i)=>({...o,id:'a:visual_'+i})))
      expect(step.payload.sources[1].visualObservations).toEqual(
        second.visualObservations!.map((o,i)=>({...o,id:'b:visual_'+i})))
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
  it('QA examines source-tagged dialogue and silent visual-only action in final playback order',async()=>{
    let seen:any=null
    __setLunaImpl(async ({tools,messages})=>{
      seen=JSON.parse(String(messages[1]!.content))
      return {message:{role:'assistant',content:null,tool_calls:[{
        id:'qa-1',type:'function',function:{name:tools[0]!.name,
          arguments:JSON.stringify({pass:false,issues:[
            'Source b reaction could imply a false response to source a',
          ]})},
      }]}}
    })
    const source={...b,visualObservations:[{
      startMs:24000,endMs:34000,observation:'Quietly turns to a broken device',
    }]}
    const review=await reviewMultiSourceStory({
      mode:'multi_source_story_v1',outline,cuts:[
        {sourceId:'a',sourceProjectId:'proj_a',firstWordId:2,lastWordId:4,
          startMs:4000,endMs:9000,beatId:'setup',reason:'opening'},
        {sourceId:'b',sourceProjectId:'proj_b',firstWordId:-1,lastWordId:-1,
          startMs:25000,endMs:33000,beatId:'conflict',reason:'visual reaction',
          visualBeatId:'b:visual_0',kind:'visual_action'},
      ],estimatedDurationMs:13000,
    },[a,source,c])
    expect(review.pass).toBe(false)
    expect(review.issues[0]).toContain('false response')
    expect(seen.selected).toHaveLength(2)
    expect(seen.selected[1]).toMatchObject({
      sourceId:'b',kind:'visual_action',startMs:25000,endMs:33000,
      content:'Quietly turns to a broken device',
    })
  })
  it('logs the responsible specialist, invalid proposal and the accepted repair',async()=>{
    const events:import('@/lib/ai-producer-agent/multi-source-story').MultiSourceSpecialistEvent[]=[]
    let calls=0
    __setLunaImpl(async ({tools})=>{
      const name=tools[0]!.name
      const args=name==='submit_multi_source_story'
        ? ++calls===1?{...outline,beats:[...outline.beats.slice(0,2),
            {id:'payoff',purpose:'end',sourceIds:['invented_source']}]}
          :outline
        :name==='submit_multi_source_footage'?{selections:[
          {sourceId:'a',firstWordId:2,lastWordId:4,beatId:'setup',reason:'begin'},
          {sourceId:'b',firstWordId:9,lastWordId:11,beatId:'payoff',reason:'end'},
        ]}:{selectionIndices:[0,1],joinReviews:[{
          leftIndex:0,rightIndex:1,status:'flows',reason:'Honest transition',
        }],justification:'coherent'}
      return {message:{role:'assistant',content:null,tool_calls:[{
        id:'call_'+calls,type:'function',function:{name,arguments:JSON.stringify(args)},
      }]}}
    })
    const plan=await planMultiSourceStory([a,b,c],undefined,undefined,async event=>{
      events.push(event)
    })
    expect(plan.cuts).toHaveLength(2)
    expect(events.filter(e=>e.stage==='story').map(e=>e.status)).toEqual([
      'start','rejected','accepted',
    ])
    const rejected=events.find(e=>e.status==='rejected')!
    expect(rejected.stage).toBe('story')
    expect(rejected.errorCode).toBe('multisource_invalid_beat_sources')
    expect(rejected.proposalSummary?.beatsCount).toBe(3)
    expect(JSON.stringify(rejected)).not.toContain('word0')
    expect(events.filter(e=>e.status==='accepted').map(e=>e.stage)).toEqual([
      'story','footage','flow',
    ])
  })
  it('reports terminal specialist and validation cause after three failed repairs',async()=>{
    const events:import('@/lib/ai-producer-agent/multi-source-story').MultiSourceSpecialistEvent[]=[]
    __setLunaImpl(async ({tools})=>{
      const name=tools[0]!.name
      return {message:{role:'assistant',content:null,tool_calls:[{
        id:'bad',type:'function',function:{name,arguments:JSON.stringify({
          ...outline,beats:[{id:'wrong',purpose:'wrong',sourceIds:['missing']}],
        })},
      }]}}
    })
    await expect(planMultiSourceStory([a,b,c],undefined,undefined,e=>{
      events.push(e)
    })).rejects.toThrow('multisource_story_unusable_submissions:multisource_invalid_beats')
    expect(events.filter(e=>e.status==='rejected')).toHaveLength(3)
    expect(events.at(-1)).toMatchObject({
      stage:'story',status:'exhausted',attempt:3,errorCode:'multisource_invalid_beats',
    })
    expect(events.some(e=>e.stage==='footage')).toBe(false)
  })
  it('keeps source-accurate silent visuals when Flow mistakenly submits word edits for them',async()=>{
    const events:import('@/lib/ai-producer-agent/multi-source-story').MultiSourceSpecialistEvent[]=[]
    const silent={...c,words:[],visualObservations:[{
      startMs:30000,endMs:38000,observation:'Silent action establishes the stakes',
    }]}
    const visualOutline={...outline,visualBeats:[{
      id:'c:visual_0',sourceId:'c',startMs:30000,endMs:38000,
      purpose:'show what happened',
    }],beats:[...outline.beats,{id:'visual',purpose:'silent action',sourceIds:['c']}]}
    const dialogue=Array.from({length:10},(_,i)=>({
      sourceId:'a',firstWordId:i*3,lastWordId:i*3+1,
      beatId:'setup',reason:'spoken passage '+i,
    }))
    __setLunaImpl(async ({tools})=>{
      const name=tools[0]!.name
      const args=name==='submit_multi_source_story'?visualOutline:
        name==='submit_multi_source_footage'?{
          selections:dialogue,visualActions:[{
            sourceId:'c',visualBeatId:'c:visual_0',startMs:31000,endMs:37000,
            beatId:'visual',reason:'visual proof',
          }],
        }:{
          selectionIndices:Array.from({length:11},(_,i)=>i),
          corrections:[
            {index:0,firstWordId:0,lastWordId:2,reason:'complete sentence'},
            {index:10,firstWordId:4,lastWordId:9,reason:'erroneously word-edit visual'},
            {index:11,firstWordId:2,lastWordId:3,reason:'nonexistent cut'},
          ],
          joinReviews:Array.from({length:10},(_,i)=>({
            leftIndex:i,rightIndex:i+1,status:'flows',reason:'credible join',
          })),
          justification:'Keep authentic reactions and original dialogue',
        }
      return {message:{role:'assistant',content:null,tool_calls:[{
        id:'call'+name,type:'function',function:{name,arguments:JSON.stringify(args)},
      }]}}
    })
    const plan=await planMultiSourceStory([a,b,silent],undefined,undefined,e=>{
      events.push(e)
    })
    expect(plan.cuts).toHaveLength(11)
    expect(plan.cuts[0]).toMatchObject({sourceId:'a',firstWordId:0,lastWordId:2})
    expect(plan.cuts[10]).toMatchObject({kind:'visual_action',sourceId:'c',
      startMs:31000,endMs:37000,firstWordId:-1,lastWordId:-1})
    expect(events.filter(e=>e.stage==='flow'&&e.status==='rejected')).toHaveLength(0)
    expect(events.find(e=>e.stage==='flow'&&e.status==='filtered')?.proposalSummary)
      .toMatchObject({ignoredCorrections:[
        {index:10,reason:'visual_action_has_no_word_ids'},
        {index:11,reason:'nonexistent_original_passage'},
      ]})
  })
  it('bounded QA repair improves a weak opener and final statement while preserving other sources',async()=>{
    const cuts=validateMultiStoryCuts([
      {sourceId:'a',firstWordId:4,lastWordId:7,beatId:'setup',reason:'weak opening'},
      {sourceId:'b',firstWordId:8,lastWordId:12,beatId:'payoff',reason:'weak ending'},
    ],[a,b,c],outline)
    __setLunaImpl(async ({tools})=>({
      message:{role:'assistant',content:null,tool_calls:[{
        id:'qa_fix',type:'function',function:{name:tools[0]!.name,
          arguments:JSON.stringify({selectionIndices:[0,1],corrections:[
            {index:0,firstWordId:2,lastWordId:7,reason:'restore setup'},
            {index:1,firstWordId:8,lastWordId:15,reason:'finish thought'},
          ],justification:'Complete opening and ending from original recordings'}),
        },
      }]}
    }))
    const draft={mode:'multi_source_story_v1' as const,outline,cuts,
      estimatedDurationMs:cuts.reduce((n,c)=>n+c.endMs-c.startMs,0)}
    const fix=await reviseMultiSourceStoryFromQa(draft,[a,b,c],[
      'The opening begins mid-thought','The ending lacks a conclusion',
    ])
    expect(fix).toMatchObject({applied:true,removed:0,repaired:2})
    expect(fix.plan.cuts.map(c=>[c.sourceId,c.firstWordId,c.lastWordId])).toEqual([
      ['a',2,7],['b',8,15],
    ])
    expect(fix.plan.cuts[0]!.sourceProjectId).toBe('proj_a')
  })
  it('retains valid QA speech fixes when a different requested correction exceeds source context',async()=>{
    const cuts=validateMultiStoryCuts([
      {sourceId:'a',firstWordId:4,lastWordId:7,beatId:'setup',reason:'opening'},
      {sourceId:'b',firstWordId:9,lastWordId:11,beatId:'payoff',reason:'ending'},
    ],[a,b,c],outline)
    const plan={mode:'multi_source_story_v1' as const,outline,cuts,
      estimatedDurationMs:cuts.reduce((n,c)=>n+c.endMs-c.startMs,0)}
    __setLunaImpl(async ({tools})=>({
      message:{role:'assistant',content:null,tool_calls:[{
        id:'qa_partial',type:'function',function:{name:tools[0]!.name,
          arguments:JSON.stringify({selectionIndices:[0,1],corrections:[
            {index:0,firstWordId:2,lastWordId:7,reason:'complete opening'},
            {index:1,firstWordId:400,lastWordId:420,reason:'invented beyond available transcript'},
          ],justification:'Clean opening and ending'}),
        },
      }]}
    }))
    const revision=await reviseMultiSourceStoryFromQa(plan,[a,b,c],
      ['Start and end should stand alone'])
    expect(revision.applied).toBe(true)
    expect(revision.repaired).toBe(1)
    expect(revision.skippedCorrections).toEqual([{
      index:1,reason:'outside_local_word_context',
    }])
    expect(revision.plan.cuts[0]).toMatchObject({sourceId:'a',firstWordId:2,lastWordId:7})
    expect(revision.plan.cuts[1]).toMatchObject({sourceId:'b',firstWordId:9,lastWordId:11})
  })
  it('rejects a QA proposal that tries to change an observed visual-only action',async()=>{
    const visual={...c,words:[],visualObservations:[{
      startMs:30000,endMs:42000,observation:'Silent reaction',
    }]}
    const storyboard=validateMultiStoryOutline({...outline,visualBeats:[{
      id:'c:visual_0',sourceId:'c',startMs:30000,endMs:42000,
      purpose:'Show the reaction',
    }],beats:[...outline.beats,{id:'visual',purpose:'reaction',sourceIds:['c']}]},
      [a,b,visual])
    const cuts=validateMultiStoryCuts([
      {sourceId:'a',firstWordId:2,lastWordId:4,beatId:'setup',reason:'setup'},
      {sourceId:'c',kind:'visual_action',visualBeatId:'c:visual_0',
        startMs:31000,endMs:41000,beatId:'visual',reason:'real reaction'},
    ],[a,b,visual],storyboard)
    const plan={mode:'multi_source_story_v1' as const,outline:storyboard,cuts,
      estimatedDurationMs:15000}
    __setLunaImpl(async ({tools})=>({
      message:{role:'assistant',content:null,tool_calls:[{
        id:'qa_bad',type:'function',function:{name:tools[0]!.name,
          arguments:JSON.stringify({selectionIndices:[0,1],corrections:[{
            index:1,firstWordId:0,lastWordId:3,reason:'invalid change',
          }],justification:'unsafe'}),
        },
      }]}
    }))
    const revised=await reviseMultiSourceStoryFromQa(plan,[a,b,visual],
      ['Improve the transition'])
    expect(revised.applied).toBe(false)
    expect(revised.plan).toBe(plan)
    expect(revised.reason).toBe('no_changes_proposed')
    expect(revised.skippedCorrections).toEqual([{
      index:1,reason:'visual_action_has_no_word_ids',
    }])
    expect(revised.plan.cuts[1]).toMatchObject({kind:'visual_action',
      sourceId:'c',startMs:31000,endMs:41000})
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
