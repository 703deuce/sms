import 'server-only'

import type { ClipWord } from '@/lib/clips/edits'
import type { AiProducerSourceRef } from '@/lib/ai-producer-agent/types'
import { lunaChat } from '@/lib/ai-producer-agent/luna-client'
import type { ToolSchema } from '@/lib/ai-producer-agent/tools/schemas'

/** ISOLATED experimental mode. No legacy Story, Footage, Flow or builder calls.
 * A source is never inferred from an absolute timestamp or global word ID. */
export type MultiStorySource={
  source:AiProducerSourceRef
  words:ClipWord[]
  visualObservations?:Array<{
    startMs:number;endMs:number;observation:string
    whyInteresting?:string;category?:string;spokenContext?:string
    analysisTier?:'coarse_3s'|'focused_1fps'
  }>
}
export type MultiStoryVisualBeat={id:string;sourceId:string;startMs:number;endMs:number;purpose:string}
export type MultiStoryBeat={
  id:string
  purpose:string
  sourceIds:string[]
}
export type MultiStoryOutline={
  title:string
  logline:string
  beats:MultiStoryBeat[]
  endingRule:string
  visualBeats?:MultiStoryVisualBeat[]
}
export type MultiStoryCut={
  sourceId:string
  firstWordId:number
  lastWordId:number
  beatId:string
  reason:string
  kind?:'dialogue'|'visual_action'
  visualBeatId?:string
  startMs?:number
  endMs?:number
}
export type ExecutableMultiStoryCut=MultiStoryCut&{
  sourceProjectId:string
  startMs:number
  endMs:number
}
export type MultiStoryPlan={
  mode:'multi_source_story_v1'|'clean_take_v1'
  outline:MultiStoryOutline
  cuts:ExecutableMultiStoryCut[]
  estimatedDurationMs:number
}

