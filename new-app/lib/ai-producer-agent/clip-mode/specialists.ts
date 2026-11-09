import { storyCoverage } from '@/lib/ai-producer-agent/clip-mode/story-coverage'
import { selectMomentFlowTrim } from '@/lib/ai-producer-agent/clip-mode/moment-flow'
import 'server-only'

import type { ClipWord } from '@/lib/clips/edits'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import { runTool } from '@/lib/ai-producer-agent/tools/registry'
import { lunaChat, type LunaMessage } from '@/lib/ai-producer-agent/luna-client'
import type { ToolSchema } from '@/lib/ai-producer-agent/tools/schemas'
import { TOOL_SCHEMAS } from '@/lib/ai-producer-agent/tools/schemas'
import { summarizeToolResult } from '@/lib/ai-producer-agent/summarize'
import type { Budget } from '@/lib/ai-producer-agent/budget'
import { logAiProducerStep, redactArgs } from '@/lib/ai-producer-agent/log'
import { FILM_EDITING_THEORY, SPECIALIST_ROLES } from '@/lib/ai-producer-agent/film-theory'
import { JUST_CHATTING_EDITORIAL_DIRECTION, JUST_CHATTING_ROLE_DIRECTION, JUST_CHATTING_REVIEW_CHECKS } from '@/lib/ai-producer-agent/just-chatting-direction'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'
import { WORD_GUARD_MS, wordAtUnsafeBoundary } from '@/lib/ai-producer-agent/validate'
import { buildVisualBeatCandidates, validateStoryVisualBeats, recoverVisualActionRequests, combineSpeechWithVisualActions, type StoryVisualBeat, type VisualActionSelection } from '@/lib/ai-producer-agent/visual-action-beats'

/** A creative brief, not a claim that the described outcome occurred.
 * The Finisher must independently verify that the intended payoff is spoken.
 */
export type EditorialOutline = {
  logline: string
  audiencePromise: string
  beats: string[]
  intendedPayoff: string
  essentialSetup: string
  excludeAsides: string[]
  endingRule: string
  highlightCriteria: string
  visualBeats?: StoryVisualBeat[]
}

export type EditorialRole = 'story' | 'footage' | 'dialogue' | 'qa'
export type EditorialSelection = {
  startMs: number
  endMs: number
  beat: string
  reason: string
  kind?: 'visual_action'
  visualBeatId?: string
}
/** Footage's own short first-pass edit inside a wider source candidate.
 * The Finisher is free to adjust, split or omit it; never a mandatory cut. */
export type FootagePreferredEdit = {
  candidateStartMs: number
  candidateEndMs: number
  preferredStartMs: number
  preferredEndMs: number
  intendedPoint: string
  endingCue: string
}
/** Keep useful per-passage guidance even if the source validator drops or
 * repairs a candidate. Hints never expand the allowed footage windows. */
export function validateFootagePreferredEdits(
  raw: unknown, selections: EditorialSelection[],
  bounds: [number, number],
): FootagePreferredEdit[] {
  if (!Array.isArray(raw)) return []
  const retained: FootagePreferredEdit[] = []
  for (const value of raw) {
    if (!value || typeof value !== 'object') continue
    const r = value as Partial<FootagePreferredEdit>
    const { candidateStartMs, candidateEndMs, preferredStartMs, preferredEndMs, intendedPoint, endingCue } = r
    if (typeof candidateStartMs !== 'number' || typeof candidateEndMs !== 'number' ||
      typeof preferredStartMs !== 'number' || typeof preferredEndMs !== 'number' ||
      ![candidateStartMs,candidateEndMs,preferredStartMs,preferredEndMs].every(Number.isInteger) ||
      candidateStartMs < bounds[0] || candidateEndMs > bounds[1] ||
      candidateEndMs <= candidateStartMs ||
      preferredStartMs < candidateStartMs || preferredEndMs > candidateEndMs ||
      preferredEndMs <= preferredStartMs ||
      typeof intendedPoint !== 'string' || !intendedPoint.trim() ||
      typeof endingCue !== 'string' || !endingCue.trim()) continue
    // Each hint must correspond to a CURRENT accepted candidate, not an
    // index from the pre-repair submission. Clip the preferred range to
    // that candidate; ignore entries that cannot be safely paired.
    const source = selections.find(sel =>
      candidateStartMs <= sel.endMs && candidateEndMs >= sel.startMs &&
      preferredStartMs >= sel.startMs && preferredEndMs <= sel.endMs)
    if (!source || retained.some(p => p.candidateStartMs === source.startMs &&
      p.candidateEndMs === source.endMs)) continue
    retained.push({
      candidateStartMs: source.startMs, candidateEndMs: source.endMs,
      preferredStartMs, preferredEndMs,
      intendedPoint: intendedPoint.slice(0,220), endingCue: endingCue.slice(0,220),
    })
  }
  return retained
}
export type EditorialHandoff = {
  outline: EditorialOutline
  footage: EditorialSelection[]
  cutPlan: EditorialSelection[]
  /** Source-grounded visual action selections, preserved separately from Flow word edits. */
  visualActions?: VisualActionSelection[]
  visualActionOmissions?: Array<{id:string;reason:string}>
  /** Flow Editor edits are a separate, source-grounded pass; Footage original is retained. */
  flowReview?: {
    originalCuts: EditorialSelection[]
    changes: Array<{ passageIndex: number; action: 'replace' | 'remove' | 'split'; reason: string; before: EditorialSelection; after?: EditorialSelection; afterSpans?: EditorialSelection[] }>
    applied: boolean
    note: string
    joinReviews?: Array<{leftIndex:number;rightIndex:number;status:'flows'|'needs_change';reason:string}>
  }
  preferredEdits?: FootagePreferredEdit[]
  finisher?: {
    payoff: { startMs: number; endMs: number; quote: string }
    editorialReason: string
    originalDurationSeconds: number
    finalDurationSeconds: number
  }
  highlightsFinisher?: {
    moments: Array<{
      selection: EditorialSelection
      landing: { startMs: number; endMs: number; quote: string }
      editorialReason: string
    }>
    originalDurationSeconds: number
    finalDurationSeconds: number
  }
  review?: { pass: boolean; issues: string[] }
}

const names: Record<EditorialRole, string> = {
  story: 'submit_story_outline',
  footage: 'submit_footage_selections',
  dialogue: 'submit_dialogue_cut_plan',
  qa: 'submit_editorial_review',
}
const readTools: Record<EditorialRole, string[]> = {
  story: ['get_transcript'],
  footage: ['get_transcript', 'analyze_visual'],
  dialogue: ['get_transcript', 'get_audio_energy'],
  qa: ['get_transcript', 'get_audio_energy'],
}
const jsonString = { type: 'string' }
const selection = {
  type: 'object', additionalProperties: false,
  properties: {
    startMs: { type: 'integer', minimum: 0 },
    endMs: { type: 'integer', minimum: 0 },
    beat: jsonString, reason: jsonString,
  },
  required: ['startMs', 'endMs', 'beat', 'reason'],
}
const submitSchemas: Record<EditorialRole, ToolSchema> = {
  story: {
    name: names.story, description: 'Submit a coherent paper-edit story outline.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        logline: jsonString,
        audiencePromise: jsonString,
        beats: { type: 'array', minItems: 3, maxItems: 10, items: jsonString },
        intendedPayoff: jsonString,
        essentialSetup: jsonString,
        excludeAsides: { type: 'array', maxItems: 10, items: jsonString },
        endingRule: jsonString,
        highlightCriteria: jsonString,
      },
      required: ['logline', 'audiencePromise', 'beats',
        'intendedPayoff', 'essentialSetup', 'excludeAsides', 'endingRule', 'highlightCriteria'],
    },
  },
  footage: {
    name: names.footage,
    description: 'Submit the actual source-grounded chronological paper edit, not a candidate inventory.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { selections: { type: 'array', minItems: 2, maxItems: 24, items: selection } },
      required: ['selections'],
    },
  },
  dialogue: {
    name: names.dialogue,
    description: 'Submit final whole-thought boundaries preserving the story beats and requested output length, inside curated intervals.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { selections: { type: 'array', minItems: 2, maxItems: 24, items: selection } },
      required: ['selections'],
    },
  },
  qa: {
    name: names.qa, description: 'Report pass/fail and evidence-grounded editorial concerns.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        pass: { type: 'boolean' },
        issues: { type: 'array', maxItems: 15, items: jsonString },
      },
      required: ['pass', 'issues'],
    },
  },
}


/** Complete original ASR; never sample or omit words from Story / short Story
 * Footage. Original array indices are stable IDs throughout the handoff. */
export function completeTranscriptWords(words: ClipWord[], withTiming: boolean) {
  return words.map((w,id) => withTiming
    ? [id,Math.round(w.s*1000),Math.round(w.e*1000),w.w]
    : [id,w.w])
}

const footageWordSelection = {
  type: 'object',additionalProperties:false,
  properties:{
    firstWordId:{type:'integer',minimum:0},
    lastWordId:{type:'integer',minimum:0},
    beat:jsonString,reason:jsonString,
  },
  required:['firstWordId','lastWordId','beat','reason'],
}
const footageWordsSubmission:ToolSchema = {
  name:'submit_footage_word_selections',
  description:'Select the exact first and last spoken word IDs for each complete passage; deterministic code converts IDs to safe timestamps.',
  parameters:{type:'object',additionalProperties:false,
    properties:{selections:{type:'array',minItems:1,maxItems:24,
      items:footageWordSelection}},
    required:['selections'],
  },
}

/** Optional visual mode: existing Story/Footage schemas stay unchanged for baseline. */
const storyWithVisualBeatsSubmission:ToolSchema={
  name:names.story,
  description:'Submit a coherent story outline and explicitly choose visual events that could make it entertaining; references must be real observed IDs.',
  parameters:{type:'object',additionalProperties:false,
    properties:{...(submitSchemas.story.parameters.properties as Record<string,unknown>),
      visualBeats:{type:'array',maxItems:6,items:{type:'object',additionalProperties:false,
        properties:{id:jsonString,whyFunnyToWatch:jsonString,narrativePurpose:jsonString},
        required:['id','whyFunnyToWatch','narrativePurpose']}}},
    required:[...(submitSchemas.story.parameters.required as string[]),'visualBeats'],
  },
}
const footageWithVisualActionsSubmission:ToolSchema={
  name:footageWordsSubmission.name,
  description:'Select exact word-ID dialogue passages AND optional source-grounded silent/visual action ranges from Story-approved visual beat IDs.',
  parameters:{type:'object',additionalProperties:false,
    properties:{...(footageWordsSubmission.parameters.properties as Record<string,unknown>),
      visualActions:{type:'array',maxItems:8,items:{type:'object',additionalProperties:false,
        properties:{visualBeatId:jsonString,startMs:{type:'integer',minimum:0},
          endMs:{type:'integer',minimum:0},beat:jsonString,reason:jsonString},
        required:['visualBeatId','startMs','endMs','beat','reason']}}},
    required:['selections','visualActions'],
  },
}

/** A pure conversion, not an editorial validator: Footage selects the first
 * and last word; apply their original ASR start/end timestamps exactly.
 * Do not seek gaps, adjust to a different word, or second-guess the cut.
 * Only reject references which cannot possibly be executed (missing IDs,
 * negative/inverted time, out-of-source ranges or nonchronological cuts).
 * ASR word overlaps can produce imperfect seams: record them as diagnostics,
 * not as a reason to replace an entire story. */
export function resolveFootageWordSelections(
  raw: unknown, words: ClipWord[], bounds: [number,number],
): EditorialSelection[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 24)
    throw new Error('footage_word_selection_invalid_count')
  const selected: EditorialSelection[] = []
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string,unknown> | null
    if (!item || !Number.isInteger(item.firstWordId) || !Number.isInteger(item.lastWordId))
      throw new Error('footage_word_ids_required_for_passage_' + i)
    const firstId = item.firstWordId as number
    const lastId = item.lastWordId as number
    const first = words[firstId], last = words[lastId]
    if (!first || !last || lastId < firstId ||
        !Number.isFinite(first.s) || !Number.isFinite(last.e))
      throw new Error('footage_invalid_or_reversed_word_ids_passage_' + i)
    const startMs = Math.round(first.s * 1000)
    const endMs = Math.round(last.e * 1000)
    if (startMs < bounds[0] || endMs > bounds[1] || startMs >= endMs)
      throw new Error('footage_invalid_source_timestamps_passage_' + i)
    if (selected.length && startMs < selected[selected.length-1]!.endMs)
      throw new Error('footage_nonchronological_or_overlapping_passage_' + i)
    selected.push({
      startMs, endMs,
      beat: String(item.beat ?? '').slice(0,90),
      reason: String(item.reason ?? '').slice(0,320),
    })
  }
  return selected
}


/** Recover the genuine, individually valid word-ID passages from a proposed
 * paper edit without inventing footage, sorting a story into a new order, or
 * allowing a broad accidental span to swallow earlier cuts. This is only
 * used after model submission failures, before the independent Flow review. */
export function recoverFootageWordSelections(
  raw:unknown,words:ClipWord[],bounds:[number,number],
):{selections:EditorialSelection[];retainedIndices:number[];rejected:Array<{index:number;reason:string;firstWordId:number|null;lastWordId:number|null}>}{
  const selections:EditorialSelection[]=[]
  const retainedIndices:number[]=[]
  const rejected:Array<{index:number;reason:string;firstWordId:number|null;lastWordId:number|null}>=[]
  if(!Array.isArray(raw))return {selections,retainedIndices,rejected}
  for(const [index,entry] of raw.slice(0,24).entries()){
    const item=entry&&typeof entry==='object'?entry as Record<string,unknown>:{}
    const firstWordId=typeof item.firstWordId==='number'?item.firstWordId:null
    const lastWordId=typeof item.lastWordId==='number'?item.lastWordId:null
    try{
      const [cut]=resolveFootageWordSelections([item],words,bounds)
      if(!cut)throw Error('footage_empty_passage')
      if(!cut.beat.trim()||!cut.reason.trim())throw Error('footage_missing_beat_or_reason')
      if(selections.length&&cut.startMs<selections[selections.length-1]!.endMs)
        throw Error('footage_nonchronological_or_overlapping_passage')
      selections.push(cut)
      retainedIndices.push(index)
    }catch(error){
      rejected.push({index,reason:String((error as Error).message),
        firstWordId,lastWordId})
    }
  }
  return {selections,retainedIndices,rejected}
}

/** Failure diagnostics expose indexed word bounds, never the full transcript. */
/** Evaluate complete authored submissions, not simply the number of salvaged cuts.
 * Both story endpoints must survive before a failed proposal is eligible
 * for provisional recovery. A missing opening or payoff must be repaired by
 * the model instead of silently exporting a truncated story. */
export function footageRecoveryQuality(
  recovery:ReturnType<typeof recoverFootageWordSelections>, raw:unknown,
):number {
  if(!Array.isArray(raw)||raw.length<2||recovery.selections.length<2)return -1
  if(recovery.retainedIndices[0]!==0 ||
     recovery.retainedIndices[recovery.retainedIndices.length-1]!==raw.length-1)return -1
  // Prefer preserving more of the author's actual proposed edit, not
  // rewarding a longer submission full of invalid overlapping guesses.
  return (recovery.selections.length / raw.length)*1000 -
    recovery.rejected.length
}

