import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { MultiStoryPlan } from '@/lib/ai-producer-agent/multi-source-story'
import { normalizeMediaSources } from '@/lib/clips/editor/sources'
import { normalizeInserts } from '@/lib/clips/editor/inserts'

/** Build the one-source base + N source-audio inserts that the existing E5b
 * renderer can export. All cuts are source-absolute milliseconds, while an
 * append insert advances the final DISPLAY timeline by its own duration.
 * The first clip uses the real main source audio; later clips keep theirs. */
export function buildMultiStoryInsertEdits(
  base:ClipEditsV2,plan:MultiStoryPlan,
  uploads:Array<{id:string;durationMs:number|null;label:string}>,
):ClipEditsV2{
  const first=plan.cuts[0]
  if(!first||plan.cuts.length>50)throw Error('multisource_invalid_assembly_size')
  const present=new Map(uploads.map(u=>[u.id,u]))
  if(uploads.length!==plan.cuts.length)throw Error('multisource_assembly_source_count_mismatch')
  const sources=normalizeMediaSources(uploads.map((u,i)=>({
    id:'multi_'+i,ref:'upload',refId:u.id,mediaType:'video',
    label:u.label,...(u.durationMs?{durationMs:u.durationMs}:{}),
  })))
  if(!sources)throw Error('multisource_media_sources_invalid')
  const inserts=normalizeInserts(plan.cuts.slice(1).map((cut,i)=>({
    id:'multi_insert_'+i,
    sourceId:'multi_'+(i+1),
    atSrcMs:first.endMs,
    append:true,
    inMs:cut.startMs,
    durMs:cut.endMs-cut.startMs,
    audio:'source',
    fit:'contain',
  })),sources)
  if((inserts?.length??0)!==plan.cuts.length-1)
    throw Error('multisource_invalid_insert_normalization')
  // Reject unexpected clamping instead of silently dropping the ending
  // of someone's statement from a source video.
  for(let i=0;i<inserts!.length;i++){
    const cut=plan.cuts[i+1]!
    if(inserts![i]!.inMs!==cut.startMs ||
      inserts![i]!.durMs!==cut.endMs-cut.startMs)
      throw Error('multisource_insert_duration_clamped')
  }
  if(!present.size)throw Error('multisource_missing_media')
  return {
    ...base,trim:{in:first.startMs,out:first.endMs},cutRanges:[],
    aspectRatio:'16:9',layout:{...base.layout,mode:'full_frame'},
    captions:{...base.captions,enabled:false},
    sources,inserts,
  }
}
