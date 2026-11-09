import 'server-only'

import { getClipEditorPayload } from '@/lib/server/clips/clip-detail'
import { writeClipEditsOrThrow } from '@/lib/server/clips/write-clip-edits'
import { suggestTextMotionGraphics, type MotionStyleChoice } from '@/lib/clips/motion-graphics/suggest'
import { addTextBackedMotionPlan } from '@/lib/clips/motion-graphics/text-adapter'
import { motionSafeRect } from '@/lib/clips/motion-graphics/safe-zones'
import { editorPreviewEdits, editorPreviewDurationMs } from '@/lib/clips/editor-preview-edits'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import type { ClipWord } from '@/lib/clips/edits'
import type { VisualMomentEvidence } from '@/lib/ai-producer-agent/visual-evidence'
import type { MotionPlan } from '@/lib/clips/motion-graphics/contract'

/** Actual video-analysis observations projected into the locked output EDL.
 * Never treat speech-only content or removed source footage as visual evidence. */
export function visualObservationsInOutput(
  observations: readonly VisualMomentEvidence[],
  tb: ReturnType<typeof timebaseFor>,
): Array<{startMs:number;endMs:number;observation:string}> {
  const mapped: Array<{startMs:number;endMs:number;observation:string}> = []
  for (const observation of observations) {
    const [start,end] = observation.sourceRangeMs
    for (let i=0;i<tb.segs.length;i++) {
      const [a,b]=tb.segs[i]!
      const lo=Math.max(a,start),hi=Math.min(b,end)
      if (hi-lo<250)continue
      const offset=tb.starts[i]!
      mapped.push({
        startMs:Math.round(offset+lo-a),
        endMs:Math.round(offset+hi-a),
        observation:observation.observation.slice(0,650),
      })
    }
  }
  return mapped.sort((a,b)=>a.startMs-b.startMs).slice(0,32)
}

export type AutomaticMotionOutcome = {
  status:'applied'|'skipped'
  reason:string
  graphics:number
}

/** Best-effort optional supporting graphics AFTER editorial cut assembly and
 * BEFORE preview/export. Zero graphics and missing visual evidence are valid.
 * Strict clip version CAS prevents automated motion from replacing user edits. */
export async function applyAutomaticClipMotion(args:{
  workspaceId:string
  clipId:string
  visualEvidence?: {coarse:VisualMomentEvidence[];focused:VisualMomentEvidence[]}
  mode:MotionPlan['mode']
  style?:MotionStyleChoice
}):Promise<AutomaticMotionOutcome>{
  const data=await getClipEditorPayload(args.workspaceId,args.clipId)
  if(!data)throw Error('motion_auto_clip_missing')
  const edits=data.edits
  if(edits.motionPlan || (edits.textItems??[]).length)
    return {status:'skipped',reason:'existing_graphics_or_manual_text',graphics:0}
  const words:ClipWord[]=data.words
  const durationMs=editorPreviewDurationMs(edits,words)
  if(durationMs<500||durationMs>600_000)
    return {status:'skipped',reason:'unsupported_output_duration',graphics:0}
  const tb=timebaseFor(editorPreviewEdits(edits,words))
  const observations=visualObservationsInOutput(
    [...(args.visualEvidence?.focused??[]),...(args.visualEvidence?.coarse??[])],tb)
  if(!observations.length)
    return {status:'skipped',reason:'no_real_video_observations',graphics:0}
  const aspect=edits.aspectRatio??'9:16'
  if(aspect!=='9:16'&&aspect!=='16:9'&&aspect!=='1:1')
    return {status:'skipped',reason:'unsupported_aspect',graphics:0}
  const result=await suggestTextMotionGraphics({
    edits,words,durationMs,format:aspect,style:args.style??'narrative',
    mode:args.mode,automatic:true,visualObservations:observations,
  })
  if(!result.plan.graphics.length)
    return {status:'skipped',reason:'agent_chose_no_graphics',graphics:0}
  const applied=addTextBackedMotionPlan(edits,result.plan,{
    safeRect:motionSafeRect(aspect),
  })
  if(!applied.ok)
    return {status:'skipped',reason:'unsafe_or_unsupported_plan:'+applied.code,graphics:0}
  const guarded={...applied.edits,motionPlan:result.plan}
  const write=await writeClipEditsOrThrow(args.clipId,data.bounds,
    data.clip.editsSaveVersion,()=>guarded)
  return {status:'applied',reason:'saved_version_'+write.editsSaveVersion,
    graphics:result.plan.graphics.length}
}