function footageWordRepairHint(
  raw:unknown,words:ClipWord[],bounds:[number,number],
){
  const partial=recoverFootageWordSelections(raw,words,bounds)
  const previous=partial.selections.at(-1)
  return {
    rejected:partial.rejected.slice(0,12),
    retainedPassages:partial.retainedIndices,
    sourceRangeMs:bounds,
    availableWordIdRange:[0,words.length-1],
    recoveryHasOpeningAndEnding:footageRecoveryQuality(partial,raw)>=0,
    suggestedRule:'Every passage must be source-chronological and nonoverlapping. Use exact firstWordId/lastWordId. A huge start-to-end range is not a final story beat. Repair the indexed invalid selection; keep valid complete story beats and the real closing payoff.',
    precedingValidEndMs:previous?.endMs??null,
  }
}

/** A single independent narrative-flow review after Footage. The specialist
 * sees the entire assembled dialogue and the entire original word-indexed
 * source. Its ONLY editing powers are replacing a passage's first/last word
 * or dropping a redundant passage. No duration target, gap finder, seam
 * search, deterministic trimming or narrative substitution.
 */
const flowReviewTool: ToolSchema = {
  name:'submit_story_flow_review',
  description:'Return ONLY needed corrections to selected passages; omit every already-good passage.',
  parameters:{
    type:'object',additionalProperties:false,
    properties:{
      assessment:{type:'string'},
      joinReviews:{type:'array',maxItems:23,items:{
        type:'object',additionalProperties:false,
        properties:{
          leftIndex:{type:'integer',minimum:0},
          rightIndex:{type:'integer',minimum:1},
          status:{type:'string',enum:['flows','needs_change']},
          reason:{type:'string'},
        },
        required:['leftIndex','rightIndex','status','reason'],
      }},
      changes:{type:'array',maxItems:24,items:{
        type:'object',additionalProperties:false,
        properties:{
          passageIndex:{type:'integer',minimum:0},
          action:{type:'string',enum:['replace','remove']},
          firstWordId:{type:'integer',minimum:0},
          lastWordId:{type:'integer',minimum:0},
          reason:{type:'string'},
        },
        required:['passageIndex','action','reason'],
      }},
    },
    required:['assessment','joinReviews','changes'],
  },
}


/** Distinct tool schema ONLY for the two clip modes. The original AI Producer
 * Flow tool schema, name, prompts and validation remain byte-equivalent. */
const clipFlowReviewTool:ToolSchema = {
  name:'submit_story_flow_review',
  description:'Return ONLY needed corrections to selected passages; omit every already-good passage.',
  parameters:{
    type:'object',additionalProperties:false,
    properties:{
      assessment:{type:'string'},
      joinReviews:{type:'array',maxItems:23,items:{
        type:'object',additionalProperties:false,
        properties:{
          leftIndex:{type:'integer',minimum:0},rightIndex:{type:'integer',minimum:1},
          status:{type:'string',enum:['flows','needs_change']},reason:{type:'string'},
        },required:['leftIndex','rightIndex','status','reason'],
      }},
      changes:{type:'array',maxItems:24,items:{
        type:'object',additionalProperties:false,
        properties:{
          passageIndex:{type:'integer',minimum:0},
          action:{type:'string',enum:['replace','remove','split']},
          firstWordId:{type:'integer',minimum:0},lastWordId:{type:'integer',minimum:0},
          spans:{type:'array',minItems:2,maxItems:6,items:{
            type:'object',additionalProperties:false,
            properties:{firstWordId:{type:'integer',minimum:0},
              lastWordId:{type:'integer',minimum:0},reason:{type:'string'}},
            required:['firstWordId','lastWordId','reason'],
          }},
          reason:{type:'string'},
        },required:['passageIndex','action','reason'],
      }},
    },required:['assessment','joinReviews','changes'],
  },
}

type FlowChange = {
  passageIndex:number
  action:'replace'|'remove'|'split'
  spans?:Array<{firstWordId:number;lastWordId:number;reason:string}>
  firstWordId?:number
  lastWordId?:number
  reason:string
}

/** Audition the EDITED dialogue in playback order: each seam is a pair of
 * actual spoken tails/heads, not nearby source-time ranges. Do not mistake
 * a source-contiguous sentence boundary for independent semantic context. */
export function storyFlowJoinEvidence(
  passages: Array<{passageIndex:number;dialogue:string}>,
) {
  return passages.slice(1).map((right,i) => {
    const left=passages[i]!
    const lastWords=left.dialogue.trim().split(/\\s+/).slice(-24).join(' ')
    const firstWords=right.dialogue.trim().split(/\\s+/).slice(0,24).join(' ')
    return {leftIndex:i,rightIndex:i+1,
      leftEnding:lastWords,rightOpening:firstWords,
      heardTogether:lastWords+' | CUT | '+firstWords,
    }
  })
}

/** Require an explicit judgement for EVERY final inter-passage join.
 * A seam flagged as broken must have a proposed edit affecting one of
 * its two sides; do not silently accept a list of acknowledged defects. */
export function validateStoryFlowJoinReviews(
  raw: unknown, passageCount:number,
  changes:Array<{passageIndex:number;action:'replace'|'remove'|'split'}>,
) {
  if (!Array.isArray(raw) || raw.length!==Math.max(0,passageCount-1))
    throw Error('flow_join_reviews_missing_expected_'+Math.max(0,passageCount-1))
  const seen=new Set<number>()
  const changed=new Set(changes.map(c=>c.passageIndex))
  const checks:Array<{leftIndex:number;rightIndex:number;status:'flows'|'needs_change';reason:string}>=[]
  for (const item of raw) {
    if (!item || typeof item!=='object')throw Error('flow_join_review_invalid_entry')
    const c=item as Record<string,unknown>
    if (!Number.isInteger(c.leftIndex) || !Number.isInteger(c.rightIndex) ||
      (c.rightIndex as number)!==(c.leftIndex as number)+1 ||
      (c.leftIndex as number)<0 || (c.rightIndex as number)>=passageCount ||
      seen.has(c.leftIndex as number))
      throw Error('flow_join_review_invalid_or_duplicate_index_'+c.leftIndex)
    if (c.status!=='flows' && c.status!=='needs_change')
      throw Error('flow_join_review_invalid_status_'+c.leftIndex)
    if (typeof c.reason!=='string' || !c.reason.trim())
      throw Error('flow_join_review_missing_reason_'+c.leftIndex)
    if (c.status==='needs_change' && !changed.has(c.leftIndex as number) && !changed.has(c.rightIndex as number))
      throw Error('flow_unresolved_join_'+c.leftIndex+'_'+c.rightIndex)
    seen.add(c.leftIndex as number)
    checks.push({leftIndex:c.leftIndex as number,rightIndex:c.rightIndex as number,
      status:c.status,reason:c.reason.slice(0,500)})
  }
  return checks.sort((a,b)=>a.leftIndex-b.leftIndex)
}

function originalPassageWords(words: ClipWord[], selection: EditorialSelection) {
  const firstWordId=words.findIndex(w=>Math.round(w.s*1000)===selection.startMs)
  const lastWordId=words.findLastIndex(w=>Math.round(w.e*1000)===selection.endMs)
  if (firstWordId<0 || lastWordId<firstWordId) throw new Error('flow_original_word_boundary_not_found')
  return {firstWordId,lastWordId,
    dialogue:words.slice(firstWordId,lastWordId+1).map(w=>w.w).join(' ')}
}

/** Exported for isolated tests: only model-authorized corrections are applied.
 * No heuristics repair or replace an invalid revision. A bad proposal is
 * rejected with a passage-specific explanation for a model resubmission.
 */
export function applyStoryFlowChanges(
  raw: unknown, originals: EditorialSelection[], words: ClipWord[], bounds: [number,number],
  opts:{allowSplit:boolean;momentEndTrimOnly?:boolean}={allowSplit:false},
) {
  if (!Array.isArray(raw) || raw.length>24) throw Error('flow_invalid_change_count')
  const changesInput:FlowChange[]=[]
  for (const item of raw) {
    if (!item || typeof item!=='object')throw Error('flow_change_not_object')
    changesInput.push(item as FlowChange)
  }
  // Flow historically emitted multiple replaces of the same passage to omit an
  // interior detour. That is exactly one split, not multiple independent edits.
  const groups=new Map<number,FlowChange[]>()
  for(const c of changesInput)groups.set(c.passageIndex,[...(groups.get(c.passageIndex)??[]),c])
  const prepared:FlowChange[]=[]
  for(const [index,entries] of groups){
    if(opts.allowSplit&&entries.length>1&&entries.every(c=>c.action==='replace'&&
        Number.isInteger(c.firstWordId)&&Number.isInteger(c.lastWordId))){
      const spans=entries.map(c=>({firstWordId:c.firstWordId!,lastWordId:c.lastWordId!,reason:c.reason}))
        .sort((x,y)=>x.firstWordId-y.firstWordId)
      prepared.push({passageIndex:index,action:'split',reason:'Remove source detour within passage',spans})
    }else prepared.push(...entries)
  }
  const edits=new Map<number,FlowChange>()
  for (const c of prepared) {
    if (!Number.isInteger(c.passageIndex) || c.passageIndex<0 ||
      c.passageIndex>=originals.length || edits.has(c.passageIndex))
      throw Error('flow_invalid_or_duplicate_passage_index_'+c.passageIndex)
    if (c.action!=='replace' && c.action!=='remove' && c.action!=='split')
      throw Error('flow_invalid_action_passage_'+c.passageIndex)
    if (typeof c.reason!=='string' || !c.reason.trim())
      throw Error('flow_missing_reason_passage_'+c.passageIndex)
    if (c.action==='split'){
      if(!opts.allowSplit)throw Error('flow_split_not_allowed_in_mode')
      if(!Array.isArray(c.spans)||c.spans.length<2||c.spans.length>6)
        throw Error('flow_split_invalid_span_count_passage_'+c.passageIndex)
    }
    if (c.action==='replace' && (!Number.isInteger(c.firstWordId) || !Number.isInteger(c.lastWordId)))
      throw Error('flow_missing_word_ids_passage_'+c.passageIndex)
    edits.set(c.passageIndex,c)
  }
  const finalCuts:EditorialSelection[]=[]
  const changes:Array<{passageIndex:number;action:'replace'|'remove'|'split';reason:string;
    before:EditorialSelection;after?:EditorialSelection;afterSpans?:EditorialSelection[]}>= []
  for (let i=0;i<originals.length;i++){
    const before=originals[i]!
    const edit=edits.get(i)
    if(!edit){finalCuts.push(before);continue}
    if(edit.action==='remove'){
      changes.push({passageIndex:i,action:'remove',reason:edit.reason,before})
      continue
    }
    if(edit.action==='split'){
      const spans=edit.spans!.map(span=>resolveFootageWordSelections([{
        firstWordId:span.firstWordId,lastWordId:span.lastWordId,
        beat:before.beat,reason:span.reason,
      }],words,bounds)[0]!)
      for(let k=0;k<spans.length;k++){
        const span=spans[k]!
        if(span.endMs-span.startMs<1000)throw Error('flow_split_span_too_short_passage_'+i)
        if(k>0&&span.startMs<spans[k-1]!.endMs)
          throw Error('flow_split_overlap_passage_'+i)
      }
      finalCuts.push(...spans)
      changes.push({passageIndex:i,action:'split',reason:edit.reason,before,afterSpans:spans})
      continue
    }
    const converted=resolveFootageWordSelections([{
      firstWordId:edit.firstWordId,lastWordId:edit.lastWordId,
      beat:before.beat,reason:edit.reason,
    }],words,bounds)[0]!
    if(converted.startMs===before.startMs&&converted.endMs===before.endMs){
      finalCuts.push(before);continue
    }
    if(opts.momentEndTrimOnly&&(converted.startMs<before.startMs||converted.endMs>before.endMs)){
      // Single moment Flow can only tighten ends, never extend to unrelated material.
      throw Error('flow_moment_only_end_trim')
    }
    finalCuts.push(converted)
    changes.push({passageIndex:i,action:'replace',reason:edit.reason,before,after:converted})
  }
  if(!finalCuts.length)throw Error('flow_cannot_remove_every_passage')
  if(opts.allowSplit&&finalCuts.length>24)throw Error('flow_too_many_final_passages')
  for(let i=1;i<finalCuts.length;i++){
    if(finalCuts[i]!.startMs<finalCuts[i-1]!.endMs)
      throw Error('flow_overlap_after_revision_near_passage_'+i)
  }
  return {finalCuts,changes}
}

