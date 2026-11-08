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
