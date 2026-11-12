import 'server-only'

import { ytStructuredDecision } from '@/lib/youtube-video/pipeline/yt-editorial-handoff'
import { YT_GAMING_RULEBOOK } from '@/lib/youtube-video/pipeline/yt-gaming-rulebook'
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
    spokenWords:ctx.words.filter(w=>
      w.e*1000>cut.startMs&&w.s*1000<cut.endMs).map(w=>w.w).join(' '),
    visualEvidence:cut.kind==='visual'
      ?ctx.observations.filter(m=>m.endMs>cut.startMs&&m.startMs<cut.endMs)
        .map(m=>m.description).slice(0,3):[],
  }))
  const raw=await ytStructuredDecision('yt_submit_long_form_finish',
    'STORY FINISHER: This is window '+String((ctx.windowIndex??0)+1)+' of '+String(ctx.windowCount??1)+' of one longer episode. Keep setups, goals, travel, attempts, failures, strategy changes, quiet gameplay and payoff; light trims only for AFK, loading, menus, repetition or off-story chat. Do not make a highlight reel. Target about 25–35% of source runtime and one 15–40 minute episode globally as soft guidance. Return ascending existing candidate indices only; never invent or expand footage. Maintain real continuity. Only the first window needs the opening; ONLY the last window needs a genuine episode ending. Preserve complete visual scenes, preferably 45–60s or longer, and reject transcript-line cutting. Follow these gaming rules: '+YT_GAMING_RULEBOOK+'  Address the supplied QA revision issues if any.',
    {outline,qaRevisionIssues:issues,candidateScenes,fullOriginalTranscript:ctx.words.map((w,i)=>[
      i,Math.round(w.s*1000),Math.round(w.e*1000),w.w,
    ])},
    {keepIndices:{type:'array',minItems:1,maxItems:cuts.length,items:int},
      genuineEnding:{type:'boolean'},endingEvidence:stringType()},
    ['keepIndices','genuineEnding','endingEvidence'])
  // An unverified ending is a QA issue to revise, not a reason to abandon
  // the entire episode before its two review rounds can run.
  if(!Array.isArray(raw.keepIndices) || !raw.keepIndices.length)
    throw Error('yt_finisher_missing_selection')
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

