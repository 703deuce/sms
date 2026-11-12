import 'server-only'

import { lunaChat, type LunaMessage } from '@/lib/ai-producer-agent/luna-client'
import { YOUTUBE_VIDEO_STORY_SYSTEM } from '@/lib/youtube-video/story-options'
import { YT_GAMING_RULEBOOK } from '@/lib/youtube-video/pipeline/yt-gaming-rulebook'
import type { YtWindowContext, YtOutline, YtSelectedCut, YtObservation } from '@/lib/youtube-video/pipeline/yt-types'

type YtSchema = { name:string;description:string;parameters:Record<string,unknown> }
const stringField={type:'string'}
const intField={type:'integer',minimum:0}

/** Isolated copies of the Producer specialist submissions. All outputs are
 * structured and source-validated before they can become render cuts. */
export async function ytStructuredDecision(
  name:string, instruction:string, evidence:unknown,
  properties:Record<string,unknown>, required:string[],
): Promise<Record<string,unknown>> {
  const tool:YtSchema={
    name,description:'Submit only verifiable YouTube long-form editorial decisions.',
    parameters:{type:'object',additionalProperties:false,properties,required},
  }
  const messages:LunaMessage[]=[
    {role:'system',content:[
      YOUTUBE_VIDEO_STORY_SYSTEM,
      YT_GAMING_RULEBOOK,
      'GAMING EPISODE SPECIALIST: The original gameplay is authoritative. Preserve setup, objectives, attempts, setbacks, strategy changes, travel, exploration, quiet visual-only action, turning points and payoff in chronological order. Make light trims only for AFK, loading, menus, empty pauses, repetitive grinding and unrelated chat. Never compress the story into highlights. Aim for approximately 25–35% of source runtime and a cohesive 15–40 minute YouTube episode across all windows, without treating duration as a hard rejection threshold. Only the first window needs the opening and only the last needs the actual ending; intermediate windows continue the story. Choose scene boundaries by ON-SCREEN action; speech word boundaries matter only for trimming spoken passages. Optional user instructions identify which true story to keep.',
      instruction,
    ].join('\n\n')},
    {role:'user',content:JSON.stringify(evidence)},
  ]
  for(let attempt=0;attempt<2;attempt++){
    const response=await lunaChat({messages,tools:[tool],toolChoice:'required'})
    const call=response.message.tool_calls?.find(c=>c.function.name===name)
    if(call){
      try{
        const parsed=JSON.parse(call.function.arguments) as unknown
        if(parsed && typeof parsed==='object' && !Array.isArray(parsed)) return parsed as Record<string,unknown>
      }catch { /* request a repaired structured response */ }
      messages.push(response.message)
      messages.push({role:'tool',tool_call_id:call.id,content:'{"ok":false,"error":"invalid_json","hint":"Return valid structured JSON with the required fields."}'})
    }else{
      messages.push({role:'user',content:'You must call the provided submission tool with valid structured fields.'})
    }
  }
  throw Error('yt_'+name+'_unusable_submissions')
}

function evidenceRows(ctx:YtWindowContext){
  return {
    sourceId:ctx.sourceId,rangeMs:[ctx.startMs,ctx.endMs],
    windowIndex:ctx.windowIndex??0,windowCount:ctx.windowCount??1,
    originalTranscriptWordIds:ctx.words.map((w,i)=>[i,Math.round(w.s*1000),Math.round(w.e*1000),w.w]),
    observedVideoAndOriginalAudio:ctx.observations.map((m,i)=>({
      observationId:i,startMs:m.startMs,endMs:m.endMs,
      description:m.description,whyInteresting:m.whyInteresting,category:m.category,
      tier:m.tier,
    })),
    ...(ctx.instruction?.trim() ? {storyToPreserve:ctx.instruction.trim()} : {}),
    ...(ctx.qaIssues?.length ? {previousQaRejections:ctx.qaIssues} : {}),
  }
}

