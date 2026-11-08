import 'server-only'

import type {ClipWord} from '@/lib/clips/edits'
import type {AiProducerSourceRef} from '@/lib/ai-producer-agent/types'
import {lunaChat,type LunaUsage,type LunaMessage} from '@/lib/ai-producer-agent/luna-client'
import type {ToolSchema} from '@/lib/ai-producer-agent/tools/schemas'
import type {ExecutableMultiStoryCut,MultiStoryPlan} from '@/lib/ai-producer-agent/multi-source-story'
import {wordAtUnsafeBoundary} from '@/lib/ai-producer-agent/validate'

export type CleanTakeObservation={startMs:number;endMs:number;observation:string;whyInteresting?:string;spokenContext?:string;category?:string;analysisTier:'coarse_3s'|'focused_1fps'}
export type CleanTakeSource={source:AiProducerSourceRef;words:ClipWord[];visualObservations?:CleanTakeObservation[];visualEvidence?:{originalAudioAttached:boolean;asrTranscriptAttached:boolean;coarseCount:number;focusedCount:number}}
export type CleanTakeDecision={sourceId:string;firstWordId?:number;lastWordId?:number;startMs?:number;endMs?:number;observationIndex?:number;kind?:'dialogue'|'media_moment';reason:string}
export type CleanTakePlan=MultiStoryPlan & {mode:'clean_take_v1'}
export type CleanTakeEvent={stage:'take_selection'|'review';attempt:number;status:'accepted'|'rejected'|'fallback';reason?:string;cuts?:number;sourceSequence?:string[];repairHint?:string;invalidSelectionIndex?:number;proposalSummary?:Array<{index:number;sourceId:string;kind:string;startMs:number|null;endMs:number|null;firstWordId:number|null;lastWordId:number|null;observationIndex:number|null}>}
export type CleanTakeObserver=(event:CleanTakeEvent)=>void|Promise<void>

