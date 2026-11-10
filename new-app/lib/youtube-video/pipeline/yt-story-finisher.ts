import 'server-only'

import { ytStructuredDecision } from '@/lib/youtube-video/pipeline/yt-editorial-handoff'
import type { YtOutline, YtSelectedCut, YtWindowContext, YtFinishedWindow } from '@/lib/youtube-video/pipeline/yt-types'

const int={type:'integer',minimum:0}

/** YouTube-only long-form copy of Story Finisher: verify real payoff and
 * narrative completeness, never compress to 90s or enforce any time target. */
export async function ytRunStoryFinisher(
  ctx:YtWindowContext,outline:YtOutline,cuts:YtSelectedCut[],issues:string[]=[],
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
    'STORY FINISHER: This is window '+String((ctx.windowIndex??0)+1)+' of '+String(ctx.windowCount??1)+' of one longer episode. No duration target or short-form compression. Return ascending existing candidate indices only; never invent or expand footage. Maintain real continuity. Only the first window needs the opening; ONLY the last window needs a genuine episode ending. Address the supplied QA revision issues if any.',
    {outline,qaRevisionIssues:issues,candidateScenes,fullOriginalTranscript:ctx.words.map((w,i)=>[
      i,Math.round(w.s*1000),Math.round(w.e*1000),w.w,
    ])},
    {keepIndices:{type:'array',minItems:1,maxItems:36,items:int},
      genuineEnding:{type:'boolean'},endingEvidence:stringType()},
    ['keepIndices','genuineEnding','endingEvidence'])
  const finalWindow=ctx.windowCount==null||ctx.windowIndex==null||ctx.windowIndex===ctx.windowCount-1
  if((finalWindow&&raw.genuineEnding!==true) || !Array.isArray(raw.keepIndices) || !raw.keepIndices.length)
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
export type YtGlobalSelection = {
  title: string
  premise: string
  selectedIndices: number[]
  chapterTitles: string[]
}

function descriptiveTitle(raw:string,cut:YtSelectedCut,windowTitle:string):string {
  const generic=/^(?:premise|payoff|opening|ending|beat[ ]*[0-9]+|story[ ]*[0-9]+|part[ ]*[0-9]+)$/i
  for(const choice of [raw,cut.beat,cut.label??'',cut.reason,windowTitle]){
    const cleaned=choice.trim().replace(/[ ]+/g,' ')
    if(cleaned.length>=6&&!generic.test(cleaned))return cleaned.slice(0,110)
  }
  return cut.kind==='visual'?'Observed on-screen action':'Recorded discussion'
}

/** One chronological episode; coverage of all analyzed windows is enforced. */
export async function ytFinishWholeSourceStory(
  windows:YtFinishedWindow[],
  revision?:{issues:string[];previousSelection:YtGlobalSelection},
):Promise<YtGlobalSelection>{
  const all=windows.flatMap(window=>window.cuts)
  if(!all.length||windows.some(w=>!w.cuts.length))throw Error('yt_global_no_candidates')
  const raw=await ytStructuredDecision('yt_submit_global_story',
    'GLOBAL LONG-FORM STORY: Use vetted footage from EVERY processed window, beginning, middle, and end. No runtime target or source-duration cap. Keep relevant scenes in ascending original source order. Every selected scene needs an informative, CONTENT-BASED chapter title rather than Premise, Beat N, Opening, Payoff, or Part N. If revision issues are supplied, address them using the same vetted evidence. Never invent scenes.',
    {
      windowOutlines:windows.map((w,windowIndex)=>({
        windowIndex,sourceIndex:w.sourceIndex,rangeMs:[w.startMs,w.endMs],
        outline:w.outline,vettedCutCount:w.cuts.length,
      })),
      approvedScenes:all.map((c,index)=>({
        index,sourceId:c.sourceId,kind:c.kind,startMs:c.startMs,endMs:c.endMs,
        beat:c.beat,reason:c.reason,
      })),
      revision:revision??null,
    },
    {
      title:{type:'string'},premise:{type:'string'},
      selectedIndices:{type:'array',minItems:1,maxItems:51,items:int},
      chapterTitles:{type:'array',minItems:1,maxItems:51,items:{type:'string'}},
    },['title','premise','selectedIndices','chapterTitles'])
  if(typeof raw.title!=='string'||!raw.title.trim()||
    typeof raw.premise!=='string'||!raw.premise.trim()||
    !Array.isArray(raw.selectedIndices)||!raw.selectedIndices.length)
    throw Error('yt_global_story_invalid')
  let prior=-1
  const chosen:number[]=[]
  for(const idx of raw.selectedIndices){
    if(!Number.isSafeInteger(idx)||idx<=prior||idx>=all.length)
      throw Error('yt_global_story_invalid_cut_id')
    chosen.push(idx)
    prior=idx
  }
  const suppliedTitles=Array.isArray(raw.chapterTitles)?raw.chapterTitles:[]
  const suppliedByIndex=new Map(chosen.map((idx,i)=>[idx,
    typeof suppliedTitles[i]==='string'?suppliedTitles[i] as string:'']))
  const covered=new Set(chosen)
  let at=0
  for(const window of windows){
    const from=at
    at+=window.cuts.length
    if(!chosen.some(index=>index>=from&&index<at))covered.add(from)
  }
  const selectedIndices=[...covered].sort((a,b)=>a-b)
  const windowTitles=windows.flatMap(w=>w.cuts.map(()=>w.outline.title))
  return {title:raw.title.slice(0,110),premise:raw.premise.slice(0,450),
    selectedIndices,
    chapterTitles:selectedIndices.map(i=>
      descriptiveTitle(suppliedByIndex.get(i)??'',all[i]!,windowTitles[i]??''))}
}

export async function ytQaWholeSourceStory(
  windows:YtFinishedWindow[],selection:YtGlobalSelection,
):Promise<{pass:boolean;issues:string[]}>{
  const all=windows.flatMap(w=>w.cuts)
  const chosen=selection.selectedIndices.map(i=>all[i]!)
  const raw=await ytStructuredDecision('yt_submit_global_qa',
    'FINAL GLOBAL QA: Check this ONE chronological full-episode story for truthful opening, development, and recorded ending, joins across windows and accurate chapter titles. No duration limit. Return issue codes if any problem.',
    {title:selection.title,premise:selection.premise,
      scenes:chosen.map((c,i)=>({
        i,sourceId:c.sourceId,kind:c.kind,startMs:c.startMs,endMs:c.endMs,
        chapterTitle:selection.chapterTitles[i],beat:c.beat,reason:c.reason,
      })),
      windowOutlines:windows.map(w=>w.outline),
    },
    {pass:{type:'boolean'},issueCodes:{type:'array',items:{type:'string'},maxItems:10}},
    ['pass','issueCodes'])
  return {pass:raw.pass===true,issues:Array.isArray(raw.issueCodes)
    ?raw.issueCodes.filter((v):v is string=>typeof v==='string').slice(0,10).map(v=>v.slice(0,240))
    :[]}
}