export async function runStoryFlowReview(
  ctx: ToolCtx, budget: Budget, outline: EditorialOutline, originals: EditorialSelection[],
  opts:{mode:'moment'|'story'|'baseline';targetSeconds?:[number,number];hardWindowSeconds?:[number,number]}={mode:'baseline'},
):Promise<{cutPlan:EditorialSelection[];review:NonNullable<EditorialHandoff['flowReview']>}> {
  const words=ctx.cache.words??[]
  const bounds=ctx.sources[0]?.rangeMs
  if (!bounds || !words.length || !originals.length) throw Error('flow_source_missing')
  const originalCuts=originals.map(c=>({...c}))
  const joined=originals.map((sel,i)=>({
    passageIndex:i,...originalPassageWords(words,sel),
    startMs:sel.startMs,endMs:sel.endMs,beat:sel.beat,
  }))
  const joinedTransitions=storyFlowJoinEvidence(joined)
  await specialistEvent(ctx,budget,'flow','start',{
    sourceRangeMs:bounds,wordCount:words.length,
    passageCount:originals.length,originalCuts,joinedWordSpans:joined.map(({passageIndex,firstWordId,lastWordId})=>({passageIndex,firstWordId,lastWordId})),
    runtimeTargetDisabled:true,
  })
  const messages:LunaMessage[]=[
    {role:'system',content:[
      FILM_EDITING_THEORY,
      (opts.mode==='baseline' ? 'FLOW EDITOR. You are a separate supervising dialogue editor AFTER Story and Footage have selected source passages. Review the COMPLETE assembled dialogue as a viewer hears it. Read the ENTIRE original word-indexed transcript for missing setup at passage beginnings, dangling ends, incomplete phrases, pronouns without referents, repetition, and non-sequiturs between passages. Fix only actual editorial problems. For every good passage, make NO change. You may extend/contract a passage by returning a different first/last original word ID, or remove a passage when it cannot serve the story. You may NEVER invent dialogue, reorder passages, choose new unrelated stories, or use a runtime target. No 90-second constraint. In particular, a short standalone opening can be excellent. Do not try to fix an audible pop: no audio was provided, and separate audio fades handle sound artifacts. Keep every unaffected passage unchanged. Your replacements are literal source cuts, not suggestions. Do not use cuts to satisfy a silence/seam heuristic. Source timestamps will be resolved from exact word IDs. You are not doing a duration compression pass.' : 'FLOW EDITOR. You are a separate supervising dialogue editor AFTER Story and Footage have selected source passages. Review the COMPLETE assembled dialogue as a viewer hears it. Read the ENTIRE original word-indexed transcript for missing setup at passage beginnings, dangling ends, incomplete phrases, pronouns without referents, repetition, and non-sequiturs between passages. Fix only actual editorial problems. For every good passage, make NO change. You may extend/contract a passage by returning a different first/last original word ID, or remove a passage when it cannot serve the story. You may NEVER invent dialogue, reorder passages, choose new unrelated stories, or use a runtime target. No 90-second constraint. In particular, a short standalone opening can be excellent. Do not try to fix an audible pop: no audio was provided, and separate audio fades handle sound artifacts. Keep every unaffected passage unchanged. Your replacements are literal source cuts, not suggestions. Do not use cuts to satisfy a silence/seam heuristic. Source timestamps will be resolved from exact word IDs. You are not doing a duration compression pass.'.replace(
        'or use a runtime target. No 90-second constraint.',
        'or alter the approved narrative. Use the supplied mode-specific time target only; never pad, invent or force unrelated material.'
      )),
      ...(opts.mode==='moment' ? ['SINGLE CONTINUOUS MOMENT MODE: exactly one source passage. Only allow no change or ONE end-trimming replace of passageIndex 0. NEVER remove, split or excise the middle. If an aside occurs inside, accept it or trim an END. Length is advisory; never keep a detour to fill a preset.'] : opts.mode==='story' ? ['SHORT STORY CLIP: preserve a complete coherent source-grounded story. Duration is advisory: do not expand clean endings or weaken narrative to hit a preset. Splits may remove off-topic middle detours using chronological word ID spans. At least two source moment clusters must come from distinct parts of the recording. Never send two changes for the same passageIndex.'] : []),
      (opts.mode==='baseline' ? 'MANDATORY ADJACENT-JOIN AUDIT: Separately read every numbered leftEnding | CUT | rightOpening pair from joinedTransitions as if spoken continuously. A complete paragraph by itself can still fail when its previous/next excerpt leaves an unanswered question, orphaned conjunction, unexplained pronoun, missing subject, or abrupt topic jump. For each pair provide exactly one joinReviews entry (leftIndex, rightIndex, flows or needs_change, specific reason). For needs_change, you MUST submit an explicit replace/remove change for one of those passages, based on actual source word IDs. Check that the edited last words of A will make sense immediately before the edited first words of B. If one repair introduces a new dependency at another join, revise that too. Preserve already-coherent joins; never pad for length or fabricate material. Reject incomplete transitions such as ending So you may be asking, followed by That is a factor, or openings is the fact that / even those ultra wide / about playing on PC without sufficient local context. Do not mark a broken seam as flows just because it is grammatically plausible in the original, longer source.' : 'MANDATORY ADJACENT-JOIN AUDIT: Separately read every numbered leftEnding | CUT | rightOpening pair from joinedTransitions as if spoken continuously. A complete paragraph by itself can still fail when its previous/next excerpt leaves an unanswered question, orphaned conjunction, unexplained pronoun, missing subject, or abrupt topic jump. For each pair provide exactly one joinReviews entry (leftIndex, rightIndex, flows or needs_change, specific reason). For needs_change, you MUST submit an explicit replace/remove change for one of those passages, based on actual source word IDs. Check that the edited last words of A will make sense immediately before the edited first words of B. If one repair introduces a new dependency at another join, revise that too. Preserve already-coherent joins; never pad for length or fabricate material. Reject incomplete transitions such as ending So you may be asking, followed by That is a factor, or openings is the fact that / even those ultra wide / about playing on PC without sufficient local context. Do not mark a broken seam as flows just because it is grammatically plausible in the original, longer source.'.replace(
        'replace/remove change',
        opts.mode==='moment'?'replace end-trim change':'replace/remove/split change'
      )),
    ].join('\n\n')},
    {role:'user',content:JSON.stringify({
      task:'Review the complete assembled story for continuity, self-contained dialogue and natural transitions. Return ONLY necessary corrections.',
      storyOutline:outline,
      assembledPassages:joined,
      joinedTransitions,
      fullOriginalTranscriptFormat:'[originalWordId,sourceStartMs,sourceEndMs,spokenWord] in original chronology',
      fullOriginalTranscript:completeTranscriptWords(words,true),
      sourceRangeMs:bounds,
      constraints:{runtimeTargetDisabled:opts.mode==='baseline',maxPassages:opts.mode==='moment'?1:24,retainGoodPassages:true,wordIdsOnly:true,
        ...(opts.mode!=='baseline'?{splitAllowed:opts.mode==='story',targetSeconds:opts.targetSeconds,hardWindowSeconds:opts.hardWindowSeconds}:{}),},
    })},
  ]
  for (let attempt=0;attempt<2;attempt++) {
    if (budget.state()==='hard') throw Error('flow_budget_exhausted')
    const result=await lunaChat({messages,tools:[opts.mode==='baseline'?flowReviewTool:clipFlowReviewTool],toolChoice:'required'})
    budget.steps++;budget.addLuna(result.usage)
    await logAiProducerStep({
      runId:ctx.runId,stepIndex:budget.steps,phase:'plan',tool:'specialist_flow',
      kind:'luna',resultSummary:'Flow editorial review response',
      tokensIn:result.usage?.prompt_tokens,tokensOut:result.usage?.completion_tokens,
    })
    messages.push(result.message)
    const call=(result.message.tool_calls??[]).find(c=>c.function.name===flowReviewTool.name)
    const proposal=call?safeJson(call.function.arguments):null
    await specialistEvent(ctx,budget,'flow','proposal',{
      attempt,assessment:typeof proposal?.assessment==='string'?proposal.assessment.slice(0,600):null,
      changes:proposal?.changes??null,
      joinReviews:proposal?.joinReviews??null,
      originalCuts,
    })
    try {
      if (!call || !proposal || typeof proposal.assessment!=='string') throw Error('flow_missing_structured_review')
      const applied=opts.mode==='baseline'
        ? applyStoryFlowChanges(proposal.changes,originals,words,bounds)
        : applyStoryFlowChanges(proposal.changes,originals,words,bounds,{allowSplit:opts.mode==='story',momentEndTrimOnly:opts.mode==='moment'})
      const joinReviews=validateStoryFlowJoinReviews(proposal.joinReviews,originals.length,applied.changes)
      const finalPassages=applied.finalCuts.map((sel,i)=>({passageIndex:i,dialogue:originalPassageWords(words,sel).dialogue}))
      const finalJoins=storyFlowJoinEvidence(finalPassages)
      const review={
        originalCuts,changes:applied.changes,applied:applied.changes.length>0,
        note:proposal.assessment.slice(0,600),joinReviews,
      }
      await specialistEvent(ctx,budget,'flow','accepted',{
        attempt,assessment:review.note,
        originalCuts,finalCuts:applied.finalCuts,changes:review.changes,
        joinReviews,finalJoins,
        unchangedPassages:originals.length-applied.changes.length,
        finalDurationSeconds:selectionDurationS(applied.finalCuts),
        runtimeTargetDisabled:opts.mode==='baseline',
        ...(opts.mode==='story'?{internalSplitJoins:applied.changes.filter(c=>c.action==='split').map(c=>({passageIndex:c.passageIndex,spans:c.afterSpans?.length??0}))}:{}),
      })
      return {cutPlan:applied.finalCuts,review}
    } catch(error) {
      const errorCode=String((error as Error).message).slice(0,250)
      await specialistEvent(ctx,budget,'flow','rejected',{
        attempt,errorCode,proposal:proposal?.changes??null,
        note:'Flow proposal rejected WITHOUT modifying any original cut',
      },errorCode)
      if(attempt===1&&opts.mode!=='baseline'&&proposal&&Array.isArray(proposal.changes)){
        // Optional clip-mode partial salvage: only accept individually valid,
        // uniquely indexed repairs, and ONLY if every flagged original join
        // remains covered. Never silently accept a broken seam.
        const input=proposal.changes.filter((c):c is FlowChange=>
          Boolean(c)&&typeof c==='object'&&Number.isInteger(c.passageIndex)) as FlowChange[]
        const counts=new Map<number,number>()
        for(const item of input)counts.set(item.passageIndex,(counts.get(item.passageIndex)??0)+1)
        const surviving:FlowChange[]=[]
        for(const item of input){
          if(counts.get(item.passageIndex)!==1)continue
          try{
            applyStoryFlowChanges([item],originals,words,bounds,{
              allowSplit:opts.mode==='story',momentEndTrimOnly:opts.mode==='moment',
            })
            surviving.push(item)
          }catch{/* invalid change excluded */}
        }
        if(surviving.length&&surviving.length<input.length){
          try{
            const applied=applyStoryFlowChanges(surviving,originals,words,bounds,{
              allowSplit:opts.mode==='story',momentEndTrimOnly:opts.mode==='moment',
            })
            const joinReviews=validateStoryFlowJoinReviews(
              proposal.joinReviews,originals.length,applied.changes)
            const review={
              originalCuts,changes:applied.changes,applied:applied.changes.length>0,
              note:'partial: '+(input.length-surviving.length)+' invalid changes dropped',
              joinReviews,
            }
            await specialistEvent(ctx,budget,'flow','accepted_partial',{
              originalCuts,finalCuts:applied.finalCuts,changes:applied.changes,joinReviews,
              droppedInvalidChanges:input.length-surviving.length,
            })
            return {cutPlan:applied.finalCuts,review}
          }catch{/* preserve caller's original Footage on unsafe partial repair */}
        }
      }
      if (attempt===1) throw Error('flow_review_invalid_after_retry: '+errorCode)
      if(call)messages.push({role:'tool',tool_call_id:call.id,content:JSON.stringify({
        ok:false,error:errorCode,instruction:'Recheck original source word IDs, chronology and the failing passage. Include a specific joinReviews judgement for every adjacent passage pair. If any join needs_change, include a replace/remove action for one side; keep good passages unchanged.',
      })})
      else messages.push({role:'user',content:'Please submit the structured flow review tool response.'})
    }
  }
  throw Error('flow_review_no_result')
}

function safeJson(input: string): Record<string, unknown> | null {
  try {
    const raw = JSON.parse(input) as unknown
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null
  } catch {
    return null
  }
}

function validSelections(
  raw: unknown,
  bounds: [number, number],
  words: ClipWord[],
  allowed?: EditorialSelection[],
  minDurationMs = 3000,
): EditorialSelection[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 24) throw new Error('specialist_invalid_selection_count')
  const normalized: EditorialSelection[] = raw.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error('specialist_invalid_selection')
    const r = entry as Record<string, unknown>
    const { startMs, endMs, beat, reason } = r
    if (!Number.isInteger(startMs) || !Number.isInteger(endMs) ||
      typeof startMs !== 'number' || typeof endMs !== 'number' ||
      startMs < bounds[0] || endMs > bounds[1] || endMs - startMs < minDurationMs ||
      typeof beat !== 'string' || typeof reason !== 'string' ||
      !reason.trim()) throw new Error('specialist_invalid_source_range')
    // Require transcript evidence for the proposed actual source.
    const matches = words.filter((w) => w.e * 1000 > startMs && w.s * 1000 < endMs)
    if (matches.length < (minDurationMs < 3000 ? 1 : 5)) throw new Error('specialist_range_has_no_speech_evidence')
    if (allowed && !allowed.some((a) => startMs >= a.startMs && endMs <= a.endMs)) {
      throw new Error('specialist_cut_outside_curated_footage')
    }
    // No cut through a retained word (30ms safety margin).
    for (const edge of [startMs, endMs]) {
      if (wordAtUnsafeBoundary(edge, words)) {
        throw new Error('specialist_cut_inside_word')
      }
    }
    return { startMs, endMs, beat: beat.slice(0, 90), reason: reason.slice(0, 320) }
  })
  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i]!.startMs < normalized[i - 1]!.endMs) {
      throw new Error('specialist_non_chronological_cut')
    }
  }
  return normalized
}

/**
 * Locate a boundary that is not inside ANY transcript word. ASR timestamps
 * can overlap, so the first intersecting word is not necessarily enough.
 * Prefer a >=60ms real gap, but allow exact boundaries when speech is dense.
 * Limit edits to 1500ms; never silently move a selection several seconds.
 */
function nearestLegalEdge(
  edge: number, kind: 'startMs' | 'endMs',
  words: ClipWord[], bounds: [number, number],
  allowedRange?: [number, number],
  maxShiftMs = 1500,
): number | null {
  const lo = Math.max(bounds[0], allowedRange?.[0] ?? bounds[0])
  const hi = Math.min(bounds[1], allowedRange?.[1] ?? bounds[1])
  if (edge < lo || edge > hi) return null
  const spans = words
    .filter((w) => Number.isFinite(w.s) && Number.isFinite(w.e) && w.e > w.s)
    .map((w) => [Math.round(w.s * 1000) - WORD_GUARD_MS, Math.round(w.e * 1000) + WORD_GUARD_MS] as const)
    .sort((a, b) => a[0] - b[0])
  // Build merged speaking intervals once; overlapping ASR words must not
  // trick the repair into moving to another word's interior.
  const merged: Array<[number, number]> = []
  for (const [start, end] of spans) {
    const prev = merged[merged.length - 1]
    if (prev && start <= prev[1]) prev[1] = Math.max(prev[1], end)
    else merged.push([start, end])
  }
  const candidates = new Set<number>([edge, lo, hi])
  for (const [start, end] of merged) {
    if (Math.abs(start - edge) <= maxShiftMs) candidates.add(Math.max(lo, start))
    if (Math.abs(end - edge) <= maxShiftMs) candidates.add(Math.min(hi, end))
  }
  const legal = [...candidates].filter((c) =>
    c >= lo && c <= hi && Math.abs(c - edge) <= maxShiftMs &&
    !wordAtUnsafeBoundary(c, words))
  // Ties favor keeping the beginning of a phrase and the end of a phrase.
  legal.sort((a, b) => Math.abs(a - edge) - Math.abs(b - edge) ||
    (kind === 'startMs' ? a - b : b - a))
  return legal[0] ?? null
}

export function snapEditorialSelections(
  raw: unknown,
  bounds: [number, number],
  words: ClipWord[],
  allowed?: EditorialSelection[],
  minDurationMs = 3000,
): EditorialSelection[] {
  try { return validSelections(raw, bounds, words, allowed, minDurationMs) } catch (error) {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 24) throw error
    const repaired = raw.map((value) => {
      if (!value || typeof value !== 'object') return value
      const item = value as EditorialSelection
      if (!Number.isInteger(item.startMs) || !Number.isInteger(item.endMs) ||
          item.startMs < bounds[0] || item.endMs > bounds[1]) return value
      const curated = allowed?.find((a) =>
        item.startMs >= a.startMs && item.endMs <= a.endMs)
      // Never repair a dialogue cut outside its curated source selection.
      if (allowed && !curated) return value
      const range = curated ? [curated.startMs, curated.endMs] as [number, number] : undefined
      const startMs = nearestLegalEdge(item.startMs, 'startMs', words, bounds, range)
      const endMs = nearestLegalEdge(item.endMs, 'endMs', words, bounds, range)
      return {
        ...item,
        startMs: startMs ?? item.startMs,
        endMs: endMs ?? item.endMs,
      }
    })
    return validSelections(repaired, bounds, words, allowed, minDurationMs)
  }
}

/**
 * Recovery path for noisy ASR: never send the model through seven retries for
 * a single unsnappable word boundary. Respect source/curation/chronology and
 * retain useful intervals even if no nearby word-safe gap exists. Such edges
 * are explicitly flagged by draft validation for the editor to review.
 */
