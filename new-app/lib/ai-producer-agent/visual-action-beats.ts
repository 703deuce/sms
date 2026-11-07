import type { ClipWord } from '@/lib/clips/edits'
import type { EditorialSelection } from '@/lib/ai-producer-agent/specialists'
import type { VisualMomentEvidence } from '@/lib/ai-producer-agent/visual-evidence'
import { wordAtUnsafeBoundary, WORD_GUARD_MS } from '@/lib/ai-producer-agent/validate'

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
    const valid=free.filter(([s,e])=>e-s>=700 &&
      s>=bounds[0] && e<=bounds[1] &&
      !wordAtUnsafeBoundary(s,words) && !wordAtUnsafeBoundary(e,words))
      .sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))
    const best=valid[0]
    if(!best){omitted.push({id:action.visualBeatId,reason:'covered_by_speech_or_unsafe_edges'});continue}
    const final:VisualActionSelection={...action,startMs:best[0],endMs:best[1]}
    included.push(final)
    retained.push(final)
    retained.sort((a,b)=>a.startMs-b.startMs)
  }
  return {cutPlan:retained,included,omitted}
}
