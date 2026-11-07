import type { ClipWord } from '@/lib/clips/edits'
import type { EditorialSelection } from '@/lib/ai-producer-agent/specialists'
import type { VisualMomentEvidence } from '@/lib/ai-producer-agent/visual-evidence'
import { wordAtUnsafeBoundary } from '@/lib/ai-producer-agent/validate'

export type VisualBeatCandidate = VisualMomentEvidence & {
  id: string
  /** Evidence-based hypothesis, not a claim that a joke actually landed. */
  whyFunnyToWatch: string
}

export type StoryVisualBeat = {
  id: string
  whyFunnyToWatch: string
  narrativePurpose: string
}

export type VisualActionRequest = {
  visualBeatId: string
  startMs: number
  endMs: number
  beat: string
  reason: string
}

export type VisualActionSelection = EditorialSelection & {
  kind: 'visual_action'
  visualBeatId: string
}

/** Deduplicate coarse and focused observations only when they describe the
 * same region. Preserve source timestamps. These are CANDIDATES, not edits. */
export function buildVisualBeatCandidates(
  coarse: VisualMomentEvidence[], focused: VisualMomentEvidence[], max = 36,
): VisualBeatCandidate[] {
  const result: VisualBeatCandidate[] = []
  for (const evidence of [...focused, ...coarse]) {
    const [start,end]=evidence.sourceRangeMs
    if (!Number.isInteger(start) || !Number.isInteger(end) || end<=start ||
        !evidence.observation.trim()) continue
    if (result.some(existing => {
      const [a,b]=existing.sourceRangeMs
      const overlap=Math.max(0,Math.min(end,b)-Math.max(start,a))
      return overlap / Math.max(1,Math.min(end-start,b-a)) > 0.8
    })) continue
    result.push({
      ...evidence,
      id:`visual_${result.length}`,
      whyFunnyToWatch:(evidence.whyInteresting || evidence.observation).slice(0,350),
    })
    if (result.length>=max)break
  }
  return result.sort((a,b)=>a.sourceRangeMs[0]-b.sourceRangeMs[0])
}

/** References are valid only if they point to actually observed source beats. */
export function validateStoryVisualBeats(
  raw: unknown, candidates:VisualBeatCandidate[], max=6,
): StoryVisualBeat[] {
  if (!Array.isArray(raw) || raw.length>max) throw Error('story_visual_beats_invalid_count')
  const ids=new Set<string>()
  return raw.map((row,i)=>{
    if (!row || typeof row!=='object')throw Error('story_visual_beat_invalid_'+i)
    const item=row as Record<string,unknown>
    if(typeof item.id!=='string' || !candidates.some(c=>c.id===item.id) || ids.has(item.id) ||
       typeof item.whyFunnyToWatch!=='string' || !item.whyFunnyToWatch.trim() ||
       typeof item.narrativePurpose!=='string' || !item.narrativePurpose.trim())
      throw Error('story_visual_beat_unverified_'+i)
    ids.add(item.id)
    return {id:item.id,whyFunnyToWatch:item.whyFunnyToWatch.slice(0,350),
      narrativePurpose:item.narrativePurpose.slice(0,350)}
  })
}

/** A visual action can be silent. Require actual Gemini evidence and safe
 * source/audio boundaries; NEVER fabricate a word selection to make it fit.
 * Keep this separate from Flow's word-ID-only dialogue editing. */
export function resolveVisualActionRequests(
  raw: unknown, candidates:VisualBeatCandidate[],
  selectedStoryBeats:StoryVisualBeat[], words:ClipWord[], bounds:[number,number],
): VisualActionSelection[] {
  if(!Array.isArray(raw) || raw.length>8)throw Error('visual_action_invalid_count')
  const storyIds=new Set(selectedStoryBeats.map(x=>x.id))
  const result:VisualActionSelection[]=[]
  for(let i=0;i<raw.length;i++){
    const item=raw[i] as Record<string,unknown>|null
    if(!item || typeof item.visualBeatId!=='string' || !storyIds.has(item.visualBeatId))
      throw Error('visual_action_missing_story_evidence_'+i)
    const cand=candidates.find(x=>x.id===item.visualBeatId)
    if(!cand)throw Error('visual_action_unknown_candidate_'+i)
    const start=item.startMs,end=item.endMs
    if(typeof start!=='number'||typeof end!=='number'||
      !Number.isInteger(start)||!Number.isInteger(end) ||
      end-start<700 || end-start>45_000 ||
      start<bounds[0] || end>bounds[1] ||
      start<cand.sourceRangeMs[0] || end>cand.sourceRangeMs[1] ||
      typeof item.reason!=='string'||!item.reason.trim() ||
      typeof item.beat!=='string'||!item.beat.trim())
      throw Error('visual_action_outside_observed_source_'+i)
    if(wordAtUnsafeBoundary(start,words)||wordAtUnsafeBoundary(end,words))
      throw Error('visual_action_edge_inside_spoken_word_'+i)
    if(result.length && start<result[result.length-1]!.endMs)
      throw Error('visual_action_overlap_or_out_of_order_'+i)
    result.push({kind:'visual_action',visualBeatId:item.visualBeatId,
      startMs:start,endMs:end,beat:item.beat.slice(0,90),reason:item.reason.slice(0,320)})
  }
  return result
}