const text={type:'string'} as const
const wordId={type:'integer',minimum:0} as const
const selectionSchema:ToolSchema={
  name:'submit_clean_take',
  description:'Build a source-grounded final clean talking-head edit from multiple attempts, with one best completed take for each intended idea.',
  parameters:{type:'object',additionalProperties:false,properties:{
    title:text,summary:text,endingRule:text,
    selections:{type:'array',minItems:1,maxItems:48,items:{
      type:'object',additionalProperties:false,properties:{
        sourceId:text,firstWordId:wordId,lastWordId:wordId,
        kind:{type:'string',enum:['dialogue','media_moment']},
        startMs:{type:'integer',minimum:0},endMs:{type:'integer',minimum:1},
        observationIndex:wordId,reason:text,
      },required:['sourceId','reason'],
    }},
    droppedTakeReasons:{type:'array',maxItems:24,items:text},
  },required:['title','summary','endingRule','selections']},
}
const reviewSchema:ToolSchema={
  name:'review_clean_take',
  description:'Independently check the assembled clean edit for unfinished retakes, duplicated ideas, missing meaning, and awkward joins.',
  parameters:{type:'object',additionalProperties:false,properties:{
    pass:{type:'boolean'},issues:{type:'array',maxItems:12,items:text},
  },required:['pass','issues']},
}
function nonempty(v:unknown,field='text'):string{
  if(typeof v!=='string'||!v.trim())throw Error('clean_take_invalid_text:'+field)
  return v.trim().slice(0,600)
}
function object(v:unknown):Record<string,unknown>{
  if(!v||typeof v!=='object'||Array.isArray(v))throw Error('clean_take_invalid_object')
  return v as Record<string,unknown>
}
export function validateCleanTakeSources(inputs:CleanTakeSource[]):void{
  if(inputs.length<1||inputs.length>5)throw Error('clean_take_requires_1_to_5_recordings')
  const ids=new Set<string>(),projects=new Set<string>()
  for(const {source,words} of inputs){
    if(!source.sourceId||ids.has(source.sourceId)||!source.projectId||
      projects.has(source.projectId)||!source.rangeMs||
      source.rangeMs[1]<=source.rangeMs[0]||!words.length)
      throw Error('clean_take_invalid_or_duplicate_recording')
    ids.add(source.sourceId);projects.add(source.projectId)
  }
}
export function validateCleanTakeSelections(raw:unknown,inputs:CleanTakeSource[]):ExecutableMultiStoryCut[]{
  validateCleanTakeSources(inputs)
  if(!Array.isArray(raw)||raw.length<1||raw.length>48)
    throw Error('clean_take_invalid_selection_count')
  const byId=new Map(inputs.map(s=>[s.source.sourceId,s]))
  const cuts:ExecutableMultiStoryCut[]=[]
  for(const [index,item] of raw.entries()){
    const obj=object(item),sourceId=nonempty(obj.sourceId,'selection_'+index+'.sourceId'),src=byId.get(sourceId)
    if(!src)throw Error('clean_take_invalid_source:selection_'+index+':'+sourceId)
    const mediaOnly=obj.kind==='media_moment'
    if(obj.kind!==undefined&&obj.kind!=='dialogue'&&!mediaOnly)
      throw Error('clean_take_invalid_cut_kind')
    let first=-1,last=-1,startMs:number,endMs:number
    if(mediaOnly){
      // Visual or acoustic footage is allowed WITHOUT transcript word IDs.
      // The supplied source video/audio observation must substantiate the
      // actual time range. A transcript cannot veto a meaningful silent clip.
      if(!Number.isInteger(obj.observationIndex))
        throw Error('clean_take_media_evidence_required:selection_'+index)
      const observation=src.visualObservations?.[obj.observationIndex as number]
      if(!observation||!Number.isInteger(obj.startMs)||!Number.isInteger(obj.endMs))
        throw Error('clean_take_media_evidence_required:selection_'+index+':observationIndex='+obj.observationIndex)
      startMs=obj.startMs as number
      endMs=obj.endMs as number
      if(startMs<observation.startMs||endMs>observation.endMs||
         endMs-startMs<400||endMs-startMs>60000)
        throw Error('clean_take_media_cut_outside_observation:selection_'+index+':source='+sourceId+':proposed=['+startMs+','+endMs+']:allowed=['+observation.startMs+','+observation.endMs+']:minDuration=400:maxDuration=60000')
      // Word timing is ONLY a mechanical safety check at the edges.
      // Whether to retain the action/performance belongs to the media model.
      if(wordAtUnsafeBoundary(startMs,src.words)||
         wordAtUnsafeBoundary(endMs,src.words))
        throw Error('clean_take_media_cut_inside_spoken_word:selection_'+index+':source='+sourceId+':edges=['+startMs+','+endMs+']')
    }else{
      const firstRaw=obj.firstWordId,lastRaw=obj.lastWordId
      if(!Number.isInteger(firstRaw)||!Number.isInteger(lastRaw)||
         (firstRaw as number)<0||(lastRaw as number)<(firstRaw as number)||
         (lastRaw as number)>=src.words.length)
        throw Error('clean_take_invalid_word_range:selection_'+index+':source='+sourceId+':validWordIds=0..'+(src.words.length-1))
      first=firstRaw as number;last=lastRaw as number
      startMs=Math.round(src.words[first]!.s*1000)
      endMs=Math.round(src.words[last]!.e*1000)
    }
    if(endMs-startMs<400||startMs<src.source.rangeMs![0]||
       endMs>src.source.rangeMs![1])
      throw Error('clean_take_cut_outside_recording:selection_'+index+':source='+sourceId+':allowed='+JSON.stringify(src.source.rangeMs))
    // Retakes are not repeated in the output; don't play the same source
    // interval twice, even if the LLM assigns a different reason.
    const overlappingIndex=cuts.findIndex(c=>c.sourceId===sourceId&&
      Math.max(c.startMs,startMs)<Math.min(c.endMs,endMs))
    if(overlappingIndex>=0)
      throw Error('clean_take_overlapping_selected_takes:selection_'+index+
        ':conflictsWith='+overlappingIndex+':source='+sourceId+
        ':proposed=['+startMs+','+endMs+']:existing=['+
        cuts[overlappingIndex]!.startMs+','+cuts[overlappingIndex]!.endMs+']')
    cuts.push({
      sourceId,sourceProjectId:src.source.projectId!,
      firstWordId:first,lastWordId:last,
      startMs,endMs,beatId:'clean_take',
      ...(mediaOnly?{kind:'visual_action' as const}:{}),
      reason:nonempty(obj.reason,'selection_'+index+'.reason'),
    })
  }
  return cuts
}
/** Normalize optional video/audio moments to actual safe source boundaries.
 * The creative selection and observation are immutable evidence; only move
 * mechanical edges within the same observed event. Dialogue word-ID selections
 * are never moved, skipped, or reinterpreted. Unrecoverable optional media is
 * omitted rather than rejecting an otherwise valid talking-head paper edit. */
