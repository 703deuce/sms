import { afterEach, describe, expect, it, vi } from 'vitest'
import { __setLunaImpl } from '@/lib/ai-producer-agent/luna-client'
import { createEditorialHandoff, completeTranscriptWords, resolveFootageWordSelections, applyStoryFlowChanges, storyFlowJoinEvidence, validateStoryFlowJoinReviews } from '@/lib/ai-producer-agent/specialists'
import { Budget } from '@/lib/ai-producer-agent/budget'
import { DraftEditsBuilder } from '@/lib/ai-producer-agent/draft-edits'
import { validateDraft, type ValidationCtx } from '@/lib/ai-producer-agent/validate'
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
const allJoinChecks=(n:number)=>Array.from({length:Math.max(0,n-1)},(_,i)=>({leftIndex:i,rightIndex:i+1,status:'flows',reason:'The adjacent thoughts form a complete transition'}))
function run(choices:typeof complete, transcriptCheck=true){
  let calls=0
  __setLunaImpl(async ({messages,tools})=>{
    const stage=calls++
    const name=stage===0?'submit_story_outline':stage===1?'submit_footage_word_selections':'submit_story_flow_review'
    expect(tools.some(t=>t.name===name)).toBe(true)
    const payload=JSON.parse(messages[1]!.content!)
    if(transcriptCheck){
      expect(payload.transcriptSamples).toBeUndefined()
      const source=stage===2?payload.fullOriginalTranscript:payload.fullTranscript
      expect(source).toHaveLength(words.length)
      expect(source[599][0]).toBe(599)
      expect(source[599].at(-1)).toBe('final-word.')
    }
    if(stage===1){
      expect(payload.storyOutline.logline).toBe(outline.logline)
      expect(payload.fullTranscript[40]).toEqual([40,20100,20300,'word'])
    }
    if(stage===2){
      expect(payload.assembledPassages).toHaveLength(choices.length)
      expect(payload.storyOutline.logline).toBe(outline.logline)
      expect(payload.constraints.runtimeTargetDisabled).toBe(true)
      // Golden baseline contract: the original Producer Flow tool never gains
      // 'split' and the baseline prompts never gain clip-only instructions.
      const flow=tools.find(t=>t.name==='submit_story_flow_review')
      expect((flow?.parameters as any)?.properties?.changes?.items?.properties?.action?.enum)
        .toEqual(['replace','remove'])
      expect(messages[0]!.content).not.toContain('SINGLE CONTINUOUS MOMENT MODE')
      expect(messages[0]!.content).not.toContain('SHORT STORY CLIP:')
      expect(payload.constraints).toEqual({
        runtimeTargetDisabled:true,maxPassages:24,retainGoodPassages:true,wordIdsOnly:true,
      })
    }
    if(stage===0||stage===1){
      expect(messages[0]!.content).not.toContain('SHORT STORY CLIP BASELINE')
    }
    if(stage>2)throw Error('Unexpected Finisher/Dialogue re-edit')
    return {message:{role:'assistant',content:null,tool_calls:[{
      id:'stage-'+stage,type:'function',
      function:{name,arguments:JSON.stringify(stage===0?outline:stage===1?{selections:choices}:{assessment:'All selected passages flow naturally',joinReviews:allJoinChecks(choices.length),changes:[]})},
    }]},usage:{prompt_tokens:500,completion_tokens:100}}
  })
  return ()=>calls
}
afterEach(()=>__setLunaImpl(null))