const stringField={type:'string'} as const
const stringArray={type:'array',items:stringField} as const
const wordId={type:'integer',minimum:0} as const
const visualBeatSchema={type:'object',additionalProperties:false,properties:{
  id:stringField,sourceId:stringField,startMs:{type:'integer',minimum:0},
  endMs:{type:'integer',minimum:1},purpose:stringField,
},required:['id','sourceId','startMs','endMs','purpose']} as const
const visualActionSchema={type:'object',additionalProperties:false,properties:{
  sourceId:stringField,visualBeatId:stringField,startMs:{type:'integer',minimum:0},
  endMs:{type:'integer',minimum:1},beatId:stringField,reason:stringField,
},required:['sourceId','visualBeatId','startMs','endMs','beatId','reason']} as const
const storyTool:ToolSchema={
  name:'submit_multi_source_story',
  description:'Discover ONE coherent narrative from independent sources, without inventing speaker relationships.',
  parameters:{
    type:'object',additionalProperties:false,
    properties:{
      title:stringField,logline:stringField,endingRule:stringField,
      visualBeats:{type:'array',maxItems:16,items:visualBeatSchema},
      beats:{type:'array',minItems:3,maxItems:9,items:{
        type:'object',additionalProperties:false,
        properties:{id:stringField,purpose:stringField,sourceIds:stringArray},
        required:['id','purpose','sourceIds'],
      }},
    },required:['title','logline','endingRule','beats'],
  },
}
const footageTool:ToolSchema={
  name:'submit_multi_source_footage',
  description:'Choose source-aware, word-exact passages from the supplied recordings that jointly tell the approved story.',
  parameters:{
    type:'object',additionalProperties:false,
    properties:{
      visualActions:{type:'array',maxItems:16,items:visualActionSchema},
      selections:{type:'array',minItems:1,maxItems:32,items:{
        type:'object',additionalProperties:false,
        properties:{sourceId:stringField,firstWordId:wordId,lastWordId:wordId,
          beatId:stringField,reason:stringField},
        required:['sourceId','firstWordId','lastWordId','beatId','reason'],
      }},
    },required:['selections'],
  },
}
const flowTool:ToolSchema={
  name:'submit_multi_source_flow',
  description:'Order, trim and remove cross-source dialogue and visual passages, checking every transition.',
  parameters:{
    type:'object',additionalProperties:false,
    properties:{selectionIndices:{type:'array',minItems:1,maxItems:48,items:wordId},
      corrections:{type:'array',maxItems:32,items:{type:'object',additionalProperties:false,
        properties:{index:wordId,firstWordId:wordId,lastWordId:wordId,reason:stringField},
        required:['index','firstWordId','lastWordId','reason']}},
      joinReviews:{type:'array',maxItems:47,items:{type:'object',additionalProperties:false,
        properties:{leftIndex:wordId,rightIndex:wordId,
          status:{type:'string',enum:['flows','needs_change']},reason:stringField},
        required:['leftIndex','rightIndex','status','reason']}},
      justification:stringField},
    required:['selectionIndices','joinReviews','justification'],
  },
}
function object(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('multisource_invalid_object')
  return value as Record<string,unknown>
}
function nonempty(value:unknown):string{
  if(typeof value!=='string'||!value.trim())throw Error('multisource_invalid_text')
  return value.trim().slice(0,600)
}
export function validateMultiStorySources(inputs:MultiStorySource[]):void{
  if(inputs.length<2||inputs.length>5)throw Error('multisource_requires_2_to_5_sources')
  const ids=new Set<string>()
  const projects=new Set<string>()
  for(const {source,words} of inputs){
    if(!source.sourceId||ids.has(source.sourceId)||!source.projectId ||
      projects.has(source.projectId)||!source.rangeMs ||
      source.rangeMs[1]<=source.rangeMs[0])
      throw Error('multisource_source_invalid_or_duplicate')
    ids.add(source.sourceId);projects.add(source.projectId)
  }
}
export function validateMultiStoryOutline(raw:unknown,inputs:MultiStorySource[]):MultiStoryOutline{
  const obj=object(raw),ids=new Set(inputs.map(s=>s.source.sourceId))
  const beats=obj.beats
  if(!Array.isArray(beats)||beats.length<3||beats.length>9)throw Error('multisource_invalid_beats')
  const seen=new Set<string>()
  const normalized=beats.map(row=>{
    const b=object(row),id=nonempty(b.id)
    if(seen.has(id)||!Array.isArray(b.sourceIds)||!b.sourceIds.length ||
      b.sourceIds.some(v=>typeof v!=='string'||!ids.has(v)))
      throw Error('multisource_invalid_beat_sources')
    seen.add(id)
    return {id,purpose:nonempty(b.purpose),sourceIds:[...new Set(b.sourceIds as string[])]}
  })
  const observed=inputs.flatMap(({source,visualObservations})=>
    (visualObservations??[]).map((o,i)=>({sourceId:source.sourceId,
      id:source.sourceId+':visual_'+i,startMs:o.startMs,endMs:o.endMs})))
  const chosen=Array.isArray(obj.visualBeats)?obj.visualBeats:[]
  if(chosen.length>16)throw Error('multisource_too_many_visual_beats')
  const visualBeats:MultiStoryVisualBeat[]=chosen.map(v=>{
    const b=object(v),id=nonempty(b.id),sourceId=nonempty(b.sourceId)
    const candidate=observed.find(x=>x.id===id&&x.sourceId===sourceId)
    if(!candidate||candidate.startMs!==b.startMs||candidate.endMs!==b.endMs)
      throw Error('multisource_visual_beat_not_observed')
    return {id,sourceId,startMs:candidate.startMs,endMs:candidate.endMs,purpose:nonempty(b.purpose)}
  })
  if(new Set(visualBeats.map(x=>x.id)).size!==visualBeats.length)
    throw Error('multisource_duplicate_visual_beat')
  return {title:nonempty(obj.title),logline:nonempty(obj.logline),
    endingRule:nonempty(obj.endingRule),beats:normalized,visualBeats}
}
export function validateMultiStoryCuts(
  raw:unknown,inputs:MultiStorySource[],outline:MultiStoryOutline,
):ExecutableMultiStoryCut[]{
  if(!Array.isArray(raw)||raw.length<1||raw.length>48)throw Error('multisource_invalid_cut_count')
  const sources=new Map(inputs.map(s=>[s.source.sourceId,s]))
  const beats=new Map(outline.beats.map(b=>[b.id,b]))
  const selected:ExecutableMultiStoryCut[]=[]
  for(const value of raw){
    const row=object(value)
    const sourceId=nonempty(row.sourceId),beatId=nonempty(row.beatId)
    const source=sources.get(sourceId),beat=beats.get(beatId)
    if(!source||!beat||!beat.sourceIds.includes(sourceId))
      throw Error('multisource_cut_wrong_source_or_beat')
    if(row.kind==='visual_action'){
      const visualBeatId=nonempty(row.visualBeatId)
      const approved=outline.visualBeats?.find(v=>v.id===visualBeatId&&v.sourceId===sourceId)
      const startMs=row.startMs,endMs=row.endMs
      if(!approved||!Number.isInteger(startMs)||!Number.isInteger(endMs)||
        (startMs as number)<approved.startMs||(endMs as number)>approved.endMs||
        (endMs as number)-(startMs as number)<700||
        (endMs as number)-(startMs as number)>45000)
        throw Error('multisource_visual_action_outside_observation')
      const unsafe=(edge:number)=>source.words.some(w=>
        edge>Math.round(w.s*1000)+30&&edge<Math.round(w.e*1000)-30)
      if(unsafe(startMs as number)||unsafe(endMs as number))
        throw Error('multisource_visual_action_word_edge')
      selected.push({sourceId,sourceProjectId:source.source.projectId!,
        firstWordId:-1,lastWordId:-1,beatId,reason:nonempty(row.reason),
        startMs:startMs as number,endMs:endMs as number,
        kind:'visual_action',visualBeatId})
      continue
    }
    const first=row.firstWordId,last=row.lastWordId
    if(!Number.isInteger(first)||!Number.isInteger(last)||
      (first as number)<0||(last as number)<(first as number)||
      (last as number)>=source.words.length)
      throw Error('multisource_cut_word_ids_invalid')
    const startMs=Math.round(source.words[first as number]!.s*1000)
    const endMs=Math.round(source.words[last as number]!.e*1000)
    const bounds=source.source.rangeMs!
    if(startMs<bounds[0]||endMs>bounds[1]||endMs-startMs<400)
      throw Error('multisource_cut_outside_source')
    if(selected.some(s=>s.sourceId===sourceId&&
      Math.max(s.startMs,startMs)<Math.min(s.endMs,endMs)))
      throw Error('multisource_duplicate_or_overlapping_source')
    selected.push({sourceId,sourceProjectId:source.source.projectId!,
      firstWordId:first as number,lastWordId:last as number,
      beatId,reason:nonempty(row.reason),startMs,endMs})
  }
  // Do not duplicate source video/audio by overlapping a speech and silent action.
  for(let i=0;i<selected.length;i++)
    for(let j=i+1;j<selected.length;j++)
      if(selected[i]!.sourceId===selected[j]!.sourceId&&
        Math.max(selected[i]!.startMs,selected[j]!.startMs)<
        Math.min(selected[i]!.endMs,selected[j]!.endMs))
        throw Error('multisource_overlapping_visual_or_speech')
  return selected
}
/**
 * Diagnostics are intentionally small and source-safe: never persist full
 * transcripts, LLM prompts, raw responses or media URLs in step logs.
 * A failing model submission is evidence, not an instruction to change cuts.
 */
