import 'server-only'

import { ytStructuredDecision } from '@/lib/youtube-video/pipeline/yt-editorial-handoff'
import type { YtOutline, YtSelectedCut, YtWindowContext, YtFinishedWindow } from '@/lib/youtube-video/pipeline/yt-types'

const int={type:'integer',minimum:0}

/** YouTube-only long-form copy of Story Finisher: verify real payoff and
 * narrative completeness, never compress to 90s or enforce any time target. */
export async function ytRunStoryFinisher(
  ctx:YtWindowContext,outline:YtOutline,cuts:YtSelectedCut[],
):Promise<YtSelectedCut[]>{
  if(!cuts.length)throw Error('yt_finisher_no_source_cuts')
  const candidateScenes=cuts.map((cut,index)=>({
    index,sourceId:cut.sourceId,kind:cut.kind,
    startMs:cut.startMs,endMs:cut.endMs,beat:cut.beat,
    spokenWords:cut.kind==='speech'?ctx.words.filter(w=>
      w.e*1000>cut.startMs&&w.s*1000<cut.endMs).map(w=>w.w).join(' '):null,
    visualEvidence:cut.kind==='visual'
      ?ctx.observations.filter(m=>m.endMs>cut.startMs&&m.startMs<cut.endMs)
        .map(m=>m.description).slice(0,3):[],
  }))
  const raw=await ytStructuredDecision('yt_submit_long_form_finish',
    'STORY FINISHER: This is one YouTube long-form story. There is NO length target and NO 90-second compression. Return ascending candidate indices to KEEP. You may omit irrelevant scenes, never invent or expand footage. Maintain actual recorded beginning, development and finished payoff. Verify that the ending is natural and witnessed in supplied speech/video.',
    {outline,candidateScenes,fullOriginalTranscript:ctx.words.map((w,i)=>[
      i,Math.round(w.s*1000),Math.round(w.e*1000),w.w,
    ])},
    {keepIndices:{type:'array',minItems:1,maxItems:36,items:int},
      genuineEnding:{type:'boolean'},endingEvidence:stringType()},
    ['keepIndices','genuineEnding','endingEvidence'])
  if(raw.genuineEnding!==true || !Array.isArray(raw.keepIndices) || !raw.keepIndices.length)
    throw Error('yt_finisher_ending_unverified')
  const kept:YtSelectedCut[]=[]
  let previous=-1
  for(const index of raw.keepIndices){
    if(!Number.isSafeInteger(index) || index<=previous || index>=cuts.length)
      throw Error('yt_finisher_indices_not_chronological')
    kept.push(cuts[index]!)
    previous=index
  }
  return kept
}

function stringType():Record<string,string>{return {type:'string'}}

/** The second long-form story pass sees every independently vetted window.
 * It chooses ONE unified story from all available good source footage, not
 * separate ranked shorts. All candidate cut IDs refer to real approved cuts. */
export async function ytFinishWholeSourceStory(
  windows:YtFinishedWindow[],
):Promise<{title:string;premise:string;selectedIndices:number[]}>{
  const all=windows.flatMap(window=>window.cuts)
  if(!all.length)throw Error('yt_global_no_candidates')
  const raw=await ytStructuredDecision('yt_submit_global_story',
    'GLOBAL LONG-FORM STORY: Unite source-supported scenes from EVERY processed window into ONE beginning, development and ending. Identify the strongest coherent narrative and keep only good relevant scenes. Do not invent plot or select spans that were not approved. No genre, no maximum runtime. Return strictly ascending indices in original source order, not separate highlight clips. When windows have relevant good material preserve that across the full recording.',
    {
      windowOutlines:windows.map(w=>({
        sourceIndex:w.sourceIndex,rangeMs:[w.startMs,w.endMs],outline:w.outline,
        vettedCutCount:w.cuts.length,
      })),
      approvedScenes:all.map((c,index)=>({
        index,sourceId:c.sourceId,kind:c.kind,startMs:c.startMs,endMs:c.endMs,
        beat:c.beat,reason:c.reason,
      })),
    },
    {
      title:{type:'string'},premise:{type:'string'},
      selectedIndices:{type:'array',minItems:1,maxItems:51,items:int},
    },['title','premise','selectedIndices'])
  if(typeof raw.title!=='string'||!raw.title.trim()||
    typeof raw.premise!=='string'||!raw.premise.trim()||
    !Array.isArray(raw.selectedIndices)||!raw.selectedIndices.length)
    throw Error('yt_global_story_invalid')
  let prior=-1
  const selectedIndices:number[]=[]
  for(const idx of raw.selectedIndices){
    if(!Number.isSafeInteger(idx)||idx<=prior||idx>=all.length)
      throw Error('yt_global_story_invalid_cut_id')
    selectedIndices.push(idx)
    prior=idx
  }
  return {title:raw.title.slice(0,110),premise:raw.premise.slice(0,450),selectedIndices}
}

export async function ytQaWholeSourceStory(
  windows:YtFinishedWindow[],selection:{title:string;premise:string;selectedIndices:number[]},
):Promise<void>{
  const all=windows.flatMap(w=>w.cuts)
  const chosen=selection.selectedIndices.map(i=>all[i]!)
  const raw=await ytStructuredDecision('yt_submit_global_qa',
    'FINAL GLOBAL QA: Does this ONE chronological YouTube story have truthful opening context, development and a source-recorded ending? Check continuity between consecutive windows and disallow non-sequiturs, fabricated beats, orphan references and irrelevant padding. Never enforce length. Reject if not cohesive.',
    {title:selection.title,premise:selection.premise,
      scenes:chosen.map((c,i)=>({
        i,sourceId:c.sourceId,kind:c.kind,startMs:c.startMs,endMs:c.endMs,
        beat:c.beat,reason:c.reason,
      })),
      windowOutlines:windows.map(w=>w.outline),
    },
    {pass:{type:'boolean'},issueCodes:{type:'array',items:{type:'string'},maxItems:10}},
    ['pass','issueCodes'])
  if(raw.pass!==true)throw Error('yt_global_qa_rejected')
}