/** Repair minor model timestamp errors ONLY within the observed Gemini range.
 * A visual action is optional, not a reason to reject an otherwise valid
 * complete spoken edit. Never manufacture evidence or move farther than the
 * explicit tolerance. No unsafe word-edge becomes an executed cut. */
export function recoverVisualActionRequests(
  raw: unknown, candidates:VisualBeatCandidate[],
  selectedStoryBeats:StoryVisualBeat[], words:ClipWord[], bounds:[number,number],
  maxEdgeShiftMs=1500,
):{
  selections:VisualActionSelection[]
  omitted:Array<{id:string;reason:string}>
  repairs:Array<{id:string;original:[number,number];repaired:[number,number]}>
} {
  const selections:VisualActionSelection[]=[]
  const omitted:Array<{id:string;reason:string}>=[]
  const repairs:Array<{id:string;original:[number,number];repaired:[number,number]}>=[]
  if(!Array.isArray(raw))return {selections,omitted:[{id:'unknown',reason:'visual_actions_not_array'}],repairs}
  const chosen=new Set(selectedStoryBeats.map(x=>x.id))
  // A bad extra action must not invalidate all safe dialogue or the other
  // visual actions. Cap processing without treating excess as valid.
  for(const [i,entry] of raw.entries()) {
    const item=entry && typeof entry==='object' ? entry as Record<string,unknown> : {}
    const id=typeof item.visualBeatId==='string'?item.visualBeatId:'unknown_'+i
    if(i>=8) {omitted.push({id,reason:'visual_action_count_cap'});continue}
    const candidate=candidates.find(c=>c.id===id)
    if(!candidate||!chosen.has(id)) {
      omitted.push({id,reason:'visual_action_missing_story_evidence'});continue
    }
    if(!Number.isInteger(item.startMs)||!Number.isInteger(item.endMs) ||
      typeof item.beat!=='string'||!item.beat.trim()||
      typeof item.reason!=='string'||!item.reason.trim()) {
      omitted.push({id,reason:'visual_action_malformed'});continue
    }
    const original:[number,number]=[item.startMs as number,item.endMs as number]
    const lo=Math.max(bounds[0],candidate.sourceRangeMs[0])
    const hi=Math.min(bounds[1],candidate.sourceRangeMs[1])
    // Only repair model edges slightly outside the ACTUALLY observed range.
    // A proposed event elsewhere in the recording is not the same event.
    if(original[1]<=original[0] || original[1]-original[0]>45_000 ||
      original[0]<lo-maxEdgeShiftMs || original[0]>hi ||
      original[1]>hi+maxEdgeShiftMs || original[1]<lo) {
      omitted.push({id,reason:'visual_action_outside_observed_source'});continue
    }
    const requested:[number,number]=[
      Math.max(lo,original[0]),Math.min(hi,original[1]),
    ]
    const safeEdge=(edge:number,kind:'start'|'end')=>{
      if(!wordAtUnsafeBoundary(edge,words))return edge
      const candidatesMs=new Set<number>([lo,hi])
      // ASR boundaries plus 30ms guard are legal only after verifying the
      // resulting edge against ALL words, including overlapping ASR words.
      for(const w of words){
        const a=Math.round(w.s*1000),b=Math.round(w.e*1000)
        if(b<=a || a>edge+maxEdgeShiftMs+50 || b<edge-maxEdgeShiftMs-50)continue
        candidatesMs.add(a-31)
        candidatesMs.add(b+31)
      }
      return [...candidatesMs]
        .filter(t=>t>=lo&&t<=hi&&Math.abs(t-edge)<=maxEdgeShiftMs &&
          !wordAtUnsafeBoundary(t,words))
        .sort((a,b)=>Math.abs(a-edge)-Math.abs(b-edge) ||
          (kind==='start'?a-b:b-a))[0]??null
    }
    const start=safeEdge(requested[0],'start')
    const end=safeEdge(requested[1],'end')
    if(start===null||end===null||end-start<700||end-start>45_000){
      omitted.push({id,reason:'visual_action_no_safe_source_interval'});continue
    }
    const final:VisualActionSelection={
      kind:'visual_action',visualBeatId:id,startMs:start,endMs:end,
      beat:(item.beat as string).slice(0,90),reason:(item.reason as string).slice(0,320),
    }
    if(selections.some(x=>Math.max(x.startMs,final.startMs)<Math.min(x.endMs,final.endMs))){
      omitted.push({id,reason:'visual_action_overlaps_another_action'});continue
    }
    selections.push(final)
    if(original[0]!==start || original[1]!==end)
      repairs.push({id,original,repaired:[start,end]})
  }
  selections.sort((a,b)=>a.startMs-b.startMs)
  return {selections,omitted,repairs}
}