export type MultiSourceSpecialistEvent={
  stage:'story'|'footage'|'flow'
  attempt:number
  status:'start'|'accepted'|'rejected'|'exhausted'|'filtered'
  errorCode?:string
  errorDetail?:string
  toolCallPresent?:boolean
  submittedToolName?:string
  argumentBytes?:number
  proposalSummary?:Record<string,unknown>
  durationMs?:number
  tokensIn?:number
  tokensOut?:number
}
export type MultiSourceSpecialistObserver=
  (event:MultiSourceSpecialistEvent)=>Promise<void>|void

function diagnosticProposal(value:Record<string,unknown>):Record<string,unknown>{
  const selections=Array.isArray(value.selections)?value.selections:[]
  const visualActions=Array.isArray(value.visualActions)?value.visualActions:[]
  const beats=Array.isArray(value.beats)?value.beats:[]
  const indices=Array.isArray(value.selectionIndices)?value.selectionIndices:[]
  const changes=Array.isArray(value.corrections)?value.corrections:[]
  const joins=Array.isArray(value.joinReviews)?value.joinReviews:[]
  const small=(values:unknown[])=>values.slice(0,4).map(row=>{
    if(!row||typeof row!=='object')return typeof row
    const obj=row as Record<string,unknown>
    return Object.fromEntries(
      ['sourceId','beatId','visualBeatId','id','firstWordId','lastWordId',
        'startMs','endMs','index','leftIndex','rightIndex','status']
        .filter(k=>k in obj).map(k=>[k,obj[k]]))
  })
  return {
    keys:Object.keys(value).slice(0,18),
    beatsCount:beats.length,beatsSample:small(beats),
    selectionsCount:selections.length,selectionsSample:small(selections),
    visualActionsCount:visualActions.length,visualActionsSample:small(visualActions),
    selectionIndicesCount:indices.length,selectionIndicesSample:indices.slice(0,12),
    correctionsCount:changes.length,correctionsSample:small(changes),
    joinReviewsCount:joins.length,joinReviewsSample:small(joins),
  }
}
function errorCode(error:unknown):string{
  const message=String((error as Error)?.message??error)
  // Errors raised by our validators use stable snake_case identifiers.
  return /^[a-z][a-z0-9_]{2,120}$/.test(message)?message:'invalid_json_or_submission'
}
async function submit(
  tool:ToolSchema,system:string,user:unknown,
  validate:(value:Record<string,unknown>)=>unknown,
  onUsage?:(usage:import('@/lib/ai-producer-agent/luna-client').LunaUsage|undefined)=>void,
  onEvent?:MultiSourceSpecialistObserver,
):Promise<unknown>{
  const stage=tool.name==='submit_multi_source_story'?'story':
    tool.name==='submit_multi_source_footage'?'footage':'flow'
  const notify=async (event:Omit<MultiSourceSpecialistEvent,'stage'>)=>
    onEvent?.({...event,stage})
  const messages:import('@/lib/ai-producer-agent/luna-client').LunaMessage[]=[
    {role:'system',content:system},{role:'user',content:JSON.stringify(user)},
  ]
  let lastError='no_tool_call'
  await notify({attempt:0,status:'start'})
  for(let attempt=1;attempt<=3;attempt++){
    const started=Date.now()
    let response:Awaited<ReturnType<typeof lunaChat>>
    try {
      response=await lunaChat({messages,tools:[tool],toolChoice:'required'})
      onUsage?.(response.usage)
    }catch(error){
      lastError='model_request_failed'
      await notify({attempt,status:'rejected',errorCode:lastError,
        errorDetail:String((error as Error)?.message??error).slice(0,400),
        durationMs:Date.now()-started})
      // Model transport failure should not be mistaken for a validation error.
      throw Error('multisource_'+stage+'_model_request_failed')
    }
    const info={durationMs:Date.now()-started,
      tokensIn:response.usage?.prompt_tokens,
      tokensOut:response.usage?.completion_tokens}
    const call=response.message.tool_calls?.find(c=>c.function.name===tool.name)
    if(!call){
      lastError='required_tool_call_missing'
      await notify({attempt,status:'rejected',errorCode:lastError,
        toolCallPresent:false,
        submittedToolName:response.message.tool_calls?.[0]?.function.name,
        ...info})
      messages.push(response.message,
        {role:'user',content:'Call '+tool.name+' with the required schema. Do not send prose.'})
      continue
    }
    let proposal:Record<string,unknown>|undefined
    try{
      proposal=object(JSON.parse(call.function.arguments))
      const accepted=validate(proposal)
      await notify({attempt,status:'accepted',toolCallPresent:true,
        submittedToolName:call.function.name,
        argumentBytes:call.function.arguments.length,
        proposalSummary:diagnosticProposal(proposal),...info})
      return accepted
    }catch(error){
      lastError=errorCode(error)
      await notify({attempt,status:'rejected',errorCode:lastError,
        errorDetail:String((error as Error)?.message??error).slice(0,400),
        toolCallPresent:true,submittedToolName:call.function.name,
        argumentBytes:call.function.arguments.length,
        proposalSummary:proposal?diagnosticProposal(proposal):undefined,...info})
      messages.push(response.message,{
        role:'tool',tool_call_id:call.id,
        content:JSON.stringify({ok:false,error:String((error as Error)?.message??error),
          instruction:'Repair the exact invalid source IDs, word IDs, beat IDs, visual observation ranges or join reviews. Do not invent footage. Use the expected tool schema.'}),
      })
    }
  }
  await notify({attempt:3,status:'exhausted',errorCode:lastError})
  throw Error('multisource_'+stage+'_unusable_submissions:'+lastError)
}
/** Produces a validated creative decision, not an MP4. The separate
 * multi-source render pipeline must consume these source-aware cuts. */