export async function ytCreateEditorialHandoff(ctx:YtWindowContext):Promise<YtOutline>{
  const raw=await ytStructuredDecision('yt_submit_story_outline',
    'STORY: Examine the entire window transcript AND Gemini video/original-audio observations. Plan complete visible sequences, not transcript lines. Every mission/chase/fight/escape must have a visual starting cause and a visible resolution. Identify chronological action start/end timestamps and group adjacent beats into 45–60s or longer scenes (brief one-offs allowed). Outline real events from this segment of a longer recording. Record the beginning, progression and real payoff across the stream: goals, travel/build-up, attempts, failures, strategy shifts, visual-only gameplay and outcomes. Keep enough connective scenes for the story to make sense. First window begins the episode; intermediate windows continue it without artificial endings; only the last needs the genuine recorded ending. Quiet gameplay is valid evidence.',
    evidenceRows(ctx),
    {
      title:stringField,premise:stringField,opening:stringField,
      development:stringField,ending:stringField,
      exclusions:{type:'array',items:stringField,maxItems:12},
    },['title','premise','opening','development','ending','exclusions'])
  for(const key of ['title','premise','opening','development','ending']){
    if(typeof raw[key]!=='string' || !(raw[key] as string).trim()) throw Error('yt_invalid_story_outline')
  }
  return {
    title:String(raw.title).slice(0,100),premise:String(raw.premise),
    opening:String(raw.opening).slice(0,400),
    development:String(raw.development).slice(0,400),
    ending:String(raw.ending).slice(0,400),
    exclusions:Array.isArray(raw.exclusions)
      ? raw.exclusions.filter((x):x is string=>typeof x==='string').slice(0,12).map(x=>x.slice(0,240))
      : [],
  }
}

type YtCutsResult={
  cuts:YtSelectedCut[]
  rejected:Array<{startMs:number;endMs:number;code:string}>
}

function cutFromWords(
  ctx:YtWindowContext,firstWordId:unknown,lastWordId:unknown,
  beat:string,reason:string,
):YtSelectedCut | null{
  if(!Number.isSafeInteger(firstWordId)||!Number.isSafeInteger(lastWordId)) return null
  const first=ctx.words[firstWordId as number],last=ctx.words[lastWordId as number]
  if(!first || !last || (lastWordId as number)<(firstWordId as number)) return null
  const startMs=Math.round(first.s*1000),endMs=Math.round(last.e*1000)
  if(!Number.isSafeInteger(startMs)||!Number.isSafeInteger(endMs)||
    startMs<ctx.startMs||endMs>ctx.endMs||endMs-startMs<200) return null
  const groundedEvidence=ctx.words
    .slice(firstWordId as number,(lastWordId as number)+1)
    .map(word=>word.w).join(' ').trim().slice(0,600)
  return {sourceId:ctx.sourceId,startMs,endMs,beat:beat.slice(0,100),
    label:beat.slice(0,100),reason:reason.slice(0,240),kind:'speech',
    ...(groundedEvidence?{groundedEvidence}:{})}
}

function cutFromVisual(
  ctx:YtWindowContext,observationId:unknown,startMs:unknown,endMs:unknown,
  beat:string,reason:string,
):YtSelectedCut | null{
  if(!Number.isSafeInteger(observationId)||
    !Number.isSafeInteger(startMs)||!Number.isSafeInteger(endMs))return null
  const observation: YtObservation | undefined=ctx.observations[observationId as number]
  if(!observation|| (startMs as number)<observation.startMs ||
    (endMs as number)>observation.endMs ||
    (endMs as number)-(startMs as number)<200) return null
  const groundedEvidence=observation.description.trim().slice(0,600)
  return {sourceId:ctx.sourceId,startMs:startMs as number,endMs:endMs as number,
    beat:beat.slice(0,100),label:beat.slice(0,100),reason:reason.slice(0,240),
    kind:'visual',...(groundedEvidence?{groundedEvidence}:{})}
}