const GENERIC_CHAPTER_PREFIX=/^(?:premise|payoff|opening|ending|beat(?:[ ]*#?[ ]*[0-9]+)?|story(?:[ ]*#?[ ]*[0-9]+)?|part(?:[ ]*#?[ ]*[0-9]+)?|chapter(?:[ ]*#?[ ]*[0-9]+)?|segment(?:[ ]*#?[ ]*[0-9]+)?|section(?:[ ]*#?[ ]*[0-9]+)?)(?:\b|[ :–—-])/i
const GENERIC_CHAPTER_EXACT=/^(?:observed on-screen action|recorded discussion|discussion|conversation|scene|moment)$/i
const TITLE_STOP_WORDS=new Set(['the','and','for','that','this','with','from','into','about','your','their','there','what','when','where','which','while','have','has','had','was','were','are','but','not','you','our','out'])

function cleanChapterTitle(raw:string):string{
  return raw.trim().replace(/[ ]+/g,' ').replace(/^[\s:–—-]+|[\s:–—-]+$/g,'').slice(0,110)
}

export function ytChapterTitleLooksGeneric(raw:string):boolean{
  const cleaned=cleanChapterTitle(raw)
  return cleaned.length<3||GENERIC_CHAPTER_PREFIX.test(cleaned)||GENERIC_CHAPTER_EXACT.test(cleaned)
}

function titleTokens(raw:string):string[]{
  return (raw.toLowerCase().match(/[a-z0-9']{3,}/g)??[])
    .filter(token=>!TITLE_STOP_WORDS.has(token))
}

function chapterEvidence(cut:YtSelectedCut,windowTitle:string):string{
  const grounded=cleanChapterTitle(cut.groundedEvidence??'')
  if(grounded)return grounded
  for(const choice of [cut.beat,cut.label??'',windowTitle,cut.reason]){
    const cleaned=cleanChapterTitle(choice)
    if(cleaned&&!ytChapterTitleLooksGeneric(cleaned))return cleaned
  }
  return ''
}

function titleMatchesEvidence(title:string,evidence:string):boolean{
  if(ytChapterTitleLooksGeneric(title)||!evidence)return false
  const evidenceTokens=new Set(titleTokens(evidence))
  const titleWords=titleTokens(title)
  return titleWords.length>0&&titleWords.some(token=>evidenceTokens.has(token))
}

function groundedTitleFallback(cut:YtSelectedCut,windowTitle:string):string{
  const evidence=chapterEvidence(cut,windowTitle)
  if(!evidence)throw Error('yt_chapter_title_unrepairable')
  const stripped=evidence.replace(GENERIC_CHAPTER_PREFIX,'').replace(/^[\s:–—-]+/,'').trim()
  const words=(stripped||evidence).split(/\s+/).filter(Boolean).slice(0,10)
  const title=cleanChapterTitle(words.join(' '))
  if(!title||ytChapterTitleLooksGeneric(title))throw Error('yt_chapter_title_unrepairable')
  return title
}

async function repairChapterTitles(
  selectedIndices:number[],all:YtSelectedCut[],windowTitles:string[],
  suppliedByIndex:Map<number,string>,
):Promise<string[]>{
  const titles=selectedIndices.map(index=>cleanChapterTitle(suppliedByIndex.get(index)??''))
  const invalid:number[]=[]
  for(let position=0;position<selectedIndices.length;position++){
    const index=selectedIndices[position]!
    const cut=all[index]!
    const evidence=chapterEvidence(cut,windowTitles[index]??'')
    if(!titleMatchesEvidence(titles[position]??'',evidence))invalid.push(position)
  }
  for(let start=0;start<invalid.length;start+=24){
    const positions=invalid.slice(start,start+24)
    const scenes=positions.map(position=>{
      const index=selectedIndices[position]!
      const cut=all[index]!
      return {
        position,index,sourceId:cut.sourceId,kind:cut.kind,
        startMs:cut.startMs,endMs:cut.endMs,
        groundedEvidence:chapterEvidence(cut,windowTitles[index]??''),
      }
    })
    let repaired:string[]=[]
    try{
      const raw=await ytStructuredDecision('yt_submit_chapter_title_repair',
        'CHAPTER TITLE REPAIR: Return one concise content-based title per scene, in the same order. Use only each scene groundedEvidence. Never use Premise, Beat N, Part N, Chapter N, Opening, Ending, Payoff, generic discussion/action labels, or invented events.',
        {scenes},
        {titles:{type:'array',minItems:positions.length,maxItems:positions.length,items:{type:'string'}}},
        ['titles'])
      repaired=Array.isArray(raw.titles)
        ?raw.titles.map(value=>typeof value==='string'?cleanChapterTitle(value):''):[]
    }catch{
      repaired=[]
    }
    positions.forEach((position,offset)=>{
      const index=selectedIndices[position]!
      const cut=all[index]!
      const evidence=chapterEvidence(cut,windowTitles[index]??'')
      const candidate=repaired[offset]??''
      titles[position]=titleMatchesEvidence(candidate,evidence)
        ?candidate:groundedTitleFallback(cut,windowTitles[index]??'')
    })
  }
  return titles
}

/** One chronological episode; coverage of all analyzed windows is enforced. */
export async function ytFinishWholeSourceStory(
  windows:YtFinishedWindow[],
  revision?:{issues:string[];previousSelection:YtGlobalSelection},
):Promise<YtGlobalSelection>{
  const all=windows.flatMap(window=>window.cuts)
  if(!all.length||windows.some(w=>!w.cuts.length))throw Error('yt_global_no_candidates')
  const raw=await ytStructuredDecision('yt_submit_global_story',
    'GLOBAL LONG-FORM STORY: Use vetted footage from EVERY processed window, beginning, middle, and end. Aim for one complete 15–40 minute gaming episode retaining roughly 25–35% of original material, without a hard duration cutoff. Retain necessary scenes from each window: setup, goals, travel, attempts, setbacks, strategy changes, quiet visual gameplay, turning points and payoff. Remove only off-story or repetitive stretches; do not collapse into highlights. Keep scenes in ascending original source order. Every selected scene needs an informative, CONTENT-BASED chapter title rather than Premise, Beat N, Opening, Payoff, or Part N. If revision issues are supplied, address EACH exact issue with source-grounded fixes; no silent acceptance. Never invent scenes. Apply this rulebook: '+YT_GAMING_RULEBOOK+' ',
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
      selectedIndices:{type:'array',minItems:1,maxItems:all.length,items:int},
      chapterTitles:{type:'array',minItems:1,maxItems:all.length,items:{type:'string'}},
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
  const chapterTitles=await repairChapterTitles(selectedIndices,all,windowTitles,suppliedByIndex)
  return {title:raw.title.slice(0,110),premise:raw.premise,
    selectedIndices,chapterTitles}
}

export async function ytQaWholeSourceStory(
  windows:YtFinishedWindow[],selection:YtGlobalSelection,
):Promise<{pass:boolean;issues:string[]}>{
  const all=windows.flatMap(w=>w.cuts)
  const chosen=selection.selectedIndices.map(i=>all[i]!)
  const raw=await ytStructuredDecision('yt_submit_global_qa',
    'FINAL GLOBAL QA: Check this ONE chronological full-episode story for truthful opening, development, and recorded ending, joins across windows and accurate chapter titles. Check that episode length is approximately 15–40 minutes and retained footage is roughly 25–35% of the source as soft editorial targets, not hard rejection conditions. Check that no critical setup, failure, quiet gameplay transition, strategy change or payoff is missing; do not approve a highlights-only cut. Reject broken mission, chase, fight or escape boundaries and chapter-per-cut fragmentation. Give full issue explanations with evidence and specific repair, not codes. Apply this rulebook: '+YT_GAMING_RULEBOOK+' ',
    {title:selection.title,premise:selection.premise,
      scenes:chosen.map((c,i)=>({
        i,sourceId:c.sourceId,kind:c.kind,startMs:c.startMs,endMs:c.endMs,
        chapterTitle:selection.chapterTitles[i],beat:c.beat,reason:c.reason,
      })),
      windowOutlines:windows.map(w=>w.outline),
    },
    {pass:{type:'boolean'},issues:{type:'array',items:{type:'string'},maxItems:40}},
    ['pass','issues'])
  return {pass:raw.pass===true,issues:Array.isArray(raw.issues)
    ?raw.issues.filter((v):v is string=>typeof v==='string').slice(0,40)
    :[]}
}