export async function planMultiSourceStory(
  inputs:MultiStorySource[],instruction?:string,
  onUsage?:(usage:import('@/lib/ai-producer-agent/luna-client').LunaUsage|undefined)=>void,
  onEvent?:MultiSourceSpecialistObserver,
):Promise<MultiStoryPlan>{
  validateMultiStorySources(inputs)
  const evidence=inputs.map(({source,words,visualObservations})=>({
    sourceId:source.sourceId,title:source.title,
    rangeMs:source.rangeMs,
    transcript:words.map((w,i)=>[i,Math.round(w.s*1000),Math.round(w.e*1000),w.w,w.spk??null]),
    visualObservations:(visualObservations??[]).map((o,i)=>({...o,id:source.sourceId+':visual_'+i})),
  }))
  const outline=await submit(storyTool,
    'STORY DIRECTOR: Examine ALL independent recordings together before choosing ONE truthful, compelling narrative. Gemini examined video frames with ORIGINAL audio and transcript; time-aligned visual observations are first-class evidence, including silent reactions and actions. Discover what the footage supports, do not force a generic arc or equal screen time. Plan beats by STORY EVENTS and ideas rather than grouping them by recording. In press conferences or interviews, first identify reporter/interviewer questions and official/guest answers as source-local exchange units: an isolated question is NOT evidence that a different speaker in a different recording answered it. Explicitly consider revisiting an earlier source after a different recording reveals new context: a story may progress source_0 -> source_2 -> source_1 -> source_2 -> source_0, or may stay on one source for several consecutive cuts when needed. Do not switch merely to increase source diversity, and never imply unrelated interviews are a literal conversation. Explicitly nominate helpful visualBeats by observation ID, sourceId and EXACT observed start/end timestamps. Return visualBeats:[] if none. No invented conversation or conclusion.',
    {instruction:instruction??'Find the strongest complete story supported by the footage.',sources:evidence},
    a=>validateMultiStoryOutline(a,inputs),onUsage,onEvent) as MultiStoryOutline
  let visualOmissions:Array<{sourceId?:unknown;visualBeatId?:unknown;reason:string}>=[]
  const selections=await submit(footageTool,
    'FOOTAGE EDITOR: Use the entire footage evidence and story outline. Select complete dialogue by exact per-source word IDs in selections, PLUS independent source-grounded visualActions for approved Story visualBeats even if there is NO speech. Every visual action needs correct sourceId, visualBeatId, beatId and original millisecond bounds within observed event, with boundaries outside words. Prefer complete visible actions/reactions. Exclude portions already used by dialogue; never duplicate overlapping source material or invent visual actions. Collect the strongest independent source-grounded passages for EACH relevant story beat. When selecting questions from a press conference, also select the source-local response when necessary, even if it starts after a pause or with a different speaker ID. Do not select an orphan reporter question as a standalone beat and then cut to a different press conference as though it answered. Transcript tuples include a source-local speaker ID as the fifth item; off-camera speaker and visual presence cannot be inferred from it alone., even when a source is revisited much later. Do NOT arrange selections in input upload order or group all selections from one recording solely for convenience; Flow is responsible for final playback order. Prefer passages with intelligible openings, contextual independent-speaker switches, and a satisfying source-supported ending. Return final cuts, not an inventory; no imposed duration.',
    {outline,sources:evidence},
    a=>{
      // Match the existing single-source behavior: reject a bad optional visual
      // action individually, NEVER discard an otherwise valid dialogue edit.
      let accepted=validateMultiStoryCuts(
        Array.isArray(a.selections)?a.selections:[],inputs,outline)
      const visual=Array.isArray(a.visualActions)?a.visualActions:[]
      const omissions:Array<{sourceId?:unknown;visualBeatId?:unknown;reason:string}>=[]
      for(const entry of visual.slice(0,16)){
        let candidate:Record<string,unknown>
        try { candidate={...object(entry),kind:'visual_action'} }
        catch { omissions.push({reason:'malformed_visual_action'});continue }
        try {
          accepted=validateMultiStoryCuts([...accepted,candidate],inputs,outline)
        }catch(error){
          const message=String((error as Error).message)
          const overlapping=accepted.some(c=>c.sourceId===candidate.sourceId&&
            typeof candidate.startMs==='number'&&typeof candidate.endMs==='number'&&
            Math.max(c.startMs,candidate.startMs)<Math.min(c.endMs,candidate.endMs))
          omissions.push({sourceId:candidate.sourceId,visualBeatId:candidate.visualBeatId,
            reason:overlapping?'already_covered_by_selected_source_footage':message})
        }
      }
      visualOmissions=omissions
      return accepted
    },onUsage,onEvent) as ExecutableMultiStoryCut[]
  await onEvent?.({stage:'footage',status:'filtered',attempt:0,
    proposalSummary:{visualActionOmissions:visualOmissions.slice(0,16),
      visualActionsIncluded:selections.filter(c=>c.kind==='visual_action').length,
      dialogueSelected:selections.filter(c=>c.kind!=='visual_action').length}})
  const passages=selections.map((cut,index)=>({
    index,...cut,
    speakerTurns:cut.kind==='visual_action'?[]:(()=>{
      const source=inputs.find(x=>x.source.sourceId===cut.sourceId)!
      const words=source.words.slice(cut.firstWordId,cut.lastWordId+1)
      const turns:Array<{speakerId:number|null;startWordId:number;endWordId:number;text:string}>=[]
      words.forEach((w,i)=>{
        const speakerId=typeof w.spk==='number'?w.spk:null
        const previous=turns[turns.length-1]
        if(previous&&previous.speakerId===speakerId){
          previous.endWordId=cut.firstWordId+i
          previous.text+=' '+w.w
        }else turns.push({speakerId,startWordId:cut.firstWordId+i,
          endWordId:cut.firstWordId+i,text:w.w})
      })
      return turns
    })(),
    dialogue:cut.kind==='visual_action'?'[Visual action / original on-location sound]':
      inputs.find(x=>x.source.sourceId===cut.sourceId)!.words
        .slice(cut.firstWordId,cut.lastWordId+1).map(w=>w.w).join(' '),
  }))
  const dialogueIndices=passages.filter(p=>p.kind!=='visual_action').map(p=>p.index)
  const visualOnlyIndices=passages.filter(p=>p.kind==='visual_action').map(p=>p.index)
  let ignoredFlowCorrections:Array<{index:unknown;reason:string}>=[]
  const reviewed=await submit(flowTool,
    'FLOW EDITOR: Examine the complete assembled spoken material in the desired sequence AND the full original transcripts. You are an INTERCUTTING FILM EDITOR, not a video concatenator. Build the strongest coherent story beat-by-beat across ALL available passages and independently recorded sources. You MAY move between source recordings repeatedly (e.g. source_0 -> source_2 -> source_1 -> source_2 -> source_0 -> source_0), return to an earlier voice when its testimony advances a later beat, and place adjacent passages from one source when continuity needs it. Do not simply group cuts in source or upload order. ALSO do not manufacture source switches: an unbroken compelling account may be better than gratuitous cutting. Reorder when truthful, remove redundant selections, correct incomplete dialogue by firstWordId/lastWordId using ORIGINAL source-local IDs. CRITICAL: corrections.index is an ORIGINAL input passage index, NOT the position in selectionIndices. ONLY indices in editableDialogueIndices may be corrected with word IDs. Indices in visualOnlyIndices are VISUAL-ONLY footage with no word IDs: preserve them unchanged or OMIT them from selectionIndices; NEVER include them in corrections. Return no corrections for passages you are retaining unchanged. Speaker IDs in each transcript are source-local diarization hints, NOT identities and NOT reliable face matches. In multi-person press conferences, reporter questions often come from OFF CAMERA. Treat a reporter question and the corresponding official answer as an editorial unit when the answer is needed to understand the story. Do not finish a question then switch recordings before its real answer merely because another clip talks about a similar topic. If the original answer is unavailable or irrelevant, remove the orphan question or explicitly frame it as an unanswered question; never borrow a later answer from a different press conference. Do not manufacture conversation between speakers. Your FIRST selection must begin intelligibly, and the LAST selection should land on an actual conclusion, not a conversational question or false start. At each change of source, do NOT imply the next person answered the prior interview; ensure each speaker has context or make an independent thematic transition. Audit EVERY final adjacent join with joinReviews (leftIndex/rightIndex are FINAL OUTPUT indices). For needs_change also supply a valid dialogue correction affecting either passage, or omit the weak passage. Explain your editorial choices.',
    {outline,passages,sources:evidence,editableDialogueIndices:dialogueIndices,
      visualOnlyIndices,
      correctionIndexRule:'Always refer to the ORIGINAL passage.index, not its final position in selectionIndices. Only editableDialogueIndices can have firstWordId/lastWordId corrections.',
      speakerTurnNote:'speakerId is only a source-local diarization hint. It does not prove visible identity or distinguish all off-camera speakers. Preserve meaningful question-answer pairs, and assess whether a reporter question is orphaned before a cut.',
      joinedTransitions:passages.slice(1).map((right,i)=>({
        leftIndex:i,rightIndex:i+1,
        leftEnding:passages[i]!.dialogue.split(' ').slice(-25).join(' '),
        rightOpening:right.dialogue.split(' ').slice(0,25).join(' '),
      }))},
    a=>{
      const order=a.selectionIndices
      if(!Array.isArray(order)||order.length<1||order.length>selections.length||
        order.some(x=>!Number.isInteger(x)||x<0||x>=selections.length)||
        new Set(order).size!==order.length)
        throw Error('multisource_invalid_flow_order')
      const adjusted=selections.map(x=>({...x}))
      const changed=new Set<number>()
      const corrections=Array.isArray(a.corrections)?a.corrections:[]
      // Word corrections targeting a silent action are categorically invalid:
      // retain the real visual unchanged (or allow Flow to omit it through the
      // final order). Do not throw away every good speech edit for this.
      const ignored:Array<{index:unknown;reason:string}>=[]
      for(const entry of corrections){
        const correction=object(entry),index=correction.index
        if(!Number.isInteger(index)||(index as number)<0||
          (index as number)>=selections.length){
          ignored.push({index,reason:'nonexistent_original_passage'})
          continue
        }
        if(adjusted[index as number]!.kind==='visual_action'){
          ignored.push({index,reason:'visual_action_has_no_word_ids'})
          continue
        }
        if(changed.has(index as number)){
          throw Error('multisource_flow_duplicate_dialogue_correction_at_'+index)
        }
        const previous=adjusted[index as number]!
        const checked=validateMultiStoryCuts([{
          sourceId:previous.sourceId,beatId:previous.beatId,
          reason:nonempty(correction.reason),
          firstWordId:correction.firstWordId,lastWordId:correction.lastWordId,
        }],inputs,outline)[0]!
        adjusted[index as number]=checked
        changed.add(index as number)
      }
      ignoredFlowCorrections=ignored
      const final=(order as number[]).map(i=>adjusted[i]!)
      for(let i=0;i<final.length;i++)for(let j=i+1;j<final.length;j++)
        if(final[i]!.sourceId===final[j]!.sourceId&&
          Math.max(final[i]!.startMs,final[j]!.startMs)<
          Math.min(final[i]!.endMs,final[j]!.endMs))
          throw Error('multisource_flow_overlapping_source')
      const reviews=a.joinReviews
      if(!Array.isArray(reviews)||reviews.length!==Math.max(0,final.length-1))
        throw Error('multisource_flow_missing_join_reviews')
      const seen=new Set<number>()
      for(const review of reviews){
        const join=object(review),left=join.leftIndex,right=join.rightIndex
        if(!Number.isInteger(left)||right!==(left as number)+1||
          (left as number)<0||(right as number)>=final.length||
          seen.has(left as number)||!['flows','needs_change'].includes(String(join.status))||
          !String(join.reason??'').trim())
          throw Error('multisource_flow_invalid_join_review')
        if(join.status==='needs_change'&&!changed.has((order as number[])[left as number]!)&&
          !changed.has((order as number[])[right as number]!))
          throw Error('multisource_flow_unrepaired_join')
        seen.add(left as number)
      }
      nonempty(a.justification)
      return final
    },onUsage,onEvent) as ExecutableMultiStoryCut[]
  if(ignoredFlowCorrections.length){
    await onEvent?.({stage:'flow',attempt:0,status:'filtered',
      errorCode:'multisource_flow_non_dialogue_corrections_ignored',
      proposalSummary:{ignoredCorrections:ignoredFlowCorrections,
        dialogueIndices,visualOnlyIndices}})
  }
  const cuts=reviewed
  // Record the actual source sequence; no minimum switches or diversity quota.
  // Editorial value, source fidelity and coherent joins remain the criteria.
  const sourceSequence=cuts.map(c=>c.sourceId)
  const sourceSwitches=sourceSequence.reduce((n,id,i)=>
    n+(i>0&&id!==sourceSequence[i-1]?1:0),0)
  await onEvent?.({stage:'flow',attempt:0,status:'filtered',
    proposalSummary:{finalSourceSequence:sourceSequence.slice(0,48),
      sourceSwitches,uniqueSources:new Set(sourceSequence).size,
      editorialNote:'Source alternation is permitted, never mandatory.'}})
  return {mode:'multi_source_story_v1',outline,cuts,
    estimatedDurationMs:cuts.reduce((n,c)=>n+c.endMs-c.startMs,0)}
}