/** Visual scene endpoints, not transcript lines, authorize long action ranges.
 * The watched observations must cover the scene without an unobserved >20s hole. */
export function ytVisualSceneCovered(ctx:YtWindowContext,startMs:number,endMs:number):boolean{
  if(startMs<ctx.startMs||endMs>ctx.endMs||endMs<=startMs)return false
  const rows=ctx.observations.filter(o=>o.endMs>startMs&&o.startMs<endMs)
    .sort((a,b)=>a.startMs-b.startMs)
  if(!rows.length || rows[0]!.startMs>startMs+2000)return false
  let covered=rows[0]!.endMs
  for(const row of rows.slice(1)){
    if(row.startMs>covered+20_000)return false
    covered=Math.max(covered,row.endMs)
  }
  return covered>=endMs-2000
}

function cutFromScene(ctx:YtWindowContext,row:Record<string,unknown>):YtSelectedCut|null{
  const startMs=Number(row.startMs),endMs=Number(row.endMs)
  if(!Number.isSafeInteger(startMs)||!Number.isSafeInteger(endMs)||
     !ytVisualSceneCovered(ctx,startMs,endMs))return null
  const observations=ctx.observations.filter(o=>o.endMs>startMs&&o.startMs<endMs)
  const beat=String(row.beat??'Gameplay scene').slice(0,140)
  return {
    sourceId:ctx.sourceId,startMs,endMs,beat,label:beat,kind:'visual',
    reason:String(row.reason??'Complete visually observed game scene').slice(0,500),
    groundedEvidence:observations.map(o=>o.description).join(' | ').slice(0,1800),
  }
}

function acceptNonOverlapping(
  candidates:YtSelectedCut[],rejected:YtCutsResult['rejected'],
):YtCutsResult{
  const cuts:YtSelectedCut[]=[]
  // When starts coincide, the complete scene wins over any micro-beat.
  candidates.sort((a,b)=>a.startMs-b.startMs || (b.endMs-b.startMs)-(a.endMs-a.startMs))
  for(const candidate of candidates){
    if(cuts.length && candidate.startMs<cuts[cuts.length-1]!.endMs){
      rejected.push({startMs:candidate.startMs,endMs:candidate.endMs,
        code:'yt_overlapping_footage'})
      continue
    }
    cuts.push(candidate)
  }
  return {cuts,rejected}
}

