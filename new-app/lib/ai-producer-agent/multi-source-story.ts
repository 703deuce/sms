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
}
export type MultiStoryCut={
  sourceId:string
  firstWordId:number
  lastWordId:number
  beatId:string
  reason:string
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
const storyTool:ToolSchema={
  name:'submit_multi_source_story',
  description:'Discover ONE coherent narrative from independent sources, without inventing speaker relationships.',
  parameters:{
    type:'object',additionalProperties:false,
    properties:{
      title:stringField,logline:stringField,endingRule:stringField,
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
      selections:{type:'array',minItems:2,maxItems:32,items:{
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
  description:'Approve the source-grounded order of proposed passages. Return indices into supplied selections.',
  parameters:{
    type:'object',additionalProperties:false,
    properties:{selectionIndices:{type:'array',minItems:2,maxItems:32,items:wordId},
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
  return {title:nonempty(obj.title),logline:nonempty(obj.logline),
    endingRule:nonempty(obj.endingRule),beats:normalized}
}
export function validateMultiStoryCuts(
  raw:unknown,inputs:MultiStorySource[],outline:MultiStoryOutline,
):ExecutableMultiStoryCut[]{
  if(!Array.isArray(raw)||raw.length<2||raw.length>32)throw Error('multisource_invalid_cut_count')
  const sources=new Map(inputs.map(s=>[s.source.sourceId,s]))
  const beats=new Map(outline.beats.map(b=>[b.id,b]))
  const selected:ExecutableMultiStoryCut[]=[]
  for(const value of raw){
    const row=object(value)
    const sourceId=nonempty(row.sourceId),beatId=nonempty(row.beatId)
    const source=sources.get(sourceId),beat=beats.get(beatId)
    if(!source||!beat||!beat.sourceIds.includes(sourceId))
      throw Error('multisource_cut_wrong_source_or_beat')
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
  // A multi-source edit must actually use several sources, not concatenate
  // snippets from the first upload and pretend to be a multi-source story.
  if(new Set(selected.map(x=>x.sourceId)).size<2)throw Error('multisource_only_one_source_used')
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
    visualObservations:visualObservations??[],
  }))
  const outline=await submit(storyTool,
    'You are the Story Director for a FINISHED multi-source documentary-style video, not a highlight montage. Independently discover the strongest ONE truthful narrative from the recordings. Design a setup, development, meaningful reveal or insight, and ending. Never invent a conclusion or imply separately recorded people were talking to each other. You may omit an irrelevant source. Story beat sourceIds must refer to real supplied recordings.',
    {instruction:instruction??'Find the strongest complete story supported by the footage.',sources:evidence},
    a=>validateMultiStoryOutline(a,inputs),onUsage) as MultiStoryOutline
  const selections=await submit(footageTool,
    'You are the Footage Editor. Select only exact first and last WORD IDs from the correct source, using sourceId for EVERY selection. Construct the approved story from complete spoken thoughts, reactions and relevant visual context. Source time is always local to the selected source. Do not invent quotes, source IDs, events, or use global word indices. Return final edit passages, not candidate highlights.',
    {outline,sources:evidence},
    a=>validateMultiStoryCuts(a.selections,inputs,outline),onUsage) as ExecutableMultiStoryCut[]
  const indices=await submit(flowTool,
    'You are the Flow Editor. Order the selected passages into one honest, coherent FINISHED story. Preserve complete statements, context, relationships and a source-grounded ending. Return each retained input index exactly once; reorder only if the sequence remains truthful. No deceptive implied conversation or invented response.',
    {outline,selections},
    a=>{
      const order=a.selectionIndices
      if(!Array.isArray(order)||order.length!==selections.length||
        order.some(x=>!Number.isInteger(x)||x<0||x>=selections.length)||
        new Set(order).size!==selections.length)
        throw Error('multisource_invalid_flow_order')
      nonempty(a.justification)
      return order as number[]
    },onUsage) as number[]
  const cuts=indices.map(i=>selections[i]!)
  return {mode:'multi_source_story_v1',outline,cuts,
    estimatedDurationMs:cuts.reduce((n,c)=>n+c.endMs-c.startMs,0)}
}
