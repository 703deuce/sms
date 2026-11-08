import 'server-only'

import { lunaChat } from '@/lib/ai-producer-agent/luna-client'
import type { ToolSchema } from '@/lib/ai-producer-agent/tools/schemas'
import type { MultiStoryPlan, MultiStorySource } from '@/lib/ai-producer-agent/multi-source-story'

const schema:ToolSchema={
  name:'submit_multi_source_editorial_review',
  description:'Audit the finished source-grounded paper edit, including silent visuals, cross-speaker context, and the true ending.',
  parameters:{type:'object',additionalProperties:false,properties:{
    pass:{type:'boolean'},
    issues:{type:'array',maxItems:15,items:{type:'string'}},
  },required:['pass','issues']},
}

/** Editorial paper-edit QA. Does not pretend to have watched the exported MP4.
 * The E5b renderer remains responsible for actually creating source media.
 */
export async function reviewMultiSourceStory(
  plan:MultiStoryPlan,inputs:MultiStorySource[],
  onUsage?:(usage:import('@/lib/ai-producer-agent/luna-client').LunaUsage|undefined)=>void,
):Promise<{pass:boolean;issues:string[]}>{
  const selected=plan.cuts.map((cut,index)=>{
    const src=inputs.find(x=>x.source.sourceId===cut.sourceId)
    return {index,sourceId:cut.sourceId,sourceProjectId:cut.sourceProjectId,
      kind:cut.kind??'dialogue',startMs:cut.startMs,endMs:cut.endMs,
      beatId:cut.beatId,visualBeatId:cut.visualBeatId,
      content:cut.kind==='visual_action'
        ? (src?.visualObservations??[]).find((o,i)=>
            cut.visualBeatId===cut.sourceId+':visual_'+i)?.observation??'[visual action]'
        : src?.words.slice(cut.firstWordId,cut.lastWordId+1).map(w=>w.w).join(' '),
    }
  })
  const evidence=inputs.map(({source,visualObservations})=>({
    sourceId:source.sourceId,visualObservations:visualObservations??[],
  }))
  const response=await lunaChat({tools:[schema],toolChoice:'required',messages:[
    {role:'system',content:
      'Independent documentary STORY QA. Audit the actual selected words and source-observed visuals in FINAL playback order. Check narrative comprehensibility, missing setup, incomplete sentence ends/starts, cross-speaker joins, misleading implied conversation, repeated beats, visual action completeness, and truthful source-supported ending. Visual observations come from Gemini video+original audio and are uncertain. Do not assert acoustic quality or that you watched a render. Report concrete source-qualified issues; do not fail on length or require all uploaded sources.'},
    {role:'user',content:JSON.stringify({outline:plan.outline,selected,evidence,
      joinedTransitions:selected.slice(1).map((right,i)=>({
        fromSource:selected[i]!.sourceId,toSource:right.sourceId,
        preceding:selected[i]!.content?.split(' ').slice(-24).join(' '),
        following:right.content?.split(' ').slice(0,24).join(' '),
      }))})},
  ]})
  onUsage?.(response.usage)
  const call=response.message.tool_calls?.find(c=>c.function.name===schema.name)
  if(!call)throw Error('multisource_qa_tool_missing')
  const parsed=JSON.parse(call.function.arguments) as {pass?:unknown;issues?:unknown}
  if(typeof parsed.pass!=='boolean'||!Array.isArray(parsed.issues)||
    parsed.issues.some(x=>typeof x!=='string'))
    throw Error('multisource_qa_invalid_submission')
  return {pass:parsed.pass,issues:parsed.issues.slice(0,15).map(x=>String(x).slice(0,500))}
}

const revisionSchema:ToolSchema={
  name:'submit_multi_source_qa_revision',
  description:'Repair only source-supported opening, transitions, payoff and ending using original word IDs.',
  parameters:{type:'object',additionalProperties:false,properties:{
    selectionIndices:{type:'array',minItems:1,maxItems:48,items:{type:'integer',minimum:0}},
    corrections:{type:'array',maxItems:32,items:{type:'object',additionalProperties:false,
      properties:{index:{type:'integer',minimum:0},firstWordId:{type:'integer',minimum:0},
        lastWordId:{type:'integer',minimum:0},reason:{type:'string'}},
      required:['index','firstWordId','lastWordId','reason']}},
    justification:{type:'string'},
  },required:['selectionIndices','corrections','justification']},
}

export type MultiSourceQaRevisionResult={
  plan:MultiStoryPlan
  applied:boolean
  reason:string
  removed:number
  repaired:number
}

/** ONE optional editorial revision. Source-local word IDs remain authoritative.
 * The QA model can omit material or adjust speech edges but cannot synthesize
 * material, alter visual intervals, add unrelated recordings, or change Mode 1.
 * Invalid or unusable proposals preserve the already-renderable original plan.
 */
