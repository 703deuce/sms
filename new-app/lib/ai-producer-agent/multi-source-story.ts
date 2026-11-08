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
  visualObservations?:Array<{startMs:number;endMs:number;observation:string}>
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
  mode:'multi_source_story_v1'
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
      justification:stringField},
    required:['selectionIndices','justification'],
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
      source.rangeMs[1]<=source.rangeMs[0]||words.length<30)
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
async function submit(
  tool:ToolSchema,system:string,user:unknown,
  validate:(value:Record<string,unknown>)=>unknown,
  onUsage?:(usage:import('@/lib/ai-producer-agent/luna-client').LunaUsage|undefined)=>void,
):Promise<unknown>{
  const messages:import('@/lib/ai-producer-agent/luna-client').LunaMessage[]=[
    {role:'system',content:system},{role:'user',content:JSON.stringify(user)},
  ]
  for(let attempt=0;attempt<3;attempt++){
    const response=await lunaChat({messages,tools:[tool],toolChoice:'required'})
    onUsage?.(response.usage)
    const call=response.message.tool_calls?.find(c=>c.function.name===tool.name)
    if(!call){
      messages.push(response.message,{role:'user',content:'Submit the required structured tool call.'})
      continue
    }
    try{
      return validate(object(JSON.parse(call.function.arguments)))
    }catch(e){
      messages.push(response.message,{
        role:'tool',tool_call_id:call.id,
        content:JSON.stringify({ok:false,error:String((e as Error).message),
          instruction:'Repair source IDs, word IDs, beat IDs, or source ranges. Never invent footage.'}),
      })
    }
  }
  throw Error('multisource_specialist_unusable_submissions')
}
/** Produces a validated creative decision, not an MP4. The separate
 * multi-source render pipeline must consume these source-aware cuts. */
export async function planMultiSourceStory(
  inputs:MultiStorySource[],instruction?:string,
  onUsage?:(usage:import('@/lib/ai-producer-agent/luna-client').LunaUsage|undefined)=>void,
):Promise<MultiStoryPlan>{
  validateMultiStorySources(inputs)
  const evidence=inputs.map(({source,words,visualObservations})=>({
    sourceId:source.sourceId,title:source.title,
    rangeMs:source.rangeMs,
    transcript:words.map((w,i)=>[i,Math.round(w.s*1000),Math.round(w.e*1000),w.w]),
    visualObservations:(visualObservations??[]).map((o,i)=>({...o,id:source.sourceId+':visual_'+i})),
  }))
  const outline=await submit(storyTool,
    'STORY DIRECTOR: Examine ALL independent recordings together before choosing ONE truthful, compelling narrative. Gemini examined video frames with ORIGINAL audio and transcript; time-aligned visual observations are first-class evidence, including silent reactions and actions. Discover what the footage supports, do not force a generic arc or equal screen time. Explicitly nominate helpful visualBeats by observation ID, sourceId and EXACT observed start/end timestamps. Return visualBeats:[] if none. No invented conversation or conclusion.',
    {instruction:instruction??'Find the strongest complete story supported by the footage.',sources:evidence},
    a=>validateMultiStoryOutline(a,inputs),onUsage) as MultiStoryOutline
  const selections=await submit(footageTool,
    'FOOTAGE EDITOR: Use the entire footage evidence and story outline. Select complete dialogue by exact per-source word IDs in selections, PLUS independent source-grounded visualActions for approved Story visualBeats even if there is NO speech. Every visual action needs correct sourceId, visualBeatId, beatId and original millisecond bounds within observed event, with boundaries outside words. Prefer complete visible actions/reactions. Exclude portions already used by dialogue; never duplicate overlapping source material or invent visual actions. Return final cuts, not an inventory; no imposed duration.',
    {outline,sources:evidence},
    a=>{
      // Match the existing single-source behavior: reject a bad optional visual
      // action individually, NEVER discard an otherwise valid dialogue edit.
      let accepted=validateMultiStoryCuts(
        Array.isArray(a.selections)?a.selections:[],inputs,outline)
      const visual=Array.isArray(a.visualActions)?a.visualActions:[]
      for(const entry of visual.slice(0,16)){
        try {
          const candidate={...object(entry),kind:'visual_action'}
          accepted=validateMultiStoryCuts([...accepted,candidate],inputs,outline)
        }catch{/* Unverified visual action omitted; real dialogue remains intact. */}
      }
      return accepted
    },onUsage) as ExecutableMultiStoryCut[]
  const passages=selections.map((cut,index)=>({
    index,...cut,
    dialogue:cut.kind==='visual_action'?'[Visual action / original on-location sound]':
      inputs.find(x=>x.source.sourceId===cut.sourceId)!.words
        .slice(cut.firstWordId,cut.lastWordId+1).map(w=>w.w).join(' '),
  }))
  const reviewed=await submit(flowTool,
    'FLOW EDITOR: Examine the complete assembled spoken material in the desired sequence AND the full original transcripts. Reorder when truthful, remove redundant selections, correct incomplete dialogue by firstWordId/lastWordId using ORIGINAL source-local IDs. Preserve visual-only cuts and their observed bounds. Use selectionIndices for retained ORIGINAL indices in final order and corrections for ORIGINAL dialogue indices only. Do not manufacture conversation between speakers. Evaluate every adjacent transition; explain your editorial choices. Unchanged passages need no correction.',
    {outline,passages,sources:evidence,
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
      for(const entry of corrections){
        const correction=object(entry),index=correction.index
        if(!Number.isInteger(index)||(index as number)<0||
          (index as number)>=selections.length||changed.has(index as number)||
          adjusted[index as number]!.kind==='visual_action')
          throw Error('multisource_flow_invalid_correction')
        const previous=adjusted[index as number]!
        const checked=validateMultiStoryCuts([{
          sourceId:previous.sourceId,beatId:previous.beatId,
          reason:nonempty(correction.reason),
          firstWordId:correction.firstWordId,lastWordId:correction.lastWordId,
        }],inputs,outline)[0]!
        adjusted[index as number]=checked
        changed.add(index as number)
      }
      const final=(order as number[]).map(i=>adjusted[i]!)
      for(let i=0;i<final.length;i++)for(let j=i+1;j<final.length;j++)
        if(final[i]!.sourceId===final[j]!.sourceId&&
          Math.max(final[i]!.startMs,final[j]!.startMs)<
          Math.min(final[i]!.endMs,final[j]!.endMs))
          throw Error('multisource_flow_overlapping_source')
      nonempty(a.justification)
      return final
    },onUsage) as ExecutableMultiStoryCut[]
  const cuts=reviewed
  return {mode:'multi_source_story_v1',outline,cuts,
    estimatedDurationMs:cuts.reduce((n,c)=>n+c.endMs-c.startMs,0)}
}