/** Find a safe edge in an uncovered action gap without leaving the
 * observed action or touching another retained dialogue passage. The
 * ordinary 30ms guard remains authoritative. */
function safeUncoveredActionEdge(
  requested:number,lo:number,hi:number,kind:'start'|'end',words:ClipWord[],
  maxShiftMs=1500,
):number|null {
  if(hi<=lo)return null
  const options=new Set<number>([requested,lo,hi])
  for(const w of words) {
    const a=Math.round(w.s*1000),b=Math.round(w.e*1000)
    if(b<a || a>requested+maxShiftMs+60 || b<requested-maxShiftMs-60)continue
    options.add(a-31);options.add(b+31)
  }
  return [...options].filter(t=>t>=lo&&t<=hi &&
    Math.abs(t-requested)<=maxShiftMs && !wordAtUnsafeBoundary(t,words))
    .sort((a,b)=>Math.abs(a-requested)-Math.abs(b-requested) ||
      (kind==='start'?a-b:b-a))[0]??null
}

/** Keep chronological complete speech passages intact. Any visual ranges
 * overlapping spoken content are trimmed to the uncovered source gap,
 * preferably at observed silent boundaries. Never make overlapping/duplicate
 * playback or expand a Gemini observation outside its reported time range. */
export function combineSpeechWithVisualActions(
  speech: EditorialSelection[], actions:VisualActionSelection[], words:ClipWord[],
  bounds:[number,number], maxSegments=24,
):{cutPlan:EditorialSelection[];included:VisualActionSelection[];omitted:Array<{id:string;reason:string}>} {
  const retained=[...speech].sort((a,b)=>a.startMs-b.startMs)
  const included:VisualActionSelection[]=[]
  const omitted:Array<{id:string;reason:string}>=[]
  const ordered=[...actions].sort((a,b)=>a.startMs-b.startMs)
  for(const action of ordered) {
    if(retained.length>=maxSegments){
      omitted.push({id:action.visualBeatId,reason:'segment_cap'});continue
    }
    const free:[number,number][]=[]
    let cursor=action.startMs
    for(const seg of retained) {
      if(seg.endMs<=cursor || seg.startMs>=action.endMs)continue
      if(seg.startMs>cursor)free.push([cursor,Math.min(action.endMs,seg.startMs)])
      cursor=Math.max(cursor,seg.endMs)
    }
    if(cursor<action.endMs)free.push([cursor,action.endMs])
    // A speech passage may cover the START of a visual action while an
    // important five-second silent tail is still uncovered. Recheck edges
    // against the uncovered interval instead of rejecting its original
    // overlapping endpoints outright.
    const valid=free.map(([lo,hi])=>{
      const start=safeUncoveredActionEdge(lo,Math.max(lo,bounds[0]),Math.min(hi,bounds[1]),'start',words)
      const end=safeUncoveredActionEdge(hi,Math.max(lo,bounds[0]),Math.min(hi,bounds[1]),'end',words)
      return start===null||end===null ? null : [start,end] as [number,number]
    }).filter((span):span is [number,number]=>span!==null&&span[1]-span[0]>=700)
      .sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))
    const best=valid[0]
    if(!best){
      omitted.push({id:action.visualBeatId,
        reason:free.length
          ? 'uncovered_action_gap_has_no_safe_edges:'+JSON.stringify(free)
          : 'covered_by_speech_or_unsafe_edges'})
      continue
    }
    const final:VisualActionSelection={...action,startMs:best[0],endMs:best[1]}
    included.push(final)
    retained.push(final)
    retained.sort((a,b)=>a.startMs-b.startMs)
  }
  return {cutPlan:retained,included,omitted}
}