export async function ytSelectFootage(
  ctx:YtWindowContext,outline:YtOutline,
):Promise<YtCutsResult>{
  const raw=await ytStructuredDecision('yt_submit_footage',
    'FOOTAGE: BUILD COMPLETE SCENES FROM ON-SCREEN ACTION FIRST. Select continuous observed visual sequences by observation IDs and their original start/end timestamps; preserve 45–60 second or longer scenes where source evidence supports them. Keep a pursuit until escaped/caught, a fight until won/lost, and a mission until completion/failure. VISUAL GAMEPLAY IS PRIMARY: action start/end is defined by the picture. AUDIO IS SECONDARY BUT MUST BE KEPT WHEN IMPORTANT: select every genuinely funny line, memorable RP dialogue, emotional reaction or hype moment even over quiet video. If this happens DURING a mission/chase/fight, retain it inside the unbroken visual scene; do not cut away until visual resolution. Avoid clips made of transcript snippets. Choose spoken passages by ZERO-BASED word IDs only for indispensable RP dialogue not otherwise covered by visual sequences. Use observed visual-only events by observationId even if nobody speaks. Preserve actual scene order; do not force an episode ending in a non-final window. Retain complete gameplay scenes with their necessary setup and consequences, including meaningful silent gameplay; do not reduce this to a highlight reel. Lightly remove only AFK, loading, menus, repetitive grinding and off-story chat. Across the source aim for 25–35% retained with a 15–40 minute episode. Every interval must be inside this window.',
    {...evidenceRows(ctx),outline},
    {
      scenes:{type:'array',maxItems:50,items:{type:'object',additionalProperties:false,
        properties:{startMs:intField,endMs:intField,beat:stringField,reason:stringField},
        required:['startMs','endMs','beat','reason']}},
      speech:{type:'array',maxItems:80,items:{type:'object',additionalProperties:false,
        properties:{firstWordId:intField,lastWordId:intField,beat:stringField,reason:stringField},
        required:['firstWordId','lastWordId','beat','reason']}},
      visual:{type:'array',maxItems:60,items:{type:'object',additionalProperties:false,
        properties:{observationId:intField,startMs:intField,endMs:intField,beat:stringField,reason:stringField},
        required:['observationId','startMs','endMs','beat','reason']}},
    },['scenes','speech','visual'])
  if(!Array.isArray(raw.scenes)||!Array.isArray(raw.speech)||!Array.isArray(raw.visual))throw Error('yt_footage_missing_arrays')
  const candidate:YtSelectedCut[]=[]
  const rejected:YtCutsResult['rejected']=[]
  for(const [i,row] of raw.scenes.slice(0,50).entries()){
    const obj=row&&typeof row==='object'?row as Record<string,unknown>:{}
    const cut=cutFromScene(ctx,obj)
    if(cut)candidate.push(cut)
    else rejected.push({startMs:i,endMs:i,code:'yt_scene_visual_coverage_missing'})
  }
  const sceneCandidates=[...candidate]
  for(const [i,row] of raw.speech.slice(0,80).entries()){
    const obj=row&&typeof row==='object'?row as Record<string,unknown>:{}
    const cut=cutFromWords(ctx,obj.firstWordId,obj.lastWordId,String(obj.beat??''),String(obj.reason??''))
    if(cut && !sceneCandidates.some(scene=>scene.endMs>cut.startMs&&scene.startMs<cut.endMs))candidate.push(cut)
    else if(!cut) rejected.push({startMs:i,endMs:i,code:'yt_invalid_word_ids'})
  }
  for(const [i,row] of raw.visual.slice(0,60).entries()){
    const obj=row&&typeof row==='object'?row as Record<string,unknown>:{}
    const cut=cutFromVisual(ctx,obj.observationId,obj.startMs,obj.endMs,
      String(obj.beat??''),String(obj.reason??''))
    if(cut && !sceneCandidates.some(scene=>scene.endMs>cut.startMs&&scene.startMs<cut.endMs))candidate.push(cut)
    else if(!cut) rejected.push({startMs:i,endMs:i,code:'yt_visual_evidence_invalid'})
  }
  // Full-screen scene spans take precedence over their contained dialog or beat markers.
  candidate.sort((a,b)=>a.startMs-b.startMs||(b.endMs-b.startMs)-(a.endMs-a.startMs))
  const selected=acceptNonOverlapping(candidate,rejected)
  if(!selected.cuts.length)throw Error('yt_no_verified_footage')
  return selected
}