export function recoverEditorialSelections(
  raw: unknown, bounds: [number, number], words: ClipWord[],
  allowed?: EditorialSelection[],
): { selections: EditorialSelection[]; dropped: number; unsafeEdges: number } {
  const entries = Array.isArray(raw) ? raw.slice(0, 24) : []
  const candidates: EditorialSelection[] = []
  let dropped = 0
  for (const v of entries) {
    if (!v || typeof v !== 'object') { dropped++; continue }
    const r = v as Partial<EditorialSelection>
    if (!Number.isInteger(r.startMs) || !Number.isInteger(r.endMs) ||
        typeof r.startMs !== 'number' || typeof r.endMs !== 'number' ||
        r.startMs < bounds[0] || r.endMs > bounds[1] || r.endMs <= r.startMs ||
        typeof r.beat !== 'string' || typeof r.reason !== 'string' || !r.reason.trim()) {
      dropped++
      continue
    }
    const curated = allowed?.find((a) => r.startMs! >= a.startMs && r.endMs! <= a.endMs)
    if (allowed && !curated) { dropped++; continue }
    const range = curated ? [curated.startMs, curated.endMs] as [number, number] : undefined
    // Prefer genuine legal edges, searching farther than normal precision snapping.
    // A null result means retain the proposed edge, not discard the entire run.
    const snappedStart = nearestLegalEdge(r.startMs, 'startMs', words, bounds, range, 30_000)
    const snappedEnd = nearestLegalEdge(r.endMs, 'endMs', words, bounds, range, 30_000)
    // Do not let a remote legal edge collapse a useful interval. Try the
    // smallest safe adjustment first, then preserve original editorial bounds.
    let startMs = snappedStart ?? r.startMs
    let endMs = snappedEnd ?? r.endMs
    // Long-range safety snapping must not silently erase an entire story beat.
    // In dense ASR preserve the sourced candidate and flag its word edge.
    if (endMs - startMs < Math.max(3000, (r.endMs - r.startMs) * 0.8)) {
      startMs = r.startMs
      endMs = r.endMs
    }
    if (endMs - startMs < 3000) {
      startMs = r.startMs
      endMs = r.endMs
    }
    if (endMs - startMs < 3000 ||
        words.filter((w) => w.e * 1000 > startMs && w.s * 1000 < endMs).length < 5) {
      dropped++
      continue
    }
    candidates.push({ startMs, endMs, beat: r.beat.slice(0, 90), reason: r.reason.slice(0, 320) })
  }
  // Preserve chronology while dropping overlapping or invalid proposals.
  candidates.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  const selections: EditorialSelection[] = []
  for (const item of candidates) {
    if (selections.length && item.startMs < selections[selections.length - 1]!.endMs) {
      dropped++
      continue
    }
    selections.push(item)
  }
  return { selections, dropped,
    unsafeEdges: selections.reduce((n, item) => n +
      Number(Boolean(wordAtUnsafeBoundary(item.startMs, words))) +
      Number(Boolean(wordAtUnsafeBoundary(item.endMs, words))), 0) }
}

/** Source-gap diversity is measured in the original recording, not in export seconds.
 * Breaths and filler cuts do not count as separate highlights. No arbitrary
 * number of jumps is imposed when the recording has fewer usable moments.
 */
export function highlightsCoverage(
  selections: EditorialSelection[], target: [number, number],
) {
  const durationSeconds = selections.reduce((n, s) => n + (s.endMs - s.startMs), 0) / 1000
  const distinctMomentCount = selections.length
    ? 1 + selections.slice(1).filter((s, i) => s.startMs - selections[i]!.endMs >= 8_000).length
    : 0
  const minimumDistinct = target[1] <= 45 ? 2 : 3
  return {
    durationSeconds, distinctMomentCount, minimumDistinct,
    needsRevision: durationSeconds < target[0] || distinctMomentCount < minimumDistinct,
  }
}

function selectionDurationS(selections: EditorialSelection[]): number {
  return selections.reduce((sum, s) => sum + (s.endMs - s.startMs), 0) / 1000
}

/**
 * Editorial diagnostics, not an arbitrary requirement for long jumps.
 * Contiguous material can be the right story, but when a 20-minute source
 * produces an unfinished minute-long excerpt we must search alternatives.
 */
