import 'server-only'

import { lunaChat, type LunaMessage } from '@/lib/ai-producer-agent/luna-client'
import { YOUTUBE_VIDEO_STORY_SYSTEM } from '@/lib/youtube-video/story-options'
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
      'YOUTUBE STORY SPECIALIST: The original source is authoritative. No genre assumptions, fabricated events, mandatory runtime, or short-form compression. A coherent opening, development and actual source-recorded ending are required. Do not invent timestamp or quote evidence. Visual-only events count if observed by Gemini. The Deepgram transcript controls spoken word boundaries.',
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
    originalTranscriptWordIds:ctx.words.map((w,i)=>[i,Math.round(w.s*1000),Math.round(w.e*1000),w.w]),
    observedVideoAndOriginalAudio:ctx.observations.map((m,i)=>({
      observationId:i,startMs:m.startMs,endMs:m.endMs,
      description:m.description,whyInteresting:m.whyInteresting,category:m.category,
      tier:m.tier,
    })),
    instruction:ctx.instruction??'Find the strongest truthful story without a length target.',
  }
}

export async function ytCreateEditorialHandoff(ctx:YtWindowContext):Promise<YtOutline>{
  const raw=await ytStructuredDecision('yt_submit_story_outline',
    'STORY: Examine the entire source transcript AND Gemini video/original-audio observations. Identify one coherent story within this window, with an opening, development and genuine ending. An ending may be visual with no speech.',
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
    title:String(raw.title).slice(0,100),premise:String(raw.premise).slice(0,420),
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
  return {sourceId:ctx.sourceId,startMs,endMs,beat:beat.slice(0,100),
    label:beat.slice(0,100),reason:reason.slice(0,240),kind:'speech'}
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
  return {sourceId:ctx.sourceId,startMs:startMs as number,endMs:endMs as number,
    beat:beat.slice(0,100),label:beat.slice(0,100),reason:reason.slice(0,240),
    kind:'visual'}
}

function acceptNonOverlapping(
  candidates:YtSelectedCut[],rejected:YtCutsResult['rejected'],
):YtCutsResult{
  const cuts:YtSelectedCut[]=[]
  candidates.sort((a,b)=>a.startMs-b.startMs || a.endMs-b.endMs)
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
    'FOOTAGE: Choose final complete spoken passages by original ZERO-BASED word IDs. Use observed visual-only events by observationId even if nobody speaks. Preserve actual opening, development and ending. Choose only relevant footage, not a highlight reel or source inventory. Every interval must be inside this window. No duration target.',
    {...evidenceRows(ctx),outline},
    {
      speech:{type:'array',maxItems:24,items:{type:'object',additionalProperties:false,
        properties:{firstWordId:intField,lastWordId:intField,beat:stringField,reason:stringField},
        required:['firstWordId','lastWordId','beat','reason']}},
      visual:{type:'array',maxItems:12,items:{type:'object',additionalProperties:false,
        properties:{observationId:intField,startMs:intField,endMs:intField,beat:stringField,reason:stringField},
        required:['observationId','startMs','endMs','beat','reason']}},
    },['speech','visual'])
  if(!Array.isArray(raw.speech)||!Array.isArray(raw.visual))throw Error('yt_footage_missing_arrays')
  const candidate:YtSelectedCut[]=[]
  const rejected:YtCutsResult['rejected']=[]
  for(const [i,row] of raw.speech.slice(0,24).entries()){
    const obj=row&&typeof row==='object'?row as Record<string,unknown>:{}
    const cut=cutFromWords(ctx,obj.firstWordId,obj.lastWordId,String(obj.beat??''),String(obj.reason??''))
    if(cut)candidate.push(cut)
    else rejected.push({startMs:i,endMs:i,code:'yt_invalid_word_ids'})
  }
  for(const [i,row] of raw.visual.slice(0,12).entries()){
    const obj=row&&typeof row==='object'?row as Record<string,unknown>:{}
    const cut=cutFromVisual(ctx,obj.observationId,obj.startMs,obj.endMs,
      String(obj.beat??''),String(obj.reason??''))
    if(cut)candidate.push(cut)
    else rejected.push({startMs:i,endMs:i,code:'yt_visual_evidence_invalid'})
  }
  const selected=acceptNonOverlapping(candidate,rejected)
  if(!selected.cuts.length)throw Error('yt_no_verified_footage')
  return selected
}

export async function ytDialoguePictureReview(
  ctx:YtWindowContext,outline:YtOutline,cuts:YtSelectedCut[],
):Promise<YtCutsResult>{
  const joined=cuts.map((cut,index)=>({
    index,startMs:cut.startMs,endMs:cut.endMs,kind:cut.kind,beat:cut.beat,
    dialogue:cut.kind==='speech'?ctx.words.filter(w=>
      w.e*1000>cut.startMs&&w.s*1000<cut.endMs).map(w=>w.w).join(' '):null,
  }))
  const raw=await ytStructuredDecision('yt_submit_dialogue_picture',
    'DIALOGUE/PICTURE: Check every scene join, incomplete thought and on-screen action. Return ONLY safe trims to existing passages by exact original word IDs for spoken footage; do not introduce new footage, alter the story order or remove visual-only actions. Empty adjustments means no needed edits.',
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

export async function ytQualityReview(
  ctx:YtWindowContext,outline:YtOutline,cuts:YtSelectedCut[],
):Promise<void>{
  const raw=await ytStructuredDecision('yt_submit_quality_review',
    'QA: Independently verify the opening makes sense, each passage is source-grounded, joins make sense, visual-only evidence is genuine, and the ending completes the intended story. Do NOT apply time limits. Fail if a misleading or incomplete story would render.',
    {outline,cuts:cuts.map((cut,index)=>({
      index,kind:cut.kind,startMs:cut.startMs,endMs:cut.endMs,
      beat:cut.beat,
      dialogue:cut.kind==='speech'?ctx.words.filter(w=>w.e*1000>cut.startMs&&w.s*1000<cut.endMs).map(w=>w.w).join(' '):null,
    })),observedVideoAndOriginalAudio:evidenceRows(ctx).observedVideoAndOriginalAudio},
    {pass:{type:'boolean'},issues:{type:'array',items:stringField,maxItems:12}},
    ['pass','issues'])
  if(raw.pass!==true)throw Error('yt_qa_rejected_story')
}