export async function ytDialoguePictureReview(
  ctx:YtWindowContext,outline:YtOutline,cuts:YtSelectedCut[],
):Promise<YtCutsResult>{
  const joined=cuts.map((cut,index)=>({
    index,startMs:cut.startMs,endMs:cut.endMs,kind:cut.kind,beat:cut.beat,
    dialogue:ctx.words.filter(w=>
      w.e*1000>cut.startMs&&w.s*1000<cut.endMs).map(w=>w.w).join(' '),
  }))
  const raw=await ytStructuredDecision('yt_submit_dialogue_picture',
    'DIALOGUE/PICTURE: Validate complete on-screen action and visual cause → resolution before dialogue. Do not trim a chase, fight, heist or escape mid-action. Merge naturally continuous footage and keep significant quiet gameplay. Check every scene join and incomplete thought. Return ONLY safe trims to existing passages by exact original word IDs for spoken footage; do not introduce new footage, alter story order, trim away a setup or payoff, or remove visual-only actions. Use light trims only; empty adjustments means no edits needed.',
    {outline,joined,fullOriginalTranscript:evidenceRows(ctx).originalTranscriptWordIds,
      observedVideoAndOriginalAudio:evidenceRows(ctx).observedVideoAndOriginalAudio},
    {adjustments:{type:'array',maxItems:24,items:{type:'object',additionalProperties:false,
      properties:{index:intField,firstWordId:intField,lastWordId:intField,reason:stringField},
      required:['index','firstWordId','lastWordId','reason']}}},
    ['adjustments'])
  if(!Array.isArray(raw.adjustments))throw Error('yt_dialogue_invalid_submission')
  const next=cuts.map(c=>({...c}))
  const rejected:YtCutsResult['rejected']=[]
  const seen=new Set<number>()
  for(const item of raw.adjustments){
    const obj=item&&typeof item==='object'?item as Record<string,unknown>:{}
    const index=obj.index
    if(!Number.isSafeInteger(index) || (index as number)<0 ||
      (index as number)>=next.length || seen.has(index as number)){
      rejected.push({startMs:0,endMs:0,code:'yt_dialogue_bad_index'});continue
    }
    seen.add(index as number)
    const original=next[index as number]!
    if(original.kind!=='speech'){
      rejected.push({startMs:original.startMs,endMs:original.endMs,code:'yt_dialogue_cannot_trim_visual'});continue
    }
    const replacement=cutFromWords(ctx,obj.firstWordId,obj.lastWordId,original.beat,original.reason)
    if(!replacement||replacement.startMs<original.startMs ||
      replacement.endMs>original.endMs){
      rejected.push({startMs:original.startMs,endMs:original.endMs,code:'yt_dialogue_outside_selected_passage'});continue
    }
    next[index as number]=replacement
  }
  for(let i=1;i<next.length;i++){
    if(next[i]!.startMs<next[i-1]!.endMs)throw Error('yt_dialogue_overlap_after_review')
  }
  return {cuts:next,rejected}
}

export type YtQaResult = { pass: boolean; issues: string[] }

/** QA is scoped to verifiable window evidence and appropriate episode boundaries. */
export async function ytQualityReview(
  ctx:YtWindowContext,outline:YtOutline,cuts:YtSelectedCut[],
):Promise<YtQaResult>{
  const first=ctx.windowIndex===0
  const last=ctx.windowCount==null||ctx.windowIndex==null||
    ctx.windowIndex===ctx.windowCount-1
  const raw=await ytStructuredDecision('yt_submit_quality_review',
    'QA: Window '+String((ctx.windowIndex??0)+1)+' of '+String(ctx.windowCount??1)+
    '. Screen/action first: visually complete missions, pursuits, fights, regrouping and escapes. Preserve funny lines, hype and reactions as secondary storytelling, never as reasons to cut an unresolved on-screen sequence. '+
    (first?'Verify an authentic opening and clear stakes. ':'Do not demand a new episode opening in this intermediate window. ')+
    (last?'Verify the real recorded resolution. ':'Do not demand a complete episode ending in this intermediate window. ')+
    'Reject missing setup, payoff, quiet action, visual discontinuity and isolated transcript-sized clips. Give FULL explanations with scene/source times and exact fixes; not just category codes. Runtime is only a soft guide.',
    {windowIndex:ctx.windowIndex??0,windowCount:ctx.windowCount??1,outline,
      cuts:cuts.map((cut,index)=>({
        index,kind:cut.kind,startMs:cut.startMs,endMs:cut.endMs,
        beat:cut.beat,
        dialogue:ctx.words.filter(w=>w.e*1000>cut.startMs&&w.s*1000<cut.endMs).map(w=>w.w).join(' '),
      })),observedVideoAndOriginalAudio:evidenceRows(ctx).observedVideoAndOriginalAudio},
    {pass:{type:'boolean'},issues:{type:'array',items:stringField,maxItems:30}},
    ['pass','issues'])
  return {pass:raw.pass===true,issues:Array.isArray(raw.issues)
    ?raw.issues.filter((v):v is string=>typeof v==='string').slice(0,30):[]}
}