export function repairCleanTakeMediaSelections(raw:unknown,inputs:CleanTakeSource[]):{
  selections:unknown;repairs:Array<{index:number;from:[number,number];to:[number,number]}>;
  omitted:Array<{index:number;reason:string}>;
}{
  if(!Array.isArray(raw))return {selections:raw,repairs:[],omitted:[]}
  const byId=new Map(inputs.map(x=>[x.source.sourceId,x]))
  const repairs:Array<{index:number;from:[number,number];to:[number,number]}>=[]
  const omitted:Array<{index:number;reason:string}>=[]
  const kept:Array<Record<string,unknown>>=[]
  const speechWindows:Array<{sourceId:string;startMs:number;endMs:number}>=[]
  for(const row of raw){
    if(!row||typeof row!=='object'||Array.isArray(row))continue
    const item=row as Record<string,unknown>
    if(item.kind==='media_moment')continue
    const src=byId.get(String(item.sourceId??''))
    const first=item.firstWordId,last=item.lastWordId
    if(src&&Number.isInteger(first)&&Number.isInteger(last)&&
      (first as number)>=0&&(last as number)>=(first as number)&&
      (last as number)<src.words.length){
      speechWindows.push({sourceId:src.source.sourceId,
        startMs:Math.round(src.words[first as number]!.s*1000),
        endMs:Math.round(src.words[last as number]!.e*1000)})
    }
  }
  const overlaps=(a:number,b:number,c:number,d:number)=>Math.max(a,c)<Math.min(b,d)
  for(const [index,entry] of raw.entries()){
    if(!entry||typeof entry!=='object'||Array.isArray(entry)){
      kept.push(entry as Record<string,unknown>);continue
    }
    const item=entry as Record<string,unknown>
    if(item.kind!=='media_moment'){kept.push(item);continue}
    const src=byId.get(String(item.sourceId??''))
    const observation=src?.visualObservations?.[item.observationIndex as number]
    const start=item.startMs,end=item.endMs
    if(!src||!observation||!Number.isInteger(start)||!Number.isInteger(end)||
      observation.endMs-observation.startMs<400){
      omitted.push({index,reason:'missing_or_unusable_observed_media'});continue
    }
    const range=src.source.rangeMs!
    const low=Math.max(observation.startMs,range[0])
    const high=Math.min(observation.endMs,range[1])
    if(high-low<400){omitted.push({index,reason:'observation_shorter_than_safe_cut'});continue}
    const unsafe=(ms:number)=>Boolean(wordAtUnsafeBoundary(ms,src.words))
    // Search 20-ms increments no more than 800 ms from the submitted edges.
    // A too-short media action can be extended to 400 ms ONLY inside the
    // original observed event and with legal original-audio word boundaries.
    const candidateEdges=(original:number,minimum:number,maximum:number)=>{
      const options:number[]=[]
      for(let offset=0;offset<=800;offset+=20){
        for(const candidate of offset===0?[original]:[original-offset,original+offset]){
          if(candidate>=minimum&&candidate<=maximum&&!unsafe(candidate))
            options.push(candidate)
        }
      }
      return options
    }
    const begins=candidateEdges(start as number,low,high-400)
    const ends=candidateEdges(end as number,low+400,high)
    let best:[number,number]|null=null,score=Infinity
    for(const a of begins)for(const b of ends){
      if(b-a<400||b-a>60000)continue
      if(speechWindows.some(w=>w.sourceId===src.source.sourceId&&overlaps(a,b,w.startMs,w.endMs)))continue
      if(kept.some(w=>w.kind==='media_moment'&&w.sourceId===src.source.sourceId&&
        typeof w.startMs==='number'&&typeof w.endMs==='number'&&
        overlaps(a,b,w.startMs,w.endMs)))continue
      const cost=Math.abs(a-(start as number))+Math.abs(b-(end as number))
      if(cost<score){score=cost;best=[a,b]}
    }
    if(!best){
      omitted.push({index,reason:'no_safe_observed_nonoverlapping_media_interval'})
      continue
    }
    const [a,b]=best
    if(a!==start||b!==end)repairs.push({index,from:[start as number,end as number],to:best})
    kept.push({...item,startMs:a,endMs:b})
  }
  return {selections:kept,repairs,omitted}
}