export function shortStoryCoverage(
  selections: EditorialSelection[], words: ClipWord[], target: [number, number],
  sourceRange: [number, number],
) {
  const durationSeconds = selectionDurationS(selections)
  const sourceSpanMs = selections.length
    ? selections[selections.length - 1]!.endMs - selections[0]!.startMs : 0
  const longestSourceGapMs = selections.reduce((largest, seg, i) =>
    i ? Math.max(largest, seg.startMs - selections[i - 1]!.endMs) : largest, 0)
  const ending = selections[selections.length - 1]
  const tailWords = ending
    ? words.filter(w => w.e * 1000 > ending.startMs && w.s * 1000 < ending.endMs)
      .sort((a, b) => a.s - b.s).slice(-8) : []
  const lastWord = tailWords[tailWords.length - 1]?.w?.trim() ?? ''
  const terminalSentence = /[.!?][\"'”’]?$/.test(lastWord) && !/\.{2,}[\"'”’]?$/.test(lastWord)
  // Some ASR providers omit ALL punctuation. In that case absence of a
  // period is not proof of a broken ending. An ellipsis or dangling function
  // word is still actionable evidence of an unfinished thought.
  const punctuationAvailable = words.some((w) => /[.!?]$/.test(w.w.trim()))
  const explicitDangling = /\.{2,}$/.test(lastWord) ||
    /^(and|but|because|so|then|just|to|the|a|an|i|we|you|they|he|she|it|of|for|with|that|when|if)$/i.test(lastWord.replace(/[,.!?]+$/, ''))
  const endingNeedsReview = !terminalSentence && (punctuationAvailable || explicitDangling)
  const enoughSourceToExplore = sourceRange[1] - sourceRange[0] >= 3 * 60_000
  const localOnly = enoughSourceToExplore &&
    sourceSpanMs <= Math.max(90_000, target[1] * 1000 * 1.2) &&
    longestSourceGapMs < 8_000
  return {
    durationSeconds, sourceSpanMs, longestSourceGapMs,
    lastWord, terminalSentence,
    localOnly,
    underTarget: durationSeconds < target[0],
    endingNeedsReview,
    needsReview: durationSeconds < target[0] || endingNeedsReview || localOnly,
  }
}

/** Duration targets guide editing quality but must not block a usable cut. */
function durationAdvisory(selections: EditorialSelection[], target: [number, number]) {
  const actualSeconds = selectionDurationS(selections)
  const [minimumSeconds, maximumSeconds] = target
  return {
    actualSeconds, minimumSeconds, maximumSeconds,
    outsideTarget: actualSeconds < minimumSeconds || actualSeconds > maximumSeconds,
  }
}

function selectionRepairHint(
  raw: unknown, words: ClipWord[], bounds: [number, number],
  allowed?: EditorialSelection[],
): Record<string, unknown> {
  if (!Array.isArray(raw)) return { instruction: 'Submit 2–24 intervals.' }
  const entries: Record<string, unknown>[] = []
  for (let i = 0; i < Math.min(raw.length, 24); i++) {
    const r = raw[i] as EditorialSelection | null
    if (!r || !Number.isInteger(r.startMs) || !Number.isInteger(r.endMs)) {
      entries.push({ index: i, problem: 'non_integer_boundary' })
      continue
    }
    const inCurated = allowed?.find((a) => r.startMs >= a.startMs && r.endMs <= a.endMs)
    if (allowed && !inCurated) entries.push({ index: i, problem: 'outside_curated_footage' })
    const range = inCurated ? [inCurated.startMs, inCurated.endMs] as [number, number] : undefined
    const suggestedStartMs = nearestLegalEdge(r.startMs, 'startMs', words, bounds, range)
    const suggestedEndMs = nearestLegalEdge(r.endMs, 'endMs', words, bounds, range)
    if (suggestedStartMs !== r.startMs || suggestedEndMs !== r.endMs) {
      entries.push({ index: i, proposed: [r.startMs, r.endMs],
        suggested: [suggestedStartMs, suggestedEndMs] })
    }
    if (r.startMs < bounds[0] || r.endMs > bounds[1] || r.endMs - r.startMs < 3000) {
      entries.push({ index: i, problem: 'invalid_source_range_or_duration' })
    }
    if (i > 0 && (raw[i - 1] as EditorialSelection)?.endMs > r.startMs) {
      entries.push({ index: i, problem: 'non_chronological_overlap' })
    }
  }
  return { entries: entries.slice(0, 24),
    instruction: 'Check all intervals: 3+ seconds, chronological, transcript speech and source bounds. Use suggested safe edges.' }
}

/** Safe structured diagnostics; never log raw transcripts, prompts, media URLs or secrets. */
function selectionLogSummary(args: Record<string, unknown> | null): string {
  const selections = args?.selections
  if (!Array.isArray(selections)) return JSON.stringify({ keys: Object.keys(args ?? {}) })
  return JSON.stringify({ count: selections.length,
    visualActionRefs:Array.isArray(args?.visualActions)?args.visualActions.slice(0,8).map(v=>{
      const row=v&&typeof v==='object'?v as Record<string,unknown>:{}
      return {visualBeatId:row.visualBeatId,startMs:row.startMs,endMs:row.endMs}
    }):[],
    intervals: selections.slice(0, 24).map((r) => {
    if (!r || typeof r !== 'object') return { invalid: true }
    const item = r as Record<string, unknown>
    return { startMs: item.startMs, endMs: item.endMs, firstWordId: item.firstWordId, lastWordId: item.lastWordId, beat: item.beat }
  }) })
}

/** Structured console + persisted DB entries share the same event payload. */
async function specialistEvent(
  ctx: ToolCtx, budget: Budget, role: EditorialRole | 'flow', event: string,
  diagnostic: Record<string, unknown>, error?: string,
) {
  const payload = { runId: ctx.runId, role, event, ...diagnostic }
  console.info('[ai-producer:specialist]', JSON.stringify(payload))
  await logAiProducerStep({
    runId: ctx.runId, stepIndex: budget.steps,
    phase: 'plan', tool: `specialist_${role}_${event}`, kind: 'validate',
    argsSummary: JSON.stringify(diagnostic).slice(0, 12000),
    resultSummary: event,
    error,
  })
}

export function checkEditorialSelections(
  selections: unknown,
  bounds: [number, number],
  words: ClipWord[],
  allowed?: EditorialSelection[],
  minDurationMs = 3000,
): EditorialSelection[] {
  return validSelections(selections, bounds, words, allowed, minDurationMs)
}

/** Prevent one stage from mutating the timeline or accessing other agents' tools. */
export async function runEditorialRole(
  ctx: ToolCtx,
  out: OutputState,
  budget: Budget,
  role: EditorialRole,
  context: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const source = ctx.sources[0]
  if (!source?.rangeMs) throw new Error('specialist_source_window_missing')
  const highlightsMode = ctx.config.roughCutIntent === 'highlights'
  const allowedTools = Array.isArray(context.fullTranscript) && context.fullTranscriptWordIndexed === true
    ? [] // Full word-indexed context was supplied. No fragment-reading workflow.
    : TOOL_SCHEMAS.filter((tool) => readTools[role].includes(tool.name))
  const wordFootage=role==='footage' && context.fullTranscriptWordIndexed===true
  const agentMoment=ctx.config.storyMode==='clip_moment_v1'
  const agentStory=ctx.config.storyMode==='clip_story_v1'
  const storyObservation=ctx.config.editMode==='just_chatting_rough_cut' && !highlightsMode && !agentMoment && !agentStory && ctx.config.targetLengthS[1]<=105
  const storyBaseline=storyObservation||agentStory
  const clipTarget=ctx.config.targetLengthS.join('–')
  const visualStory=(storyObservation||agentStory) && ctx.config.visualEvidenceMode==='visual_audio' && Boolean(ctx.cache.visualEvidence)
  const candidates=visualStory ? buildVisualBeatCandidates(
    ctx.cache.visualEvidence?.coarse??[],ctx.cache.visualEvidence?.focused??[]) : []
  const submitTool=visualStory && role==='story' ? storyWithVisualBeatsSubmission
    : visualStory && wordFootage ? footageWithVisualActionsSubmission
    : wordFootage ? footageWordsSubmission : submitSchemas[role]
  const tools = [...allowedTools,submitTool]
  const messages: LunaMessage[] = [
    { role: 'system', content: [
      FILM_EDITING_THEORY, SPECIALIST_ROLES[role],
      ...(ctx.config.visualEvidenceMode==='visual_audio' && (role==='story'||role==='footage') && ctx.cache.visualEvidence ? [
        'VISUAL+AUDIO STORY EXPERIMENT: You have time-aligned Gemini observations from low-resolution video frames and the ORIGINAL audio, alongside authoritative ASR. Frame observations are uncertain, not confirmed ground truth. Look for physical comedy, visual reveals, genuine reactions, frustrations and payoffs even when the transcript is thin. Story: visual beats are FIRST-CLASS optional narrative candidates; explicitly choose observed candidate IDs with whyFunnyToWatch and narrativePurpose, rather than fitting every event into a preselected speech plot. Do not force unrelated events. Footage: select word IDs for speech AND optional observed visual-only source intervals in visualActions. Choose the action start/end within the referenced evidence timestamp range; maintain complete visible actions where possible and avoid cutting through spoken words. Do not invent visual events or source timestamps. Original audio remains attached. Flow edits dialogue only; visual range selection is independently validated and preserved.',
      ] : []),
      ...(Array.isArray(context.fullTranscript) ? [
        'You have the FULL original transcript in order, not snippets. No relevant speech is omitted. Read the whole conversation before making editorial decisions.',
        ...(role==='footage' && context.fullTranscriptWordIndexed===true ? [
          'For dialogue selections submit ONLY firstWordId and lastWordId from the supplied indexed full transcript. These IDs are ZERO-BASED INDEXES, not timestamps, speaker identifiers, segment numbers or milliseconds. Each firstWordId must be <= lastWordId; passages must follow their original source order and NEVER overlap. Do not submit one enormous span that swallows later individual beats. Always preserve the actual opening and closing/payoff passages as distinct sourced selections. Deterministic code alone converts these IDs into source timestamps. In visual mode only, the separate visualActions array may have source startMs/endMs bounded by Story-approved visual candidate IDs. Finish spoken thoughts; never invent outcomes or times.'
        ] : []),
      ] : []),
      ...(ctx.config.editMode === 'just_chatting_rough_cut'
        ? [...(storyBaseline && (role==='story'||role==='footage'||role==='qa') ? [] : [JUST_CHATTING_EDITORIAL_DIRECTION, JUST_CHATTING_ROLE_DIRECTION[role]]),
          ...(agentStory ? [
            'SHORT STORY CLIP BASELINE: make ONE coherent story with a meaningful beginning, development and recorded ending. Draw from at least two genuinely different source moments. Runtime is advisory only; do not add filler or cut a payoff to reach '+clipTarget+' seconds. Preserve complete natural thought boundaries.',
          ] : storyObservation ? [
            'EDITORIAL BASELINE EXPERIMENT: Ignore all duration targets, runtime ceilings and 90-second requirements. The goal is ONE best coherent story from the authorized full transcript, whether it takes two, three, four minutes or another natural length. Identify a meaningful beginning, development and actual ending. Keep only the speech that supports that ONE story; do not concatenate every related topic. Choose complete naturally spoken thought boundaries. The deterministic tool will execute your selections unchanged. No later agent will compress, fix or substitute them.',
          ] : [ctx.config.targetLengthS[1] <= 105
            ? 'SHORT HIGHLIGHT OVERRIDE: Produce one concise 30–90 second standalone edit from the strongest sourced exchange. Prioritize an immediate understandable hook, essential context, and a satisfying payoff. Remove digressions and repetition. Short-form compression is intentional; do NOT follow the long-form pacing guidance. Respect meaning, chronology, and honest reactions. Target seconds supplied in the request.'
            : 'LONG CONVERSATION EDIT: Preserve natural context and pacing with complete thoughts. The target duration is advisory, not a failure gate.']),
        ] : []),
      ...(agentMoment ? [
        'SINGLE CONTINUOUS STREAMER MOMENT: This is NOT a montage or the long-form story baseline. Story must choose ONE powerful event from the supplied original recording. Footage must submit exactly ONE firstWordId/lastWordId interval spanning its necessary lead-in, action, genuine reaction and finished payoff. No isolated fragments, artificial joins or extra candidate moments. Respect the target seconds. Flow/QA verify completeness but MUST NOT introduce cuts or reorder footage.',
      ] : []),
      ...(highlightsMode ? [
        'HIGHLIGHTS MODE OVERRIDE: Curate several DISTINCT memorable moments across the WHOLE available source, not one continuous scene with breath cuts. Each moment must be independently understandable and interesting; authentic jokes, surprising answers, revealing quotes, reactions or sharp insights are welcome. Select 2 distinct moments for very short highlights and ideally 3+ for 60–120 seconds, without forcing weak filler. Do not pretend unrelated moments form one chronological story. Avoid repetitive quotes, fabricated context, misleading juxtapositions, dangling sentences, or cuts inside words. Source-order chronological output is required.'
      ] : []),
      'Tools are restricted by your role. Do not invent tool results. Submit one structured response with your submit tool.',
      'Work in original absolute source milliseconds. Do not flatten or export.',
    ].join('\n\n') },
    { role: 'user', content: JSON.stringify({
      ...context, sourceId: source.sourceId, sourceRangeMs: source.rangeMs,
      ...(visualStory && (role==='story'||role==='footage') ? {visualBeatCandidates:candidates,
        visualBeatInstruction:'These are observed time-bounded event CANDIDATES, not mandatory clips. Story should choose events worth watching; Footage may retain silent portions as source-ms visualActions only when Story approved the ID. Never use a transcript word timestamp as a made-up action timestamp.'} : {}),
      ...(storyObservation ? {runtimeTargetDisabled:true,experiment:'narrative_coherence_and_boundary_selection_only'} : {outputTargetSeconds:ctx.config.targetLengthS}),
      editingIntent: agentMoment ? 'single_continuous_streamer_moment' : agentStory ? 'short_streamer_story_clip' : highlightsMode ? 'multi_moment_highlights' : ctx.config.targetLengthS[1] <= 105 ? 'short_story' : 'conversational_long_form',
      ...(role === 'footage' && !highlightsMode &&
        ctx.config.editMode === 'just_chatting_rough_cut' && ctx.config.targetLengthS[1] <= 105 && !agentMoment
        ? { preferredEditInstruction: agentStory
          ? 'STORY BASELINE: selections ARE the complete final narrative, not candidates. Choose a coherent setup, development and recorded payoff, with all passages summing to '+clipTarget+' seconds. Use word IDs, omit off-topic material and preserve natural endings.'
          : 'STORY BASELINE: the selections ARE the complete final narrative, not a list of candidate moments. Choose a coherent beginning, development and ending with no length target. Do not assemble multiple loosely related stories; omit unrelated or redundant material. Return word IDs and let code cut exactly there; no other agent will trim the selections.' } : {}),
      ...((role === 'footage' || role === 'dialogue')
        ? { selectionDurationInstruction: agentMoment
          ? 'Exactly ONE contiguous source span only. Pick complete action and reaction with natural start/end inside the target seconds; do not concatenate separate scenes.'
          : agentStory
          ? 'Selections are the FINAL edit, not candidates. Sum of passage durations must land in '+clipTarget+' seconds (hard limit '+Math.max(15,ctx.config.targetLengthS[0]-12)+'–'+(ctx.config.targetLengthS[1]+12)+'). Use 2+ passages when the story contains a detour. Never select one huge span containing material Story excluded; preserve complete opening and payoff.'
          : highlightsMode
          ? 'Find distinct self-contained highlights from different source moments. Do not count adjacent breath cuts as different moments. Choose compelling footage up to the duration target without padding; finish each excerpt on a complete thought.'
          : storyObservation ? 'For this baseline, IGNORE runtime. Find the complete spoken passages that tell ONE compelling story from opening to resolution. Cut irrelevant digressions and repeated points, but never trim for a duration target. Select accurate starts and endings from the transcript and report exactly those word IDs.'
          : 'For short Story, selections are the ACTUAL EDIT roughly within the target seconds, not hundreds of seconds of candidate footage. Cut whole irrelevant phrases and tangents; keep the setup, development and payoff. Do not pad or cut mid-thought. If truly insufficient material exists, submit the most coherent short edit.' }
        : {}),
      ...(role === 'qa' && ctx.config.editMode === 'just_chatting_rough_cut'
        ? { requiredReviewChecks: JUST_CHATTING_REVIEW_CHECKS } : {}),
    }) },
  ]
  let transcriptReads = 0
  let invalidSubmissions = 0
  let bestWordRecovery:ReturnType<typeof recoverFootageWordSelections>|null=null
  let bestWordRecoveryQuality=-1
  let bestRawVisualActions:unknown=null
  let bestValidVisualCount=0
  await specialistEvent(ctx, budget, role, 'start', {
    wordCount: ctx.cache.words?.length ?? 0, sourceRangeMs: source.rangeMs,
    fullTranscriptDelivered: Array.isArray(context.fullTranscript),
    deliveredTranscriptWordCount: Array.isArray(context.fullTranscript) ? context.fullTranscript.length : 0,
    storyOutline: role === 'footage' ? context.storyOutline : undefined,
    allowedCount: Array.isArray(context.curatedSelections) ? context.curatedSelections.length : undefined,
  })
  for (let turn = 0; turn < 10; turn++) {
    if (budget.state() === 'hard') throw new Error('specialist_budget_exhausted')
    // Reserve the last half of the budget for a structured handoff, not
    // repeated transcript searches. The initial context already includes
    // inventory plus twelve chronological transcript samples.
    const mustSubmit = turn >= 5 || (role !== 'story' && role !== 'footage' && transcriptReads >= 3) || invalidSubmissions >= 2
    const turnTools = mustSubmit ? [submitTool] : tools
    await specialistEvent(ctx, budget, role, 'turn', { turn, transcriptReads, invalidSubmissions, forcedSubmit: mustSubmit, allowedTools: turnTools.map((t) => t.name) })
    const response = await lunaChat({ messages, tools: turnTools, toolChoice: 'required' })
    budget.steps++
    budget.addLuna(response.usage)
    messages.push(response.message)
    await logAiProducerStep({
      runId: ctx.runId, stepIndex: budget.steps,
      phase: 'plan', tool: 'specialist_' + role, kind: 'luna',
      resultSummary: `${response.message.tool_calls?.length ?? 0} specialist tool calls`,
      tokensIn: response.usage?.prompt_tokens,
      tokensOut: response.usage?.completion_tokens,
    })
    const calls = response.message.tool_calls ?? []
    if (!calls.length) {
      messages.push({ role: 'user', content: `Call ${names[role]} when ready, or an available read-only tool.` })
      continue
    }
    for (const call of calls) {
      const name = call.function.name
      const args = safeJson(call.function.arguments)
      const isSubmit=name===submitTool.name
      if (isSubmit) await specialistEvent(ctx, budget, role, 'submit_attempt', {
        turn, callId: call.id, proposal: selectionLogSummary(args),
        malformedJson: args === null,
      })
      if (isSubmit && !args) {
        invalidSubmissions++
        await specialistEvent(ctx, budget, role, 'rejected', {
          turn, invalidSubmissions, errorCode: 'specialist_malformed_submission',
        }, 'specialist_malformed_submission')
        if (invalidSubmissions >= 2) throw new Error(`specialist_${role}_unusable_submissions`)
        messages.push({ role: 'tool', tool_call_id: call.id,
          content: '{"ok":false,"error":"specialist_malformed_submission","instruction":"Submit valid structured JSON."}' })
        continue
      }
      if (isSubmit && args) {
        try {
        if (role === 'story') {
          if (typeof args.logline !== 'string' || typeof args.audiencePromise !== 'string' ||
              !Array.isArray(args.beats) || args.beats.length < 3 ||
              args.beats.length > 10 || !args.beats.every((b) => typeof b === 'string') ||
              !['intendedPayoff','essentialSetup','endingRule','highlightCriteria']
                .every(k => typeof args[k] === 'string' && (args[k] as string).trim().length > 0) ||
              !Array.isArray(args.excludeAsides) || args.excludeAsides.length > 10 ||
              !args.excludeAsides.every((v) => typeof v === 'string')) {
            throw new Error('specialist_story_outline_invalid')
          }
          if(visualStory)args.visualBeats=validateStoryVisualBeats(args.visualBeats,candidates)
          await specialistEvent(ctx, budget, role, 'accepted', { turn, beatCount: args.beats.length, storyDecision: args,
            visualBeats: visualStory ? args.visualBeats : undefined })
          return args
        }
        if (role === 'footage' || role === 'dialogue') {
          const allowed = role === 'dialogue'
            ? context.curatedSelections as EditorialSelection[] | undefined
            : undefined
          let selections: EditorialSelection[]
          let visualActions:VisualActionSelection[]=[]
          let visualActionOmissions:Array<{id:string;reason:string}>=[]
          let visualActionRepairs:Array<{id:string;original:[number,number];repaired:[number,number]}>=[]
          // Validate the spoken edit FIRST. Optional visual action mistakes
          // never discard a source-grounded, coherent word-ID selection.
          let recovery: ReturnType<typeof recoverEditorialSelections> | undefined
          try {
            selections = wordFootage
              ? resolveFootageWordSelections(args.selections,ctx.cache.words??[],source.rangeMs)
              : snapEditorialSelections(args.selections, source.rangeMs, ctx.cache.words ?? [], allowed)
          } catch (firstError) {
            if(wordFootage)throw firstError // Repair only as source-local word IDs, never reinterpret them as milliseconds.
            recovery = recoverEditorialSelections(args.selections, source.rangeMs, ctx.cache.words ?? [], allowed)
            if (!recovery.selections.length) throw firstError
            selections = recovery.selections
            await specialistEvent(ctx, budget, role, 'server_recovered', {
              turn, dropped: recovery.dropped, unsafeEdges: recovery.unsafeEdges,
              count: selections.length, originalError: String((firstError as Error).message),
            })
          }
          if (visualStory && wordFootage) {
            const recoveredVisual=recoverVisualActionRequests(args.visualActions,candidates,
              (context.storyOutline as EditorialOutline | undefined)?.visualBeats??[],
              ctx.cache.words??[],source.rangeMs)
            visualActions=recoveredVisual.selections
            visualActionOmissions=recoveredVisual.omitted
            visualActionRepairs=recoveredVisual.repairs
            await specialistEvent(ctx,budget,role,'visual_action_validation',{
              turn,submitted:args.visualActions,accepted:visualActions,
              repaired:visualActionRepairs,omitted:visualActionOmissions,
              speechSelectionsPreserved:selections.length,
            })
          }
          if (wordFootage) {
            await specialistEvent(ctx, budget, role, 'direct_word_cuts', {
              turn, submittedWordIds: args.selections,
              executedCutTimestamps: selections.map((s,i) => ({
                passage: i, startMs: s.startMs, endMs: s.endMs,
                durationMs: s.endMs-s.startMs,
                firstWordId: (args.selections as Array<{firstWordId:number}>)[i]?.firstWordId,
                lastWordId: (args.selections as Array<{lastWordId:number}>)[i]?.lastWordId,
                firstWord: ctx.cache.words[(args.selections as Array<{firstWordId:number}>)[i]?.firstWordId]?.w,
                lastWord: ctx.cache.words[(args.selections as Array<{lastWordId:number}>)[i]?.lastWordId]?.w,
                cutStartInsideOtherWord: Boolean(wordAtUnsafeBoundary(s.startMs,ctx.cache.words)),
                cutEndInsideOtherWord: Boolean(wordAtUnsafeBoundary(s.endMs,ctx.cache.words)),
              })),
              note: 'Cut times exactly match the chosen word timestamps, no snapping or boundary veto.',
            })
          }
          const duration = durationAdvisory(selections, ctx.config.targetLengthS)
          await specialistEvent(ctx, budget, role, storyObservation ? 'runtime_ignored_observation' : 'duration_advisory',
            storyObservation ? { actualSeconds:selectionDurationS(selections), runtimeTargetDisabled:true } : { ...duration, acceptedDespiteDuration: duration.outsideTarget })
          await specialistEvent(ctx, budget, role, 'accepted', { turn, proposal: selectionLogSummary(args),
            accepted: selections.map((s) => [s.startMs, s.endMs]),
            movedEdges: wordFootage ? 0 : selections.filter((s, i) => s.startMs !== (args.selections as EditorialSelection[])[i]?.startMs ||
              s.endMs !== (args.selections as EditorialSelection[])[i]?.endMs).length,
            visualActions: visualStory ? visualActions : undefined,
            visualActionRepairs:visualStory ? visualActionRepairs : undefined,
            visualActionOmissions:visualStory ? visualActionOmissions : undefined,
          })
          return { selections, ...(visualStory && wordFootage ? {visualActions,visualActionOmissions} : {}) }
        }
        if (typeof args.pass !== 'boolean' || !Array.isArray(args.issues) ||
            !args.issues.every((i) => typeof i === 'string')) {
          throw new Error('specialist_review_invalid')
        }
        await specialistEvent(ctx, budget, role, 'accepted', { turn, pass: args.pass, issueCount: args.issues.length, issues: args.issues.slice(0,15) })
        return { pass: args.pass, issues: args.issues.slice(0, 15) }
        } catch (error) {
          invalidSubmissions++
          const errorCode = String((error as Error)?.message ?? error).slice(0, 240)
          const allowed = role === 'dialogue'
            ? context.curatedSelections as EditorialSelection[] | undefined
            : undefined
          const repairHint = wordFootage
            ? {...footageWordRepairHint(args.selections,ctx.cache.words??[],source.rangeMs),errorCode}
            : (role === 'footage' || role === 'dialogue')
            ? selectionRepairHint(args.selections, ctx.cache.words ?? [], source.rangeMs, allowed)
            : {}
          await specialistEvent(ctx, budget, role, 'rejected', {
            turn, invalidSubmissions, errorCode,
            proposal: selectionLogSummary(args),
            repairHint,
          }, errorCode)
          // Models sometimes choose an imprecise word boundary. Reject the
          // proposal but give this specialist a chance to repair it before
          // the entire twenty-minute run fails.
          if(wordFootage){
            const recovered=recoverFootageWordSelections(args.selections,ctx.cache.words??[],source.rangeMs)
            const quality=footageRecoveryQuality(recovered,args.selections)
            if(quality>bestWordRecoveryQuality){
              bestWordRecovery=recovered
              bestWordRecoveryQuality=quality
            }
            // Visual/audio event proposals are independent of dialogue
            // validation. A later response may improve game footage even
            // when it contains fewer valid speech passages.
            if(visualStory){
              const visual=recoverVisualActionRequests(args.visualActions,candidates,
                (context.storyOutline as EditorialOutline|undefined)?.visualBeats??[],
                ctx.cache.words??[],source.rangeMs)
              if(visual.selections.length>bestValidVisualCount){
                bestValidVisualCount=visual.selections.length
                bestRawVisualActions=args.visualActions
              }
              await specialistEvent(ctx,budget,role,'visual_actions_after_word_rejection',{
                turn,valid:visual.selections.length,omitted:visual.omitted,
                retainedIndependently:bestValidVisualCount,
              })
            }
          }
          if(invalidSubmissions >= (wordFootage?3:2)){
            // Never fabricate a generic source-tail replacement. If the LLM
            // produced two or more genuine nonoverlapping word passages,
            // retain them as an explicitly provisional paper edit; the
            // independent Flow specialist gets the real chosen story next.
            if(wordFootage&&bestWordRecovery&&bestWordRecoveryQuality>=0){
              const selectionList=bestWordRecovery.selections
              let visualActions:VisualActionSelection[]=[]
              let visualActionOmissions:Array<{id:string;reason:string}>=[]
              if(visualStory){
                const visual=recoverVisualActionRequests(bestRawVisualActions,candidates,
                  (context.storyOutline as EditorialOutline|undefined)?.visualBeats??[],
                  ctx.cache.words??[],source.rangeMs)
                visualActions=visual.selections
                visualActionOmissions=visual.omitted
              }
              await specialistEvent(ctx,budget,role,'source_word_recovery',{
                attempts:invalidSubmissions,provisionalQuality:bestWordRecoveryQuality,
                openingAndEndingRetained:true,retainedOriginalIndices:bestWordRecovery.retainedIndices,
                rejectedOriginalIndices:bestWordRecovery.rejected,selected:selectionList.map(x=>[x.startMs,x.endMs]),
                acceptedVisualActions:visualActions,visualActionOmissions,
                note:'Real source-word passages retained for independent Flow review, not fabricated fallback.'})
              return {selections:selectionList,visualActions,visualActionOmissions}
            }
            throw new Error(`specialist_${role}_unusable_submissions`)
          }
          messages.push({
            role: 'tool', tool_call_id: call.id,
            content: JSON.stringify({
              ok: false,
              error: errorCode,
              repairHint,
              instruction: wordFootage
                ? 'Resubmit the COMPLETE final edit using source-chronological, nonoverlapping exact word-ID passages. Keep good cuts, replace huge accidental spans, and retain genuine ending and story setup. Visual actions must be bounded to Story-approved observations.'
                : 'Correct and resubmit using sourced chronological intervals.',
            }),
          })
          continue
        }
      }
      // Enforce read-only tools even if the model hallucinates a tool name.
      if (!readTools[role].includes(name)) {
        await specialistEvent(ctx, budget, role, 'forbidden_tool', { turn, name })
        messages.push({ role: 'tool', tool_call_id: call.id, content: '{"ok":false,"error":"role_tool_forbidden"}' })
        continue
      }
      if (name === 'get_transcript') transcriptReads++
      const result = await runTool(ctx, name, args ?? {}, out, budget)
      budget.steps++
      budget.addGemini(result.costUsd)
      await logAiProducerStep({
        runId: ctx.runId, stepIndex: budget.steps,
        phase: 'plan', tool: `specialist_${role}_${name}`, kind: 'tool',
        argsSummary: JSON.stringify(redactArgs(args)).slice(0, 1200),
        resultSummary: result.summary, estUsd: result.costUsd,
        error: result.ok ? undefined : result.summary,
      })
      messages.push({ role: 'tool', tool_call_id: call.id, content: summarizeToolResult(name, result) })
    }
  }
  await specialistEvent(ctx, budget, role, 'exhausted', { transcriptReads, invalidSubmissions },
    `specialist_${role}_did_not_submit`)
  throw new Error(`specialist_${role}_did_not_submit_after_${invalidSubmissions}_invalid_attempts`)
}

function representativeTranscript(words: ClipWord[], range: [number, number]) {
  // Chronological coverage, not only top highlights. Each excerpt points to
  // words that exist; the specialist can request fuller nearby transcripts.
  const windows = 12
  const span = (range[1] - range[0]) / windows
  return Array.from({ length: windows }, (_, i) => {
    const start = range[0] + i * span
    const end = start + span
    const hits = words.filter((w) => w.s * 1000 < end && w.e * 1000 > start)
    return {
      rangeMs: [Math.round(start), Math.round(end)],
      excerpt: hits.slice(0, 25).map((w) => w.w).join(' ').slice(0, 300),
      endingExcerpt: hits.slice(-25).map((w) => w.w).join(' ').slice(0, 300),
    }
  })
}

/** Only when Story approved meaningful observed visuals but Footage returned
 * none: give gameplay its own small, media-led selection opportunity.
 * No visual clips are mandatory, and all chosen spans are validated against
 * original source timestamps and observed audio/video evidence. */
const visualCompletionTool:ToolSchema={
  name:'submit_story_visual_action_completion',
  description:'Independently consider already Story-approved visual/audio events for nonduplicative insertion.',
  parameters:{type:'object',additionalProperties:false,properties:{
    visualActions:{type:'array',maxItems:6,items:{
      type:'object',additionalProperties:false,properties:{
        visualBeatId:jsonString,startMs:{type:'integer',minimum:0},
        endMs:{type:'integer',minimum:1},beat:jsonString,reason:jsonString,
      },required:['visualBeatId','startMs','endMs','beat','reason'],
    }},
    rationale:jsonString,
  },required:['visualActions','rationale']},
}

export async function completeMissingStoryVisualActions(
  ctx:ToolCtx,budget:Budget,outline:EditorialOutline,
  speech:EditorialSelection[],
):Promise<{selections:VisualActionSelection[];omitted:Array<{id:string;reason:string}>}> {
  const source=ctx.sources[0],words=ctx.cache.words??[]
  const approved=outline.visualBeats??[]
  if(!source?.rangeMs||!approved.length||!ctx.cache.visualEvidence)
    return {selections:[],omitted:[]}
  const candidates=buildVisualBeatCandidates(ctx.cache.visualEvidence.coarse??[],
    ctx.cache.visualEvidence.focused??[])
  const allowed=candidates.filter(c=>approved.some(a=>a.id===c.id))
  if(!allowed.length)return {selections:[],omitted:approved.map(a=>({
    id:a.id,reason:'story_visual_evidence_not_found',
  }))}
  try{
    const reply=await lunaChat({tools:[visualCompletionTool],toolChoice:'required',
      messages:[
        {role:'system',content:[
          'You are the independent GAMEPLAY VISUAL FOOTAGE EDITOR. The story is chosen and word-exact spoken passages are locked. You have real timestamped video/original-audio Gemini observations already approved as relevant by Story.',
          'Select ONLY the visually significant actions or original-audio events that would improve this ONE true story. Keep source-chronological events. The source timestamps are absolute. Refer to the exact approved visualBeatId and a clip wholly inside its actual observation range. Do not invent an event or extend an observed interval.',
          'Do not duplicate an action already fully visible in the selected speech footage. An empty array is valid if every valuable moment is already covered by dialogue video or would be unrelated. Video actions should not require a spoken word ID. No quota; quality over quantity.',
        ].join(' ')},
        {role:'user',content:JSON.stringify({
          approvedEvents:allowed.map(c=>({id:c.id,sourceRangeMs:c.sourceRangeMs,
            observation:c.observation,whyInteresting:c.whyInteresting,
            spokenContext:c.spokenContext,analysisTier:c.analysisTier})),
          approvedPurpose:approved,selectedSpeechWindows:speech.map(x=>[x.startMs,x.endMs]),
          sourceRangeMs:source.rangeMs,
        })},
      ]})
    budget.steps++
    budget.addLuna(reply.usage)
    const call=reply.message.tool_calls?.find(x=>
      x.function.name===visualCompletionTool.name)
    if(!call)throw Error('visual_completion_missing_submission')
    const proposed=safeJson(call.function.arguments)
    if(!proposed||!Array.isArray(proposed.visualActions))
      throw Error('visual_completion_invalid_submission')
    const recovered=recoverVisualActionRequests(proposed.visualActions,candidates,
      approved,words,source.rangeMs)
    await specialistEvent(ctx,budget,'footage','independent_visual_completion',{
      proposed:selectionLogSummary({selections:[],visualActions:proposed.visualActions}),
      accepted:recovered.selections,omitted:recovered.omitted,
      rationale:String(proposed.rationale??'').slice(0,500),
    })
    return {selections:recovered.selections,omitted:recovered.omitted}
  }catch(error){
    const reason=String((error as Error)?.message??error).slice(0,230)
    await specialistEvent(ctx,budget,'footage','independent_visual_completion_unavailable',{
      reason,approvedBeatIds:approved.map(a=>a.id),
      note:'Original sourced speech remains available; do not substitute unobserved gameplay.',
    })
    return {selections:[],omitted:approved.map(a=>({
      id:a.id,reason:'visual_completion_unavailable:'+reason,
    }))}
  }
}

export async function createEditorialHandoff(
  ctx: ToolCtx, out: OutputState, budget: Budget, instruction: string | null,
): Promise<EditorialHandoff> {
  const source = ctx.sources[0]
  if (!source?.rangeMs || !ctx.cache.words?.length) throw new Error('rough_cut_transcript_missing')
  const highlightsMode = ctx.config.roughCutIntent === 'highlights'
  const momentClip = ctx.config.storyMode === 'clip_moment_v1'
  const storyClip = ctx.config.storyMode === 'clip_story_v1'
  const clipBrief = momentClip
    ? 'SINGLE MOMENT CLIP: Find one great source event with the actual opening context, event, reaction and payoff. Return exactly ONE continuous source passage, without montage, unrelated padding or jump cuts. Runtime is flexible (15 seconds, 40 seconds, or longer); never pad a strong moment for length. excludeAsides must lie OUTSIDE that span. An unrelated middle detour cannot be removed; choose a different continuous event, start after it, or accept it as part of the moment.'
    : storyClip
      ? 'SHORT STORY CLIP: Form one meaningful setup, escalation and genuine source-recorded payoff from multiple nonoverlapping passages. Choose a coherent short story; the requested duration is a preference, never a reason to pad, cut off payoff or fail.'
      : null
  const base = {
    instruction: clipBrief ? [clipBrief,instruction??''].filter(Boolean).join(' ') : instruction,
    // Samples remain available for non-Story workflows; Story and Footage
    // below explicitly replace them with the FULL original transcript.
    transcriptSamples: representativeTranscript(ctx.cache.words, source.rangeMs),
    observedMoments: ctx.cache.momentsSummary,
    inventory: ctx.cache.inventorySummary,
    ...(ctx.config.visualEvidenceMode==='visual_audio' && ctx.cache.visualEvidence ? {
      visualAudioEvidence:ctx.cache.visualEvidence,
      visualAudioEvidenceDisclaimer:'Gemini video/audio observations are candidate evidence, not guaranteed facts; ASR word IDs remain authoritative for speech cuts. No frame-based cut execution in this experiment.',
    } : {}),
    audienceGoal: momentClip ? 'One unbroken source event with intelligible setup and complete payoff'
      : storyClip ? 'A tight story assembled from multiple grounded passages with a real payoff'
      : highlightsMode
      ? 'A highlight reel of multiple distinct, entertaining, independently comprehensible moments across the whole source, with honest context and complete thoughts'
      : ctx.config.targetLengthS[1] <= 105
        ? 'A focused, independently understandable story with full setup, development and an actual recorded payoff. Experimental baseline: ignore the target duration; prioritize complete natural passages and coherent narrative.'
        : 'A coherent conversational long-form edit preserving context and natural pacing',
    editingPriorities: ['meaning and context','narrative payoff','natural dialogue and reactions','no repetition','restrained polish'],
  }
  let story: Record<string, unknown>
  try {
    story = await runEditorialRole(ctx, out, budget, 'story', {
      ...base,
      transcriptSamples:undefined,
      fullTranscriptWordIndexed:true,
      fullTranscriptFormat:'[originalWordId, spokenWord] — ALL spoken words in source order, no omissions',
      fullTranscript:completeTranscriptWords(ctx.cache.words,false),
      instruction: storyClip
        ? [clipBrief,instruction??'','Define the main story, intended resolution (as a hypothesis to VERIFY in the source), essential setup, off-topic material to exclude, and exact editorial condition for a natural ending. Provide all structured creative-brief fields. Do not assert an unconfirmed outcome as fact. Let the edit stop naturally; time is informational.'].join(' ')
        : (clipBrief ? [clipBrief,instruction??''].filter(Boolean).join(' ') : null) ?? (highlightsMode
        ? 'Define the editorial criteria for selecting independent, self-contained highlights. The payoff and ending fields express what makes a moment satisfying, not a fabricated shared narrative. Provide all structured creative-brief fields.'
        : 'Define the main story, intended resolution (as a hypothesis to VERIFY in the source), essential setup, off-topic material to exclude, and exact editorial condition for a natural ending. Provide all structured creative-brief fields. Do not assert an unconfirmed outcome as fact.'),
    })
  } catch (error) {
    // Never invent a generic Story for this baseline. Surface the model failure
    // instead of asking Footage to cut a story that Story never selected.
    if (!highlightsMode && ctx.config.editMode === 'just_chatting_rough_cut' && ctx.config.targetLengthS[1] <= 105) {
      await specialistEvent(ctx,budget,'story','story_decision_failed_no_fallback',{
        errorCode:String((error as Error)?.message??error).slice(0,500),
        sourceRangeMs:source.rangeMs,
      },String((error as Error)?.message??error).slice(0,500))
      throw error
    }
    // An unavailable paper outline must not destroy a sourced editable draft.
    await specialistEvent(ctx, budget, 'story', 'fallback', {
      errorCode: String((error as Error)?.message ?? error).slice(0, 200),
    })
    story = { logline: 'Source-grounded conversational rough cut',
      audiencePromise: 'Review the best available recorded conversation',
      beats: ['context', 'discussion', 'resolution'],
      intendedPayoff: 'Determine the actual recorded resolution; do not assume the outcome',
      essentialSetup: 'Include enough recorded context to understand what happened',
      excludeAsides: [],
      endingRule: 'Stop once the genuine, source-supported idea resolves naturally',
      highlightCriteria: 'Select individually interesting exchanges with their own complete landing' }
  }
  const outline: EditorialOutline = {
    logline: String(story.logline),
    audiencePromise: String(story.audiencePromise),
    beats: (story.beats as string[]).slice(0, 10),
    intendedPayoff: String(story.intendedPayoff),
    essentialSetup: String(story.essentialSetup),
    excludeAsides: (story.excludeAsides as string[]).slice(0, 10),
    endingRule: String(story.endingRule),
    highlightCriteria: String(story.highlightCriteria),
    ...(ctx.config.visualEvidenceMode==='visual_audio' && !highlightsMode && ctx.config.targetLengthS[1]<=105 ? {
      visualBeats: (story.visualBeats as StoryVisualBeat[] | undefined)??[],
    } : {}),
  }
  await specialistEvent(ctx,budget,'story','story_handoff',{outline,sourceRangeMs:source.rangeMs,transcriptWords:ctx.cache.words.length,
    visualAudioEvidenceUsed:ctx.config.visualEvidenceMode==='visual_audio' && Boolean(ctx.cache.visualEvidence),
    visualObservationCounts:ctx.cache.visualEvidence?{coarse:ctx.cache.visualEvidence.coarse.length,focused:ctx.cache.visualEvidence.focused.length}:undefined,
  })
  let found: Record<string, unknown>
  try {
    found = await runEditorialRole(ctx, out, budget, 'footage', {
      ...base, storyOutline: outline,
      transcriptSamples:undefined,
      fullTranscriptWordIndexed:!highlightsMode && ctx.config.editMode==='just_chatting_rough_cut' && ctx.config.targetLengthS[1]<=105,
      fullTranscriptFormat:'[originalWordId, startMs, endMs, spokenWord] — FULL original source in chronological order',
      fullTranscript:completeTranscriptWords(ctx.cache.words,true),
      instruction: storyClip
        ? [clipBrief,instruction??'','STORY COHERENCE BASELINE: You have the COMPLETE word-indexed source and Story plan. Choose actual final passages by FIRST/LAST WORD IDS. Tell ONE complete narrative from recorded setup through the genuine payoff, trimming irrelevant tangents. Select complete sentences, not mid-phrase edges. Each selection\'s seconds are (endMs-startMs)/1000 from the indexed transcript; report the running total in each reason. Use as much sourced footage as this natural story needs; no length compliance is required.'].join(' ')
        : (clipBrief ? [clipBrief,instruction??''].filter(Boolean).join(' ') : null) ?? (highlightsMode
        ? 'HIGHLIGHTS SCOUT: Compare the strongest memorable moments from across the full authorized recording. Select 2+ distinct moments for short edits and ideally 3+ for one to two minutes. Moments must offer new entertainment/information, not simply adjacent speech separated by a pause. Each moment needs just enough setup and its own landing; order chronologically, preserve meaning, and avoid unrelated filler. Do not take a continuous 90-second stretch as a highlights reel.'
        : ctx.config.targetLengthS[1] <= 105
        ? 'STORY COHERENCE BASELINE: You have the COMPLETE word-indexed source, Story plan, and every spoken word. Choose actual final passages by FIRST/LAST WORD IDS. IGNORE 90 seconds and ALL runtime targets. Tell ONE complete narrative from beginning through genuine recorded resolution, trimming irrelevant tangents but not the story for length. Select complete sentences, not mid-phrase edges. No later Finisher or Dialogue recut will repair your boundaries.'
        : 'Select coherent source intervals; evidence first, then editorial value.'),
    })
  } catch (error) {
    // Never replace a Story agent's editorial plan with an unrelated source tail.
    // Surface the execution failure and log it rather than publishing a fake edit.
    if (!highlightsMode && ctx.config.editMode === 'just_chatting_rough_cut' && ctx.config.targetLengthS[1] <= 105) {
      await specialistEvent(ctx, budget, 'footage', 'direct_cut_failed_no_fallback', {
        errorCode: String((error as Error)?.message ?? error).slice(0,500),
        selectedStory: outline,
        sourceRangeMs: source.rangeMs,
        note: 'Do not substitute unrelated footage; no fabricated fallback edit.',
      }, String((error as Error)?.message ?? error).slice(0,500))
      throw error
    }
    // Last-resort, honest first-pass source selection. Keep an editable draft
    // rather than losing the upload to failed model submissions.
    const [start, end] = source.rangeMs
    const targetMs = Math.min(end - start, Math.max(30_000, ctx.config.targetLengthS[0] * 1000))
    const fallbackStart = Math.max(start, end - targetMs)
    const provisional: EditorialSelection[] = [{
      startMs: fallbackStart, endMs: end, beat: 'discussion',
      reason: 'Fallback source selection; review and refine in the editor',
    }]
    const recovered = recoverEditorialSelections(provisional, source.rangeMs, ctx.cache.words)
    if (!recovered.selections.length) throw error
    await specialistEvent(ctx, budget, 'footage', 'fallback_to_source', {
      errorCode: String((error as Error)?.message ?? error).slice(0, 200),
      selectedMs: end - fallbackStart, unsafeEdges: recovered.unsafeEdges,
    })
    found = { selections: recovered.selections }
  }
  let footage = found.selections as EditorialSelection[]
  // Keep the Footage agent's best complete moment. A second pass aimed solely
  // at 60s repeatedly padded unrelated talk and overrode the Story ending.
  let visualActions = (found.visualActions as VisualActionSelection[] | undefined)??[]
  let submittedVisualOmissions=(found.visualActionOmissions as Array<{id:string;reason:string}>|undefined)??[]
  if(!momentClip&&!highlightsMode&&ctx.config.editMode==='just_chatting_rough_cut'&&
     ctx.config.visualEvidenceMode==='visual_audio'&&ctx.config.targetLengthS[1]<=105&&
     !visualActions.length&&(outline.visualBeats?.length??0)>0){
    const completed=await completeMissingStoryVisualActions(ctx,budget,outline,footage)
    visualActions=completed.selections
    submittedVisualOmissions=[...submittedVisualOmissions,...completed.omitted]
  }
  const [minimumSeconds, maximumSeconds] = ctx.config.targetLengthS
  if(momentClip){
    // Never silently publish a stitched reel in Single Moment mode.
    if(footage.length!==1 || footage[0]?.kind==='visual_action')
      throw Error('clip_moment_requires_one_continuous_source_passage')
    const first=footage[0]!
    const seconds=(first.endMs-first.startMs)/1000
    if(seconds<=0) throw Error('clip_moment_empty_source_passage')
    // A complete short clip is not a warning or a quality defect.
    let reviewed:Awaited<ReturnType<typeof runStoryFlowReview>>
    try{
      reviewed=await runStoryFlowReview(ctx,budget,outline,footage,{
        mode:'moment',
      })
    }catch(error){
      const errorCode=String((error as Error)?.message??error).slice(0,400)
      await specialistEvent(ctx,budget,'flow','review_unavailable_kept_footage',{
        errorCode,originalCuts:footage,note:'One continuous span preserved after unavailable Flow',
      },errorCode)
      reviewed={cutPlan:footage,review:{originalCuts:footage.map(c=>({...c})),
        changes:[],applied:false,note:'Flow review unavailable: '+errorCode}}
    }
    const proposed=reviewed.cutPlan.length===1?reviewed.cutPlan[0]:null
    // A legitimate inward Flow trim is authoritative even if shorter.
    const {selection:finalCut,accepted:useTrim}=selectMomentFlowTrim(first,proposed)
    await specialistEvent(ctx,budget,'flow',useTrim&&
      (finalCut.startMs!==first.startMs||finalCut.endMs!==first.endMs)
      ?'moment_flow_trim_applied':'moment_preserve_source_continuity',{
      original:first,proposed:reviewed.cutPlan,finalCut,
    })
    return {outline,footage,cutPlan:[finalCut],flowReview:reviewed.review,
      visualActions:[],visualActionOmissions:[]}
  }
  const shortStory = !highlightsMode && ctx.config.editMode === 'just_chatting_rough_cut' && maximumSeconds <= 105
  if (shortStory) {
    // Footage's original word-ID cuts are preserved as an auditable baseline.
    // A separate, optional one-pass Flow Editor may repair actual narrative
    // context before deterministic assembly. No seam search, Finisher, Dialogue,
    // compression, or source-tail substitution.
    await specialistEvent(ctx,budget,'footage','full_transcript_word_edit_handoff',{
      transcriptWords:ctx.cache.words.length,
      passageCount:footage.length,
      durationSeconds:selectionDurationS(footage),
      targetSeconds:ctx.config.targetLengthS,
      runtimeTargetDisabled:!storyClip,
      editorialBaseline:storyClip?'short_story_clip_with_payoff':'story_coherence_and_cut_boundaries',
      appliedCuts: footage,
      storyDecision: outline,
      note:'Exact selected word timestamps were applied unchanged; no Finisher, Dialogue or source-tail fallback',
    })
    if(storyClip){
      const targetMid=maximumSeconds
      const desiredLo=Math.max(15,targetMid-10)
      const desiredHi=targetMid+10
      // Duration is never a Story quality or selection criterion.
      // Footage can request distant source moments, not just slightly extend
      // an adjacent 29-second trim. Each repair receives the FULL transcript,
      // original candidate/outline, and explicit failed source-gap evidence.
      for(let attempt=0;attempt<5&&budget.state()!=='hard';attempt++){
        const coverage=storyCoverage(footage,targetMid)
        const duration=coverage.durationSeconds
        // A coherent story with genuine separate source moments is enough.
        // Do not make additional model calls just to reach 50–70 seconds.
        if(coverage.separated)break
        await specialistEvent(ctx,budget,'footage','story_search_more_moments',{
          attempt,sourceRangeMs:source.rangeMs,previousSelections:footage,
          durationSeconds:duration,gapsMs:coverage.gapsMs,
          missingSeconds:Math.max(0,desiredLo-duration),
          desiredSeconds:[desiredLo,desiredHi],
        })
        try{
          const revised=await runEditorialRole(ctx,out,budget,'footage',{
            ...base,storyOutline:outline,fullTranscriptWordIndexed:true,
            fullTranscriptFormat:'[originalWordId, startMs, endMs, spokenWord]',
            fullTranscript:completeTranscriptWords(ctx.cache.words,true),
            previousSelections:footage,
            previousDurationSeconds:duration,
            targetSeconds:[desiredLo,desiredHi],
            otherObservedMoments:ctx.cache.momentsSummary,
            instruction:[
              'STORY CLIP SEARCH AND REPAIR:',
              'The clip must contain at least TWO genuinely separated moment REGIONS (>=2500ms original-source gap between clusters). Small cuts within one region do not invalidate a story.',
              'Search the ENTIRE provided source transcript and observed moments for missing setup, escalation, reaction and genuine payoff, including distant times.',
              'Do not try to reach the nominal '+targetMid+' second preset; deliver the strongest complete narrative even when 15 or 40 seconds.',
              'Do not concatenate consecutive snippets from the same continuous scene; do not fabricate context or add unrelated filler.',
              'Keep valid prior moments when useful, but replace the whole plan if needed to find a real multi-moment story.',
              'Use exact transcript word IDs and complete natural boundaries.',
            ].join(' '),
          })
          const candidate=revised.selections as EditorialSelection[]
          const next=storyCoverage(candidate,targetMid)
          // Separation is mandatory. Prefer real separated stories even when
          // still short, then let further passes add meaningful beats.
          const improved=next.separated&&!coverage.separated ||
            (!coverage.separated&&next.distinctMoments>coverage.distinctMoments)
          await specialistEvent(ctx,budget,'footage','story_search_more_moments_result',{
            attempt,accepted:improved,durationSeconds:next.durationSeconds,
            separated:next.separated,gapsMs:next.gapsMs,
          })
          if(improved)footage=candidate
        }catch(error){
          await specialistEvent(ctx,budget,'footage','story_search_more_moments_unavailable',{
            attempt,errorCode:String((error as Error)?.message??error).slice(0,260),
          })
        }
      }
      const finalCoverage=storyCoverage(footage,targetMid)
      if(!finalCoverage.separated)
        throw Error('clip_story_requires_distinct_source_passages')
      // Runtime is telemetry only. No duration penalty or publication veto.
    }
    let reviewed:Awaited<ReturnType<typeof runStoryFlowReview>>
    try {
      reviewed=await runStoryFlowReview(ctx,budget,outline,footage,
        storyClip?{mode:'story'}:{mode:'baseline'})
    } catch (error) {
      const errorCode=String((error as Error)?.message??error).slice(0,400)
      await specialistEvent(ctx,budget,'flow','review_unavailable_kept_footage',{
        errorCode,originalCuts:footage,note:'No changes applied; preserve every model-selected Footage cut without guessing replacements',
      },errorCode)
      reviewed={cutPlan:footage,review:{originalCuts:footage.map(c=>({...c})),changes:[],applied:false,note:'Flow review unavailable: '+errorCode}}
    }
    const combined=combineSpeechWithVisualActions(reviewed.cutPlan,visualActions,ctx.cache.words,source.rangeMs)
    let finalCombined=combined
    if(storyClip){
      const target=maximumSeconds
      const candidates=[
        combined,
        {cutPlan:reviewed.cutPlan,included:[],omitted:submittedVisualOmissions},
        combineSpeechWithVisualActions(footage,visualActions,ctx.cache.words,source.rangeMs),
        {cutPlan:footage,included:[],omitted:submittedVisualOmissions},
      ]
      // Never choose an adjacent pseudo-story just because its runtime fits.
      // Prefer the Flow-reviewed story when it lands in range; otherwise keep
      // the best distinct, complete source-backed alternative near the target.
      const viable=candidates.filter(candidate=>
        storyCoverage(candidate.cutPlan,target).separated)
      if(!viable.length)throw Error('clip_story_requires_distinct_source_passages')
      // Flow takes precedence if it preserves distinct moments; never undo
      // a cleaner editorial decision to chase a target length.
      finalCombined=viable[0]!
      await specialistEvent(ctx,budget,'footage','story_duration_informational',{
        durationSeconds:selectionDurationS(finalCombined.cutPlan),targetSeconds:target,
        note:'No editorial penalty, forced padding or forced truncation',
      })
    }
    if(storyClip&&!storyCoverage(finalCombined.cutPlan).separated)
      throw Error('clip_story_requires_distinct_source_passages')
    await specialistEvent(ctx,budget,'footage','visual_actions_handoff',{
      proposed:visualActions,selected:finalCombined.included,omitted:[...submittedVisualOmissions,...finalCombined.omitted],
      finalCutCount:finalCombined.cutPlan.length,visualMode:ctx.config.visualEvidenceMode==='visual_audio',
    })
    await specialistEvent(ctx,budget,'flow','handoff',{
      originalCutCount:footage.length,finalCutCount:finalCombined.cutPlan.length,
      originalCuts:footage,finalCuts:finalCombined.cutPlan,
      changes:reviewed.review.changes,
      untouchedOriginalFootage:true,
    })
    return {outline,footage,cutPlan:finalCombined.cutPlan,flowReview:reviewed.review,
      visualActions:finalCombined.included,visualActionOmissions:[...submittedVisualOmissions,...finalCombined.omitted]}
  }
  // One targeted *editorial* retry instead of accepting a 20s excerpt as a
  // requested 90s story. Preserve original cuts if the revision is worse.
  const firstCoverage = shortStory
    ? shortStoryCoverage(footage, ctx.cache.words, ctx.config.targetLengthS, source.rangeMs)
    : null
  const firstHighlightsCoverage = highlightsMode
    ? highlightsCoverage(footage, ctx.config.targetLengthS)
    : null
  if (firstHighlightsCoverage?.needsRevision && budget.state() !== 'hard') {
    const before = footage
    try {
      const revision = await runEditorialRole(ctx, out, budget, 'footage', {
        ...base, storyOutline: outline, previousSelections: before,
        previousCoverage: firstHighlightsCoverage,
        instruction: 'HIGHLIGHTS REVISION: The proposal uses adjacent segments like one excerpt, or is too short. Search DIFFERENT locations across the whole authorized source. Curate the strongest self-contained, non-repetitive moments with distinct source gaps (not breath cuts). Retain complete context and sentence endings for every highlight, and target the requested total length. Never pad with weak or unrelated footage.',
      })
      const candidates = revision.selections as EditorialSelection[]
      const after = highlightsCoverage(candidates, ctx.config.targetLengthS)
      const beforeScore = firstHighlightsCoverage.distinctMomentCount
      if (after.distinctMomentCount > beforeScore &&
          after.durationSeconds >= Math.min(firstHighlightsCoverage.durationSeconds * 0.65, minimumSeconds * 0.7) &&
          after.durationSeconds <= maximumSeconds * 1.5) {
        footage = candidates
        await specialistEvent(ctx, budget, 'footage', 'highlights_repaired', {
          before: firstHighlightsCoverage, after,
        })
      } else {
        await specialistEvent(ctx, budget, 'footage', 'highlights_revision_kept_original', { before: firstHighlightsCoverage, after })
      }
    } catch (error) {
      await specialistEvent(ctx, budget, 'footage', 'highlights_repair_unavailable', {
        errorCode: String((error as Error)?.message ?? error).slice(0, 200),
      })
    }
  }
  if (shortStory && (firstCoverage?.needsReview || selectionDurationS(footage) > maximumSeconds * 1.5) && budget.state() !== 'hard') {
    const beforeSeconds = selectionDurationS(footage)
    try {
      const revised = await runEditorialRole(ctx, out, budget, 'footage', {
        ...base, storyOutline: outline,
        previousSelections: footage,
        previousDurationSeconds: beforeSeconds,
        previousCoverage: firstCoverage,
        missingSecondsToMinimum: Math.max(0, Math.round(minimumSeconds - beforeSeconds)),
        instruction: 'FINAL STORY PAPER EDIT REVISION: selections must be the concise final edit near the requested duration, not a large source-gathering draft. Re-evaluate only essential setup, development and payoff and omit extras. Preserve chronology and honest context. If the first attempt was too long, cut whole unnecessary sentences now; if too short, add essential context without padding.',
      })
      const candidates = revised.selections as EditorialSelection[]
      const candidateSeconds = selectionDurationS(candidates)
      const candidateCoverage = shortStoryCoverage(candidates, ctx.cache.words, ctx.config.targetLengthS, source.rangeMs)
      const originalWasOversized = beforeSeconds > maximumSeconds * 1.5
      const meaningfullyShorter = originalWasOversized && candidateSeconds < beforeSeconds * 0.9 &&
        candidateSeconds >= minimumSeconds * 0.7 && !candidateCoverage.localOnly
      // Do not replace a reasonable existing edit with a longer but weaker
      // single excerpt. A complete ending or meaningful broader coverage can
      // justify a shorter alternative; adding arbitrary seconds cannot.
      const improvesEnding = !firstCoverage.terminalSentence && candidateCoverage.terminalSentence
      const improvesCoverage = firstCoverage.localOnly && !candidateCoverage.localOnly
      const improvesDuration = candidateSeconds >= minimumSeconds &&
        beforeSeconds < minimumSeconds && !candidateCoverage.localOnly
      const notWorse = candidateSeconds >= Math.min(beforeSeconds * 0.75, minimumSeconds * 0.8)
      if (meaningfullyShorter || (notWorse && candidateSeconds <= maximumSeconds * 1.5 &&
          (improvesEnding || improvesCoverage || improvesDuration ||
           (candidateSeconds > beforeSeconds + 5 && !candidateCoverage.localOnly)))) {
        footage = candidates
        await specialistEvent(ctx, budget, 'footage', 'short_story_repaired', {
          beforeSeconds, afterSeconds: candidateSeconds, count: footage.length,
          beforeCoverage: firstCoverage, afterCoverage: candidateCoverage,
        })
      } else {
        await specialistEvent(ctx, budget, 'footage', 'short_story_revision_kept_original', {
          beforeSeconds, candidateSeconds,
          candidateCoverage,
        })
      }
    } catch (error) {
      await specialistEvent(ctx, budget, 'footage', 'short_story_repair_unavailable', {
        errorCode: String((error as Error)?.message ?? error).slice(0, 200),
      })
    }
  }
  // Footage owns the edit. When it returns a long source inventory, ask the
  // SAME specialist to submit a real short paper edit; do not ask Finisher to
  // re-edit hundreds of seconds, and never promote a longer draft on retry.
  if (shortStory && selectionDurationS(footage) > maximumSeconds + 3 && budget.state() !== 'hard') {
    for (let attempt = 0; attempt < 2 && budget.state() !== 'hard'; attempt++) {
      const beforeSeconds = selectionDurationS(footage)
      try {
        const sourceWords = ctx.cache.words ?? []
        const candidateExcerpts = footage.map(sel => ({
          selection: sel,
          words: sourceWords.filter(w => w.e * 1000 > sel.startMs && w.s * 1000 < sel.endMs)
            .map(w => [Math.round(w.s*1000),Math.round(w.e*1000),w.w]),
        }))
        const revised = await runEditorialRole(ctx, out, budget, 'footage', {
          ...base, storyOutline: outline,
          previousSelections: footage,
          selectedCandidateTranscript: candidateExcerpts,
          sourceWordTuple: '[startMs,endMs,word]',
          requestedSeconds: [minimumSeconds,maximumSeconds],
          instruction: 'COMPRESS TO FINAL STORY NOW. The previous footage proposal is an oversized candidate inventory (' +
            beforeSeconds.toFixed(1) + ' seconds). Return ONLY the actual source cuts that belong in the finished approximately 90-second story. Remove whole repetitive sentences, extra questions and unrelated tangents. Aim for 75–105 seconds of complete thoughts with setup, development, real payoff. No preferredEdits array. Do not hand the boundary polisher a long draft; it can only remove 3 seconds at each edge. Keep cuts source-grounded and chronological.',
        })
        const candidate = revised.selections as EditorialSelection[]
        const afterSeconds = selectionDurationS(candidate)
        // Prefer the shorter coherent source-grounded proposal, not a 700s
        // draft. Reject grossly undersized stubs, but do not require exactly 90.
        if (afterSeconds >= minimumSeconds * 0.65 &&
            afterSeconds < beforeSeconds - 2) {
          footage = candidate
          await specialistEvent(ctx, budget, 'footage', 'final_short_edit_accepted', {
            beforeSeconds, afterSeconds, attempt, count: candidate.length,
          })
        } else {
          await specialistEvent(ctx, budget, 'footage', 'final_short_edit_not_better', {
            beforeSeconds, afterSeconds, attempt,
          })
        }
      } catch (error) {
        await specialistEvent(ctx, budget, 'footage', 'final_short_edit_retry_failed', {
          attempt, errorCode: String((error as Error)?.message ?? error).slice(0,200),
        })
      }
      if (selectionDurationS(footage) <= maximumSeconds + 3) break
    }
  }
  // The Finisher no longer selects moments, compresses a 20-minute transcript,
  // invents a payoff or changes the story. It only polishes the exact existing
  // footage edges with nearby conversational context.
  let finisher: EditorialHandoff['finisher']
  let wordBoundaryReviewed = false
  const useFinisher = !highlightsMode &&
    ctx.config.editMode === 'just_chatting_rough_cut' &&
    maximumSeconds <= 135
  if (useFinisher && budget.state() !== 'hard' &&
      selectionDurationS(footage) <= maximumSeconds + 15) {
    try {
      const { runStoryBoundaryFinisher } = await import('@/lib/ai-producer-agent/story-finisher')
      const originalDurationSeconds = selectionDurationS(footage)
      const polished = await runStoryBoundaryFinisher(ctx, budget, outline, footage)
      footage = polished
      wordBoundaryReviewed = true
      await specialistEvent(ctx, budget, 'story', 'boundary_polish_handoff', {
        beforeSeconds: originalDurationSeconds, afterSeconds: selectionDurationS(footage),
        count: footage.length,
      })
    } catch (error) {
      await specialistEvent(ctx, budget, 'story', 'boundary_polish_unavailable', {
        errorCode: String((error as Error)?.message ?? error).slice(0,200),
        note: 'Keep the Footage paper edit unchanged.',
      })
    }
  } else if (useFinisher) {
    await specialistEvent(ctx, budget, 'story', 'boundary_polish_skipped_oversized_footage', {
      sourceSeconds: selectionDurationS(footage),
      maximumSeconds,
      note: 'Boundary polish cannot substitute for the Footage Agent final edit.',
    })
  }
  let highlightsFinisher: EditorialHandoff['highlightsFinisher']
  if (highlightsMode && footage.length >= 2 && budget.state() !== 'hard') {
    try {
      const { runHighlightsFinisher } = await import('@/lib/ai-producer-agent/story-finisher')
      const originalDurationSeconds = selectionDurationS(footage)
      const decision = await runHighlightsFinisher(ctx, budget, outline, footage)
      footage = decision.selections
      highlightsFinisher = {
        moments: decision.moments,
        originalDurationSeconds,
        finalDurationSeconds: selectionDurationS(footage),
      }
      await specialistEvent(ctx, budget, 'footage', 'highlights_finisher_handoff', {
        beforeSeconds: originalDurationSeconds,
        afterSeconds: highlightsFinisher.finalDurationSeconds,
        moments: footage.length,
        landings: highlightsFinisher.moments.map(m => [m.landing.startMs,m.landing.endMs]),
      })
    } catch (error) {
      // Preserve the originally sourced moments; never pretend their dialogue
      // has been polished when the Finisher cannot verify spoken landings.
      await specialistEvent(ctx, budget, 'footage', 'highlights_finisher_unavailable', {
        errorCode: String((error as Error)?.message ?? error).slice(0,200),
      })
    }
  }
  let refined: Record<string, unknown>
  try {
    refined = await runEditorialRole(ctx, out, budget, 'dialogue', {
    ...base, storyOutline: outline, curatedSelections: footage,
    ...(finisher ? { verifiedPayoff: finisher.payoff, finisherEditorialReason: finisher.editorialReason } : {}),
    ...(highlightsFinisher ? { verifiedHighlightLandings: highlightsFinisher.moments.map(m => m.landing) } : {}),
    instruction: highlightsMode
      ? 'Preserve each DISTINCT curated highlight and its own verified source-spoken landing. Refine precise audio boundaries only. Never drop a curated moment, trim out its verified landing quote, start mid-phrase, or continue beyond the approved ending. Keep chronological, word-safe cuts and the approved total length.'
      : shortStory
      ? 'Refine the curated story without re-expanding it. Preserve the source-verified payoff and naturally complete ending chosen by Story Finisher when present. Do not remove the payoff, carry on into another topic, or extend outside curated footage. Protect precise phonemes and breaths; stay near the target duration.'
      : 'Refine whole-thought boundaries inside chosen footage; never select outside.',
    })
  } catch (error) {
    await specialistEvent(ctx, budget, 'dialogue', 'fallback_to_footage', {
      errorCode: String((error as Error)?.message ?? error).slice(0, 200),
      count: footage.length,
    })
    refined = { selections: footage }
  }
  let cutPlan = refined.selections as EditorialSelection[]
  // Dialogue can tighten joins, but must not silently erase the setup or payoff
  // that Footage already sourced. Prefer the fuller source-grounded selection
  // to an isolated excerpt when a requested short would otherwise collapse.
  const dialogueCoverage = shortStory
    ? shortStoryCoverage(cutPlan, ctx.cache.words, ctx.config.targetLengthS, source.rangeMs)
    : null
  const curatedCoverage = shortStory
    ? shortStoryCoverage(footage, ctx.cache.words, ctx.config.targetLengthS, source.rangeMs)
    : null
  if (shortStory && dialogueCoverage && curatedCoverage &&
      selectionDurationS(footage) <= maximumSeconds + 3 &&
      (selectionDurationS(cutPlan) < minimumSeconds * 0.8 && selectionDurationS(footage) > selectionDurationS(cutPlan) + 5 ||
       dialogueCoverage.localOnly && !curatedCoverage.localOnly ||
       !dialogueCoverage.terminalSentence && curatedCoverage.terminalSentence &&
         selectionDurationS(footage) >= selectionDurationS(cutPlan) * 0.8)) {
    await specialistEvent(ctx, budget, 'dialogue', 'restored_curated_story', {
      dialogueSeconds: selectionDurationS(cutPlan),
      restoredSeconds: selectionDurationS(footage),
      reason: 'dialogue_removed_required_story_or_duration',
    })
    cutPlan = footage
  }
  if (highlightsMode) {
    const approved = highlightsCoverage(footage, ctx.config.targetLengthS)
    const refinedCoverage = highlightsCoverage(cutPlan, ctx.config.targetLengthS)
    // Dialogue may refine boundaries but must not silently discard a distinct
    // highlight chosen by the scouting agent.
    if (approved.distinctMomentCount > refinedCoverage.distinctMomentCount ||
        (approved.durationSeconds >= minimumSeconds &&
         refinedCoverage.durationSeconds < minimumSeconds * 0.8)) {
      await specialistEvent(ctx, budget, 'dialogue', 'restored_curated_highlights', {
        approved, refined: refinedCoverage,
      })
      cutPlan = footage
    }
    const finalCoverage = highlightsCoverage(cutPlan, ctx.config.targetLengthS)
    if (finalCoverage.needsRevision) {
      await specialistEvent(ctx, budget, 'dialogue', 'highlights_best_effort', {
        ...finalCoverage, note: 'Preserve editable draft; highlight diversity or length remains below target.',
      })
    }
  }
  if (finisher) {
    const payoff = finisher.payoff
    const last = cutPlan[cutPlan.length - 1]
    const retained = cutPlan.some(s =>
      s.startMs <= payoff.startMs && s.endMs >= payoff.endMs)
    const endsSoonAfter = Boolean(last && last.endMs - payoff.endMs <= 8000 &&
      last.endMs >= payoff.endMs)
    if (!retained || !endsSoonAfter) {
      await specialistEvent(ctx, budget, 'dialogue', 'restored_story_finisher', {
        reason: retained ? 'dialogue_overran_verified_payoff' : 'dialogue_removed_verified_payoff',
      })
      cutPlan = footage
    }
  }
  if (highlightsFinisher) {
    // Dialogue may adjust word edges but cannot undo the Finisher's verified
    // per-highlight decisions or return to the original overlong passages.
    const originals = highlightsFinisher.moments
    const preserved = cutPlan.length === originals.length &&
      originals.every((m,i) => {
        const s = cutPlan[i]
        return Boolean(s && s.startMs >= m.selection.startMs &&
          s.endMs <= m.selection.endMs &&
          s.startMs <= m.landing.startMs &&
          s.endMs >= m.landing.endMs &&
          s.endMs - m.landing.endMs <= 4_000)
      })
    if (!preserved) {
      await specialistEvent(ctx, budget, 'dialogue', 'restored_finished_highlights', {
        reason: 'dialogue_removed_moment_or_landing_or_extended_approved_range',
        approvedCount: originals.length, dialogueCount: cutPlan.length,
      })
      cutPlan = footage
    }
  }
  // Recheck the ACTUAL post-Dialogue result before handing it to assembly.
  // A clean Finisher proposal can be ruined by a later model's boundary edits.
  // Restore the verified Finisher plan instead of silently publishing a
  // syntactically legal but mid-thought cut.
  if (finisher || highlightsFinisher) {
    const { verifyFinishedThoughts } = await import('@/lib/ai-producer-agent/story-finisher')
    try {
      verifyFinishedThoughts(cutPlan, ctx.cache.words ?? [])
    } catch (error) {
      await specialistEvent(ctx, budget, 'dialogue', 'restored_complete_sentences', {
        reason: String((error as Error)?.message ?? error).slice(0, 200),
      })
      cutPlan = footage
    }
  }
  // A later Dialogue pass cannot silently undo word-aligned boundary decisions
  // to reach a runtime. Preserve the Story Finisher's scoped cut boundaries,
  // even when Dialogue proposes alternate cuts. Length remains advisory.
  if (shortStory && wordBoundaryReviewed &&
      (cutPlan.length !== footage.length || cutPlan.some((s,i) =>
        s.startMs !== footage[i]!.startMs || s.endMs !== footage[i]!.endMs))) {
    await specialistEvent(ctx, budget, 'dialogue', 'preserved_word_boundary_story', {
      dialogueSeconds: selectionDurationS(cutPlan),
      finishedSeconds: selectionDurationS(footage),
      reason: 'dialogue_cannot_override_word_boundary_story_to_satisfy_duration',
    })
    cutPlan = footage
  }
  const duration = selectionDurationS(cutPlan)
  const [lo, hi] = ctx.config.targetLengthS
  if (duration < lo || duration > hi) {
    if (shortStory && duration < lo * 0.8) {
      await specialistEvent(ctx, budget, 'dialogue', 'story_incomplete_best_effort', {
        actualSeconds: duration, minimumSeconds: lo, cuts: cutPlan.length,
        note: 'Source-grounded editable draft preserved; target not achieved.',
      })
    }
    await specialistEvent(ctx, budget, 'dialogue', 'handoff_duration_advisory', {
      actualSeconds: duration, minimumSeconds: lo, maximumSeconds: hi,
      note: 'Deliver the best coherent editable cut even when shorter or longer than requested.',
    })
  }
  return { outline, footage, cutPlan, ...(finisher ? { finisher } : {}), ...(highlightsFinisher ? { highlightsFinisher } : {}) }
}