export async function reviseMultiSourceStoryFromQa(
  plan:MultiStoryPlan,inputs:MultiStorySource[],issues:string[],
  onUsage?:(usage:import('@/lib/ai-producer-agent/luna-client').LunaUsage|undefined)=>void,
):Promise<MultiSourceQaRevisionResult>{
  if(!issues.length)return {plan,applied:false,reason:'qa_has_no_issues',removed:0,repaired:0}
  const {validateMultiStoryCuts}=await import('@/lib/ai-producer-agent/multi-source-story')
  const passages=plan.cuts.map((cut,index)=>{
    const source=inputs.find(x=>x.source.sourceId===cut.sourceId)!
    const words=source.words
    const from=Math.max(0,cut.firstWordId-45),to=Math.min(words.length,cut.lastWordId+46)
    return {index,kind:cut.kind??'dialogue',sourceId:cut.sourceId,
      beatId:cut.beatId,firstWordId:cut.firstWordId,lastWordId:cut.lastWordId,
      startMs:cut.startMs,endMs:cut.endMs,reason:cut.reason,
      visualBeatId:cut.visualBeatId,
      selectedWords:cut.kind==='visual_action'?'[observed visual-only action]':
        words.slice(cut.firstWordId,cut.lastWordId+1).map(w=>w.w).join(' '),
      surroundingWords:cut.kind==='visual_action'?[]:
        words.slice(from,to).map((w,i)=>[from+i,w.w]),
    }
  })
  const sourceSummary=inputs.map(({source})=>({sourceId:source.sourceId,title:source.title}))
  const response=await lunaChat({tools:[revisionSchema],toolChoice:'required',messages:[
    {role:'system',content:
      'You are the FINAL EDITOR for a factual multi-recording documentary. Resolve specific issues reported by independent editorial QA, especially: intelligible opening, context before a separate interview begins, no false implied reply between independently recorded speakers, a satisfying evidence-supported ending, and visual action usefulness. Only use existing selected passages and their real source-local nearby transcript words. Use selectionIndices ORIGINAL indices, optionally omit weak passages or correct dialogue firstWordId/lastWordId. Do not correct visual_action passages or invent footage. Do not force equal source durations or use an irrelevant third source. A dominant source is fine if the whole film has a coherent perspective. If no safe improvement exists, leave all passages unchanged. Source identities must stay independent. No target runtime.'},
    {role:'user',content:JSON.stringify({outline:plan.outline,issues,
      sourceSummary,passages,editableDialogueIndices:passages.filter(p=>p.kind==='dialogue').map(p=>p.index),
      visualOnlyIndices:passages.filter(p=>p.kind==='visual_action').map(p=>p.index)})},
  ]})
  onUsage?.(response.usage)
  const call=response.message.tool_calls?.find(c=>c.function.name===revisionSchema.name)
  if(!call)return {plan,applied:false,reason:'qa_revision_no_tool_call',removed:0,repaired:0}
  try{
    const proposal=JSON.parse(call.function.arguments) as {
      selectionIndices?:unknown;corrections?:unknown;justification?:unknown
    }
    const indices=proposal.selectionIndices
    if(!Array.isArray(indices)||indices.length<1||indices.length>plan.cuts.length||
      indices.some(x=>!Number.isInteger(x)||x<0||x>=plan.cuts.length)||
      new Set(indices).size!==indices.length)
      throw Error('qa_revision_invalid_order')
    const adjusted=plan.cuts.map(x=>({...x}))
    const changed=new Set<number>()
    const corrections=proposal.corrections??[]
    if(!Array.isArray(corrections)||corrections.length>32)
      throw Error('qa_revision_invalid_corrections')
    for(const entry of corrections){
      if(!entry||typeof entry!=='object')throw Error('qa_revision_invalid_correction')
      const correction=entry as Record<string,unknown>
      const index=correction.index
      if(!Number.isInteger(index)||(index as number)<0||
         (index as number)>=plan.cuts.length||
         changed.has(index as number))throw Error('qa_revision_invalid_index')
      const old=adjusted[index as number]!
      if(old.kind==='visual_action')throw Error('qa_revision_cannot_change_visual_action')
      const source=inputs.find(s=>s.source.sourceId===old.sourceId)!
      const first=correction.firstWordId,last=correction.lastWordId
      if(!Number.isInteger(first)||!Number.isInteger(last)||
        (first as number)<Math.max(0,old.firstWordId-45)||
        (last as number)>Math.min(source.words.length-1,old.lastWordId+45))
        throw Error('qa_revision_outside_local_word_context')
      const cut=validateMultiStoryCuts([{
        sourceId:old.sourceId,beatId:old.beatId,
        firstWordId:first,lastWordId:last,
        reason:typeof correction.reason==='string'&&correction.reason.trim()
          ? correction.reason:old.reason,
      }],inputs,plan.outline)[0]!
      adjusted[index as number]=cut
      changed.add(index as number)
    }
    const revised=(indices as number[]).map(index=>adjusted[index]!)
    // Revalidate the ENTIRE approved edit, including cross-source overlap.
    validateMultiStoryCuts(revised,inputs,plan.outline)
    const revisedPlan:MultiStoryPlan={...plan,cuts:revised,
      estimatedDurationMs:revised.reduce((total,c)=>total+c.endMs-c.startMs,0)}
    const removed=plan.cuts.length-revised.length
    const applied=removed>0||changed.size>0||
      indices.some((value,i)=>value!==i)
    return {plan:applied?revisedPlan:plan,applied,
      reason:applied?'source_grounded_qa_revision_applied':'no_changes_proposed',
      removed,repaired:changed.size}
  }catch(error){
    return {plan,applied:false,
      reason:'qa_revision_rejected:'+String((error as Error).message).slice(0,120),
      removed:0,repaired:0}
  }
}
