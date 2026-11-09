import 'server-only'
import {getClipEditorPayload} from '@/lib/server/clips/clip-detail'
import {reserveMotionRequest} from '@/lib/server/clips/motion-request-limit'
import {recordOpenAiJsonUsage} from '@/lib/server/clips/ai-usage'
import {GPT_6_LUNA_MODEL_ID} from '@/lib/server/ai/gpt-6-luna-chat'
import {suggestTextMotionGraphics} from '@/lib/clips/motion-graphics/suggest'
import {addTextBackedMotionPlan} from '@/lib/clips/motion-graphics/text-adapter'
import {editorPreviewDurationMs} from '@/lib/clips/editor-preview-edits'
import {writeClipEditsOrThrow} from '@/lib/server/clips/write-clip-edits'
import type {MotionStyleChoice} from '@/lib/clips/motion-graphics/suggest'

/** Nonblocking, editor-compatible post-edit motion stage.
 * Called after ranking and BEFORE the MP4 job is queued. All content must
 * come from approved source transcript. Never edits the source cut plan.
 */
export async function autoPlanClipMotion(input:{
  workspaceId:string;clipId:string;style?:MotionStyleChoice;
  mode:'moment'|'story';instruction?:string|null;
}):Promise<{status:'generated'|'none'|'skipped';reason:string;count:number}>{
  const payload=await getClipEditorPayload(input.workspaceId,input.clipId)
  if(!payload)throw Error('motion_clip_unavailable')
  const {edits,words,bounds,clip}=payload
  const durationMs=editorPreviewDurationMs(edits,words)
  if(durationMs<500||durationMs>600_000)
    return {status:'skipped',reason:'motion_output_duration_unsupported',count:0}
  if(!words.length)
    return {status:'skipped',reason:'motion_no_source_transcript',count:0}
  const budget=await reserveMotionRequest(input.workspaceId,'generate')
  if(!budget.ok)
    return {status:'skipped',reason:'motion_hourly_limit',count:0}
  const result=await suggestTextMotionGraphics({
    edits,words,durationMs,format:'9:16',
    style:input.style??(input.mode==='story'?'narrative':'minimal'),
    mode:input.mode==='story'?'streamer_story_clip':'streamer_continuous',
    instruction:[input.instruction??'',
      'This is an automatic clip edit. Add only graphics justified by literal speech.',
      'Do NOT add motion merely because the clip is short or needs decoration.',
      '9:16 safe area: every graphic box must fit x=.06 to .94 and y=.08 to .82 of the frame.',
      'Leave the lower caption zone clear; do not cover the speaker face, eyes or mouth. If no face/subject location is available, prefer restrained corner text and minimize screen coverage.',
      'Never cut off titles on the sides. Validate text spelling of names against source evidence; do not guess unverified proper names or alter what was said.',
      'Respect gameplay UI, keep graphics sparse, source-grounded and editable.',
      'An empty list is the correct decision when nothing adds value.',
    ].join(' ').slice(0,1000),
  })
  await recordOpenAiJsonUsage({workspaceId:input.workspaceId,clipId:input.clipId,
    model:GPT_6_LUNA_MODEL_ID,
    promptTokens:result.usage.promptTokens,
    completionTokens:result.usage.completionTokens})
  if(!result.plan.graphics.length)
    return {status:'none',reason:'motion_planner_chose_no_useful_graphics',count:0}
  // Clip export and editor preview share these normalized coordinates. This
  // protects platform edges and reserves the lower caption-safe zone.
  // It is NOT face detection: unknown face positions remain a visual QA task.
  const safeRect={x:.06,y:.08,width:.88,height:.74}
  const applied=addTextBackedMotionPlan(edits,result.plan,{safeRect})
  if(!applied.ok)throw Error('motion_plan_apply_'+applied.code)
  // CAS is mandatory: the user may open and edit while agents are finishing.
  await writeClipEditsOrThrow(input.clipId,bounds,clip.editsSaveVersion,
    current=>({...current,
      textItems:applied.edits.textItems,
      keyframes:applied.edits.keyframes,
      motionPlan:result.plan}))
  return {status:'generated',reason:'motion_plan_applied_before_export',
    count:result.plan.graphics.length}
}