function transcripts(inputs:CleanTakeSource[]){
  return inputs.map(({source,words})=>({
    sourceId:source.sourceId,title:source.title,rangeMs:source.rangeMs,
    // Full source transcript, not snippets around heuristically detected fillers.
    words:words.map((w,i)=>[i,Math.round(w.s*1000),Math.round(w.e*1000),w.w,w.spk??null]),
    visualAudioObservations:(inputs.find(x=>x.source.sourceId===source.sourceId)?.visualObservations??[])
      .map((observation,observationIndex)=>({observationIndex,...observation})),
    visualEvidence:inputs.find(x=>x.source.sourceId===source.sourceId)?.visualEvidence??null,
  }))
}
function preview(cuts:ExecutableMultiStoryCut[],inputs:CleanTakeSource[]){
  return cuts.map((cut,index)=>({
    index,sourceId:cut.sourceId,startMs:cut.startMs,endMs:cut.endMs,
    kind:cut.kind??'dialogue',
    reason:cut.reason,firstWordId:cut.firstWordId,lastWordId:cut.lastWordId,
    text:cut.kind==='visual_action'?'[Selected direct video/original-audio moment]':
      inputs.find(s=>s.source.sourceId===cut.sourceId)!.words
        .slice(cut.firstWordId,cut.lastWordId+1).map(w=>w.w).join(' '),
  }))
}
/**
 * Isolated recording-cleanup mode. A creator may speak naturally, restart a
 * sentence, retry a paragraph, change their mind, or record additional takes.
 * The model selects only completed strong takes, not an unrelated highlights
 * reel. Renderer gets the existing source-absolute word-exact passages.
 */