describe('full-transcript Story/Footage handoff',()=>{
  it('delivers the entire recording to Story and every timestamped word to Footage',async()=>{
    const calls=run(complete)
    const edit=await createEditorialHandoff(context(),output(),new Budget(),null)
    expect(calls()).toBe(3)
    expect(edit.cutPlan).toHaveLength(3)
    expect(edit.cutPlan).toEqual(edit.footage)
    expect(edit.cutPlan[0]).toMatchObject({startMs:20100,endMs:47800})
    expect(edit.cutPlan[2]).toMatchObject({startMs:150100,endMs:183800})
  })
  it('allows a 4-minute coherent Story selection without duration compression or another model pass',async()=>{
    const long=[selection(0,479,'complete 4-minute narrative')]
    let calls=0
    __setLunaImpl(async ({messages,tools})=>{
      const stage=calls++
      const name=stage===0?'submit_story_outline':stage===1?'submit_footage_word_selections':'submit_story_flow_review'
      expect(tools.map(t=>t.name)).toContain(name)
      expect(messages[0]!.content).toContain(stage===2 ? 'No 90-second constraint' : 'Ignore all duration targets')
      const request=JSON.parse(messages[1]!.content!)
      if(stage<2) {
        expect(request.runtimeTargetDisabled).toBe(true)
        expect(request.outputTargetSeconds).toBeUndefined()
        expect(request.fullTranscript).toHaveLength(600)
      } else {
        expect(request.constraints.runtimeTargetDisabled).toBe(true)
        expect(request.fullOriginalTranscript).toHaveLength(600)
      }
      if(stage===1){
        expect(request.selectionDurationInstruction).toContain('IGNORE runtime')
        expect(request.preferredEditInstruction).not.toContain('90 seconds')
      }
      if(stage>2)throw Error('Cannot compress, re-review, or silently retry Story')
      return {message:{role:'assistant',content:null,tool_calls:[{
        id:'long-'+stage,type:'function',
        function:{name,arguments:JSON.stringify(stage===0?outline:stage===1?{selections:long}:{assessment:'Already a complete coherent story',joinReviews:[],changes:[]})},
      }]},usage:{prompt_tokens:500,completion_tokens:100}}
    })
    const edit=await createEditorialHandoff(context(),output(),new Budget(),null)
    expect(calls).toBe(3)
    expect(edit.cutPlan).toHaveLength(1)
    expect(edit.cutPlan[0]).toMatchObject({startMs:100,endMs:239800})
    expect(edit.cutPlan[0]!.endMs-edit.cutPlan[0]!.startMs).toBeGreaterThan(200000)
  })
  it('lets Flow add missing context and keep all unrelated passages unchanged',async()=>{
    const originally=[selection(20,28,'setup'),selection(80,85,'explanation'),selection(150,165,'payoff')]
    const expected=resolveFootageWordSelections(originally,words,[0,300000])
    let stage=0
    __setLunaImpl(async ({messages,tools})=>{
      const n=stage++
      const name=n===0?'submit_story_outline':n===1?'submit_footage_word_selections':'submit_story_flow_review'
      expect(tools.some(t=>t.name===name)).toBe(true)
      if(n===2) {
        const prompt=JSON.parse(messages[1]!.content!)
        expect(prompt.fullOriginalTranscript).toHaveLength(words.length)
        expect(prompt.assembledPassages).toHaveLength(3)
        expect(prompt.assembledPassages[1]).toMatchObject({firstWordId:80,lastWordId:85})
        expect(prompt.assembledPassages[1].dialogue).toBe('word word word word word word')
      }
      if(n>2)throw Error('Unexpected extra stage')
      const args=n===0?outline:n===1?{selections:originally}:{
        assessment:'Passage 2 starts without the necessary context; the other two flow.',
        joinReviews:[{leftIndex:0,rightIndex:1,status:'needs_change',reason:'Passage 2 opening lacks setup'},
          {leftIndex:1,rightIndex:2,status:'flows',reason:'Complete neighboring thought'}],
        changes:[{passageIndex:1,action:'replace',firstWordId:72,lastWordId:85,reason:'Restore setup before the explanation'}],
      }
      return {message:{role:'assistant',content:null,tool_calls:[{
        id:'flow-stage-'+n,type:'function',function:{name,arguments:JSON.stringify(args)},
      }]},usage:{prompt_tokens:500,completion_tokens:100}}
    })
    const edit=await createEditorialHandoff(context(),output(),new Budget(),null)
    expect(stage).toBe(3)
    expect(edit.footage).toEqual(expected)
    expect(edit.cutPlan).toHaveLength(3)
    expect(edit.cutPlan[0]).toEqual(expected[0])
    expect(edit.cutPlan[1]).toMatchObject({startMs:36100,endMs:42800})
    expect(edit.cutPlan[2]).toEqual(expected[2])
    expect(edit.flowReview?.changes).toHaveLength(1)
    expect(edit.flowReview?.changes[0]).toMatchObject({passageIndex:1,action:'replace',reason:'Restore setup before the explanation'})
  })
  it('exposes every adjacent pair with actual ending and opening words',()=>{
    const joins=storyFlowJoinEvidence([
      {passageIndex:0,dialogue:'This is my context. So you may be asking,'},
      {passageIndex:1,dialogue:'That is a factor, but there is another reason.'},
      {passageIndex:2,dialogue:'I prefer PC gaming.'},
    ])
    expect(joins).toHaveLength(2)
    expect(joins[0]).toMatchObject({leftIndex:0,rightIndex:1,
      leftEnding:'This is my context. So you may be asking,',
      rightOpening:'That is a factor, but there is another reason.'})
    expect(joins[0]!.heardTogether).toContain('asking, | CUT | That is a factor')
  })
  it('rejects missing/duplicate seam coverage or an acknowledged join with no fix',()=>{
    const noChange:Array<{passageIndex:number;action:'replace'|'remove'}>=[]
    expect(()=>validateStoryFlowJoinReviews([],3,noChange)).toThrow('flow_join_reviews_missing_expected_2')
    expect(()=>validateStoryFlowJoinReviews([
      {leftIndex:0,rightIndex:1,status:'flows',reason:'good'},
      {leftIndex:0,rightIndex:1,status:'flows',reason:'duplicate'},
    ],3,noChange)).toThrow('flow_join_review_invalid_or_duplicate_index')
    expect(()=>validateStoryFlowJoinReviews([
      {leftIndex:0,rightIndex:1,status:'needs_change',reason:'Orphaned setup'},
      {leftIndex:1,rightIndex:2,status:'flows',reason:'good'},
    ],3,noChange)).toThrow('flow_unresolved_join_0_1')
    expect(validateStoryFlowJoinReviews([
      {leftIndex:0,rightIndex:1,status:'needs_change',reason:'Fix missing setup'},
      {leftIndex:1,rightIndex:2,status:'flows',reason:'good'},
    ],3,[{passageIndex:1,action:'replace'}])).toHaveLength(2)
  })
  it('allows Flow to remove an unnecessary passage without rewriting its neighbors',()=>{
    const original=resolveFootageWordSelections(complete,words,[0,300000])
    const changed=applyStoryFlowChanges([{passageIndex:1,action:'remove',reason:'Redundant detail'}],original,words,[0,300000])
    expect(changed.finalCuts).toEqual([original[0],original[2]])
    expect(changed.changes).toHaveLength(1)
  })
  it('rejects overlap, invalid word IDs, and duplicate changes rather than snapping or guessing',()=>{
    const original=resolveFootageWordSelections(complete,words,[0,300000])
    expect(()=>applyStoryFlowChanges([
      {passageIndex:1,action:'replace',firstWordId:90,lastWordId:330,reason:'overlap'},
    ],original,words,[0,300000])).toThrow('flow_overlap_after_revision')
    expect(()=>applyStoryFlowChanges([
      {passageIndex:1,action:'replace',firstWordId:9999,lastWordId:10001,reason:'invalid'},
    ],original,words,[0,300000])).toThrow('footage_invalid_or_reversed_word_ids')
    expect(()=>applyStoryFlowChanges([
      {passageIndex:1,action:'remove',reason:'a'},
      {passageIndex:1,action:'remove',reason:'b'},
    ],original,words,[0,300000])).toThrow('flow_invalid_or_duplicate_passage_index')
  })
  it('allows multiple trims within one passage only in clip story mode',()=>{
    const originals=resolveFootageWordSelections(complete,words,[0,300000])
    const split={passageIndex:1,action:'split',reason:'Remove detour',spans:[
      {firstWordId:140,lastWordId:155,reason:'setup'},
      {firstWordId:175,lastWordId:193,reason:'payoff'},
    ]}
    const outcome=applyStoryFlowChanges([split],originals,words,[0,300000],{allowSplit:true})
    expect(outcome.finalCuts).toHaveLength(4)
    expect(outcome.changes[0]?.action).toBe('split')
    expect(outcome.finalCuts[0]).toEqual(originals[0])
    expect(outcome.finalCuts[3]).toEqual(originals[2])
    expect(()=>applyStoryFlowChanges([split],originals,words,[0,300000]))
      .toThrow('flow_split_not_allowed_in_mode')
  })
  it('coalesces the production multi-replace shape only in clip story mode',()=>{
    const originals=resolveFootageWordSelections(complete,words,[0,300000])
    const changes=[
      {passageIndex:1,action:'replace',reason:'first',firstWordId:140,lastWordId:151},
      {passageIndex:1,action:'replace',reason:'second',firstWordId:180,lastWordId:193},
    ]
    expect(applyStoryFlowChanges(changes,originals,words,[0,300000],{allowSplit:true}).finalCuts).toHaveLength(4)
    expect(()=>applyStoryFlowChanges(changes,originals,words,[0,300000]))
      .toThrow('flow_invalid_or_duplicate_passage_index_1')
  })
  it('rejects overlapping, too-short and out-of-bounds split spans',()=>{
    const originals=resolveFootageWordSelections(complete,words,[0,300000])
    const one=(spans:Array<{firstWordId:number;lastWordId:number;reason:string}>)=>
      applyStoryFlowChanges([{passageIndex:1,action:'split',reason:'detour',spans}],
        originals,words,[0,300000],{allowSplit:true})
    expect(()=>one([{firstWordId:140,lastWordId:165,reason:'one'},
      {firstWordId:160,lastWordId:193,reason:'two'}])).toThrow('flow_split_overlap_passage_1')
    expect(()=>one([{firstWordId:140,lastWordId:140,reason:'one'},
      {firstWordId:180,lastWordId:193,reason:'two'}])).toThrow('flow_split_span_too_short_passage_1')
    expect(()=>one([{firstWordId:140,lastWordId:165,reason:'one'},
      {firstWordId:180,lastWordId:300,reason:'two'}])).toThrow('flow_overlap_after_revision_near_passage_')
  })
  it('preserves Producer baseline extension while clip moment can only tighten ends',()=>{
    const originals=resolveFootageWordSelections(complete,words,[0,300000])
    const expanded={passageIndex:1,action:'replace',reason:'missing setup',
      firstWordId:135,lastWordId:193}
    expect(applyStoryFlowChanges([expanded],originals,words,[0,300000]).finalCuts[1]?.startMs)
      .toBeLessThan(originals[1]!.startMs)
    expect(()=>applyStoryFlowChanges([expanded],originals,words,[0,300000],
      {allowSplit:false,momentEndTrimOnly:true})).toThrow('flow_moment_only_end_trim')
  })
  it('does not silently trim a source transcript to twelve overview windows',()=>{
    expect(completeTranscriptWords(words,false)).toHaveLength(600)
    expect(completeTranscriptWords(words,true)[599]).toEqual([599,299600,299800,'final-word.'])
  })
  it('retains one coherent long passage without forcing extra story beats',async()=>{
    const one=[selection(100,280,'complete speech')]
    const calls=run(one as typeof complete)
    const edit=await createEditorialHandoff(context(),output(),new Budget(),null)
    expect(calls()).toBe(3)
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
  it('adds short audio-only fades at selected Story joins without moving source cuts',()=>{
    const builder=new DraftEditsBuilder({clipStartMs:0,clipEndMs:120000},'recording')
    builder.preserveApprovedEdges=true
    builder.addSegment({sourceId:'recording',srcInMs:10000,srcOutMs:40000})
    builder.addSegment({sourceId:'recording',srcInMs:80000,srcOutMs:110000})
    const before=builder.snapshot()
    builder.setStoryVoiceCutFades(15)
    const after=builder.snapshot()
    expect(after.trim).toEqual(before.trim)
    expect(after.cutRanges).toEqual(before.cutRanges)
    expect(after.transitions).toEqual(before.transitions)
    const envelope=after.keyframes?.find(k=>k.target==='voice'&&k.prop==='volume')
    expect(envelope?.points).toEqual([
      {tMs:0,v:0},{tMs:15,v:100},
      {tMs:29985,v:100},{tMs:30000,v:0},{tMs:30015,v:100},
      {tMs:59985,v:100},{tMs:60000,v:0},
    ])
    expect(after.keyframes?.some(k=>k.target==='video')).toBe(false)
  })

  it('permits the 2.96-second direct Story opener while keeping older rough-cut minimum',()=>{
    const b=new DraftEditsBuilder({clipStartMs:0,clipEndMs:300000},'recording')
    b.preserveApprovedEdges=true
    b.addSegment({sourceId:'recording',srcInMs:10000,srcOutMs:12960})
    b.addSegment({sourceId:'recording',srcInMs:20000,srcOutMs:27000})
    const ctx={
      words:[],laughs:[],reactions:[],bursts:[],
      layoutAt:()=>null,outputType:'story',
      editMode:'just_chatting_rough_cut',
      sourceRangeMs:[0,300000],audioEvidenceAvailable:false,
      targetLengthS:[75,105],memeSfx:'off',payoffSrc:[],
    } as ValidationCtx
    const direct=validateDraft(b,{...ctx,directStoryWordCuts:true})
    expect(direct.hardFailures.some(i=>i.code==='segment_too_short')).toBe(false)
    const legacy=validateDraft(b,{...ctx,directStoryWordCuts:false})
    expect(legacy.hardFailures.some(i=>i.code==='segment_too_short' && i.detail==='2960ms')).toBe(true)
    expect(b.snapshot().cutRanges).toEqual([[12960,20000]])
    const overlaps=validateDraft(b,{...ctx,directStoryWordCuts:true,words:[
      {w:'opening',s:10,e:12.96},{w:'resolution',s:20,e:27},
    ]})
    expect(overlaps.warnings.filter(i=>i.code==='cut_in_word')).toHaveLength(0)
    const legacyWithGuard=validateDraft(b,{...ctx,directStoryWordCuts:false,words:[
      {w:'opening',s:10,e:12.96},{w:'resolution',s:20,e:27},
    ]})
    expect(legacyWithGuard.warnings.some(i=>i.code==='cut_in_word')).toBe(true)

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