export async function planCleanTake(
  inputs:CleanTakeSource[],instruction?:string,
  onUsage?:(usage:LunaUsage|undefined)=>void,
  onEvent?:CleanTakeObserver,
):Promise<{plan:CleanTakePlan;review:{pass:boolean;issues:string[]};droppedTakeReasons:string[]}>{
  validateCleanTakeSources(inputs)
  // A transcript-only model must never masquerade as multimodal Clean Take.
  for(const source of inputs){
    if(!source.visualEvidence?.originalAudioAttached||
       !source.visualEvidence.asrTranscriptAttached||
       !source.visualEvidence.coarseCount||!source.visualObservations?.length)
      throw Error('clean_take_requires_video_audio_transcript_evidence')
  }
  const messages:LunaMessage[]=[
    {role:'system',content:[
      'CLEAN TAKE EDITOR: Produce ONE polished, truthful, natural talking-head video from one or more recordings of the SAME intended presentation/session.',
      'Give video and original audio equal authority to suggest, preserve, discard or favor a take independently of whether speech is present. Evidence from video/audio can outweigh a transcript-only preference. Use THREE modalities together for EVERY editing choice: FULL word-ID transcript, timestamped Gemini visual observations from video FRAMES, and Gemini observations of ORIGINAL audio/speech delivery. These are observations, not direct playback by this model. Prefer complete confident takes with better delivery, stable eye contact/framing, natural gestures and continuity; weigh against spoken correctness. If an observation does not address a claimed vocal or visual quality, do not infer it. All selected word IDs must come from source transcripts, never observations. Understand the ENTIRE original transcript before editing. Identify intended message/sections, false starts, repeated attempts at a sentence or paragraph, correction of factual errors, unwanted ums/ahs, flubs, restarts, and long tangents.',
      'Select the strongest COMPLETE take of each idea; when a speaker restarts and corrects themself, favor the later accurate fluent take if supported, not both mistaken and corrected versions. Preserve the intended message and chronological/logical section order, but source recordings can be revisited when they contain replacement takes. Keep intentional rhetorical repetition, emotion, pauses and conversational tone. Do not delete all fillers mechanically, cut mid-word, or create unnatural jump cuts.',
      'Treat an interview question and its relevant answer as an exchange. Do not splice answers to different questions or present separate sessions as one continuous exchange.',
      'Choose dialogue cuts using source-local exact firstWordId/lastWordId. ALSO independently choose valuable REAL VIDEO/AUDIO moments using kind=media_moment, observationIndex, source-local startMs/endMs bounded to that time-coded observed event. For media_moment do NOT supply word IDs. This is especially important for demonstrations, on-screen reactions, a revealing gesture or expressive silence, audio cues, and nonverbal performance. Do not demand speech or transcript evidence for a nonverbal beat. The media observations are autonomous editing evidence, not just supporting captions. Exclude bad attempts in the gaps. Keep complete sentences or coherent paragraphs. Every retained segment must flow into the next as a real speaker would mean it. Pick all meaningful completed content—not merely a few viral highlights. No fixed length, target number of cuts, or source quota.',
      'Actively inspect the VIDEO/AUDIO evidence for meaningful shots that the transcript missed, and allow a media_moment to win even with no useful dialogue. Do not include every observed clip: each must make the final presentation better, preserve original audio and fit the creator intention. For each proposed retained take cross-check the video/audio observations for flubs, grimaces, resets, coughs, off-camera interruptions, visible cuts, delivery, and genuine conversational pauses. Check both sides of every join for a plausible visual/acoustic seam and flag unverified seams for final rendered-media audition. You may keep adjacent genuine takes, intercut recordings, or leave extended untouched sections. Source IDs are NOT speaker identities. Return one final ordered list with reasons and a few notes explaining the abandoned retakes.',
    ].join(' ')},
    {role:'user',content:JSON.stringify({instruction:instruction??'Clean the performance, preserving its meaning and natural delivery.',sources:transcripts(inputs)})},
  ]
  let chosen:Record<string,unknown>|null=null
  let cuts:ExecutableMultiStoryCut[]=[]
  for(let attempt=1;attempt<=3;attempt++){
    const reply=await lunaChat({messages,tools:[selectionSchema],toolChoice:'required'})
    onUsage?.(reply.usage)
    const call=reply.message.tool_calls?.find(x=>x.function.name===selectionSchema.name)
    try{
      if(!call)throw Error('clean_take_required_tool_missing')
      const parsed=object(JSON.parse(call.function.arguments))
      // Normalize bounded, optional video-only cuts once before strict
      // validation. A mechanically invalid media edge must not make the
      // model re-author dozens of otherwise valid dialogue takes.
      const mediaRepair=repairCleanTakeMediaSelections(parsed.selections,inputs)
      cuts=validateCleanTakeSelections(mediaRepair.selections,inputs)
      if(mediaRepair.repairs.length||mediaRepair.omitted.length){
        await onEvent?.({stage:'take_selection',attempt,status:'fallback',
          reason:JSON.stringify({mediaBoundaryRepairs:mediaRepair.repairs,
            omittedUnexecutableMedia:mediaRepair.omitted}).slice(0,1600),
          cuts:cuts.length})
      }
      nonempty(parsed.title,'title');nonempty(parsed.summary,'summary');nonempty(parsed.endingRule,'endingRule')
      chosen=parsed
      await onEvent?.({stage:'take_selection',attempt,status:'accepted',cuts:cuts.length,
        sourceSequence:cuts.map(c=>c.sourceId)})
      break
    }catch(error){
      const reason=String((error as Error).message)
      const match=reason.match(/selection_(\d+)/)
      const invalidSelectionIndex=match?Number(match[1]):undefined
      const proposalSummary=call?(()=>{
        try{
          const selections=object(JSON.parse(call.function.arguments)).selections
          if(!Array.isArray(selections))return []
          return selections.slice(0,48).map((item,index)=>{
            const row=item&&typeof item==='object'?item as Record<string,unknown>:{}
            return {index,sourceId:String(row.sourceId??'').slice(0,70),
              kind:String(row.kind??'dialogue').slice(0,30),
              startMs:typeof row.startMs==='number'?row.startMs:null,
              endMs:typeof row.endMs==='number'?row.endMs:null,
              firstWordId:typeof row.firstWordId==='number'?row.firstWordId:null,
              lastWordId:typeof row.lastWordId==='number'?row.lastWordId:null,
              observationIndex:typeof row.observationIndex==='number'?row.observationIndex:null}
          })
        }catch{return []}
      })():[]
      const repairHint=reason.startsWith('clean_take_invalid_text')?
        'Provide nonempty title, summary, endingRule and selection reasons.':
        reason.startsWith('clean_take_overlapping_selected_takes')?
          'Two selected ranges from the same recording overlap. Keep the stronger take or split into truly non-overlapping parts; do not duplicate playback.':
        reason.startsWith('clean_take_media_cut_outside_observation')?
          'The media_moment interval must lie entirely inside the referenced observation timestamps. If a longer demonstration is needed, use a valid dialogue span or an independently supported observation; never stretch its evidence.':
          'Fix the indexed invalid selection using the stated source-local bounds; preserve other coherent takes.'
      await onEvent?.({stage:'take_selection',attempt,status:'rejected',reason,
        repairHint,invalidSelectionIndex,proposalSummary})
      if(attempt===3)throw Error('clean_take_unusable_submissions:'+reason)
      if(call)messages.push(reply.message,{
        role:'tool',tool_call_id:call.id,
        content:JSON.stringify({ok:false,error:reason,
          invalidSelectionIndex,repairHint,proposalSummary,
          instruction:'Resubmit the COMPLETE proposal, keeping valid items unchanged where possible. Correct the specific invalid selection and required metadata. Do not invent footage. Dialogue uses word IDs; media_moment timestamps must fit entirely within their observation interval.'}),
      })
      else messages.push(reply.message,{role:'user',content:'Call submit_clean_take with exact source-local word IDs.'})
    }
  }
  const sourceIds=inputs.map(x=>x.source.sourceId)
  const outline={
    title:nonempty(chosen!.title),logline:nonempty(chosen!.summary),
    endingRule:nonempty(chosen!.endingRule),
    beats:[{id:'clean_take',purpose:'Polished complete presentation, best complete takes in coherent order',sourceIds}],
  }
  let plan:CleanTakePlan={mode:'clean_take_v1',outline,cuts,
    estimatedDurationMs:cuts.reduce((n,c)=>n+c.endMs-c.startMs,0)}
  const droppedTakeReasons=Array.isArray(chosen!.droppedTakeReasons)
    ? chosen!.droppedTakeReasons.filter((v):v is string=>typeof v==='string').slice(0,24)
    :[]
  let review:{pass:boolean;issues:string[]}={pass:false,issues:['Editorial review unavailable']}
  try{
    const result=await lunaChat({tools:[reviewSchema],toolChoice:'required',messages:[
      {role:'system',content:[
        'Independent CLEAN TAKE editorial QA. Use the original FULL transcript plus source-aligned timestamped video observations and ORIGINAL audio observations in the supplied evidence. Check each retained clip and its joins for visual reset, apparent delivery issues, framing changes and vocal hesitations where observations support them; explicitly distinguish observed effects from unknown effects requiring render playback. Evaluate the selected words in final playback order against the source recording and original transcript. Detect duplicate takes of the same idea, an abandoned sentence mistakenly retained, correction followed by an earlier wrong version, lost questions/answers, grammatical hard cuts, essential missing context, dangling ending, or filler removal that distorts meaning.',
        'Do NOT fail because source segments are numerous, few, or long. Natural filler/hesitation may be intentional. Do not claim you listened to the final MP4 or saw the visual seams. Give specific, actionable, source-grounded issues.',
      ].join(' ')},
      {role:'user',content:JSON.stringify({outline,selected:preview(cuts,inputs),
        originalTranscripts:transcripts(inputs),droppedTakeReasons})},
    ]})
    onUsage?.(result.usage)
    const call=result.message.tool_calls?.find(x=>x.function.name===reviewSchema.name)
    if(!call)throw Error('clean_take_review_missing')
    const parsed=object(JSON.parse(call.function.arguments))
    if(typeof parsed.pass!=='boolean'||!Array.isArray(parsed.issues)||
      parsed.issues.some(x=>typeof x!=='string'))
      throw Error('clean_take_review_invalid')
    review={pass:parsed.pass,issues:parsed.issues.slice(0,12).map(x=>x.slice(0,450))}
    await onEvent?.({stage:'review',attempt:1,status:'accepted',
      cuts:cuts.length,reason:review.pass?'pass':review.issues.join('; ').slice(0,350)})
  }catch(error){
    await onEvent?.({stage:'review',attempt:1,status:'fallback',
      reason:String((error as Error).message).slice(0,250)})
  }
  // One bounded rewrite from independent QA. This is the same original
  // transcript and word validator, not text reconstruction. Keep the initial
  // renderable plan if the revision is invalid or independent QA does not improve.
  if(!review.pass && review.issues.length && review.issues[0]!=='Editorial review unavailable'){
    try{
      const revisionResponse=await lunaChat({tools:[selectionSchema],toolChoice:'required',messages:[
        {role:'system',content:[
          'CLEAN TAKE REPAIR EDITOR: You have the entire original source transcript AND timestamped video-frame plus original-audio observations from the same media analysis. Use all three modalities to evaluate proposed retakes, awkward performance, join continuity and visual delivery. Do not infer actual final audio playback from observations. You have a validated first edit. Independent QA found concrete issues. Produce a BETTER complete final edit, not commentary.',
          'Repair dialogue OR independent media_moment cuts, grounded in the same observed original video/audio intervals with their observationIndex. Do not force nonverbal footage into word-ID spans. Correct duplicated retakes, broken sentences, dropped essential context, orphan questions or rough joins only using ORIGINAL local source word IDs. Do not invent words or delete intentional meaning. Preserve all other successful takes. You may reselect, split, remove or reorder real spans. One final ordered list.',
          'Never prioritize hitting a duration or removing every natural filler over the coherent performance.',
        ].join(' ')},
        {role:'user',content:JSON.stringify({
          instruction:instruction??null,originalTranscripts:transcripts(inputs),
          firstEdit:{outline:plan.outline,selected:preview(plan.cuts,inputs)},
          qaIssues:review.issues,
        })},
      ]})
      onUsage?.(revisionResponse.usage)
      const call=revisionResponse.message.tool_calls?.find(c=>c.function.name===selectionSchema.name)
      if(!call)throw Error('clean_take_revision_missing_tool')
      const parsed=object(JSON.parse(call.function.arguments))
      const revisedMedia=repairCleanTakeMediaSelections(parsed.selections,inputs)
      const revisedCuts=validateCleanTakeSelections(revisedMedia.selections,inputs)
      const changed=JSON.stringify(revisedCuts.map(c=>[c.sourceId,c.startMs,c.endMs,c.kind]))!==
        JSON.stringify(plan.cuts.map(c=>[c.sourceId,c.startMs,c.endMs,c.kind]))
      if(!changed)throw Error('clean_take_revision_no_change')
      const revisedOutline={
        ...plan.outline,title:nonempty(parsed.title),logline:nonempty(parsed.summary),
        endingRule:nonempty(parsed.endingRule),
      }
      const revisedReviewResponse=await lunaChat({tools:[reviewSchema],toolChoice:'required',messages:[
        {role:'system',content:[
          'Independent clean talking-head EDIT REVIEW using full transcript, video and ORIGINAL audio observations. Evaluate retained performance, visual composition/gestures, audio delivery, false starts, cuts, context, closing and prior QA concerns against time-aligned observations; note issues where evidence is missing. Judge the full edited transcript, retained best takes, cuts, context, closing and prior QA concerns. Do not reward shortening alone. Do not assert render audio or visual seams you did not inspect.',
          'Respond pass=true only when no important duplicate retakes, abandoned takes, dangling thoughts, or misleading discontinuities remain.',
        ].join(' ')},
        {role:'user',content:JSON.stringify({
          outline:revisedOutline,selected:preview(revisedCuts,inputs),
          originalTranscripts:transcripts(inputs),priorIssues:review.issues,
        })},
      ]})
      onUsage?.(revisedReviewResponse.usage)
      const qaCall=revisedReviewResponse.message.tool_calls?.find(x=>x.function.name===reviewSchema.name)
      if(!qaCall)throw Error('clean_take_revision_review_missing')
      const qaObj=object(JSON.parse(qaCall.function.arguments))
      if(typeof qaObj.pass!=='boolean'||!Array.isArray(qaObj.issues)||
        qaObj.issues.some(x=>typeof x!=='string'))throw Error('clean_take_revision_review_invalid')
      const revisedReview={pass:qaObj.pass,issues:qaObj.issues.slice(0,12).map((x:string)=>x.slice(0,450))}
      const improved=(revisedReview.pass&&!review.pass)||
        revisedReview.issues.length<review.issues.length
      await onEvent?.({stage:'review',attempt:2,status:improved?'accepted':'fallback',
        cuts:revisedCuts.length,reason:improved?'qa_repair_improved':'qa_repair_no_improvement'})
      if(improved){
        plan={...plan,outline:revisedOutline,cuts:revisedCuts,
          estimatedDurationMs:revisedCuts.reduce((total,c)=>total+c.endMs-c.startMs,0)}
        review=revisedReview
      }
    }catch(error){
      await onEvent?.({stage:'review',attempt:2,status:'fallback',
        reason:'qa_repair_rejected:'+String((error as Error).message).slice(0,180)})
    }
  }
  return {plan,review,droppedTakeReasons}
}
