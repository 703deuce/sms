/** Pure helpers for suggestion-first Clean Take review and restore.
 * Frontend only. Does not change Mode 2 assembly or backend export defaults. */

import type { ClipEditsV2, CutRange } from '../edits'
import { displayDurationMs, mergeCutRanges, subtractRangeFromCuts } from '../edits'
import type { CleanupProposal, CleanupCutKind } from './cleanup-proposals'
import { proposalId, restoreCleanupProposal } from './cleanup-proposals'
import { CLEAN_TAKE_DEFAULT_STRENGTH, DEFAULT_CLEANUP_STRENGTH, OPT_IN_FILLER_WORDS, type CleanupStrength } from './cleanup-strength'
import type { ClipInsert } from './inserts'

export { CLEAN_TAKE_DEFAULT_STRENGTH }

/** Show cuts is on by default in Clean Take review and Cleanup review after a pass. */
export const CLEAN_TAKE_SHOW_CUTS_DEFAULT = true

/**
 * Edge padding applied to each side of a play-removed-only cue, in milliseconds.
 * Pads short omissions instead of skipping them, and gives assembled preview a little context.
 */
export const PLAY_REMOVED_ONLY_EDGE_PAD_MS = 120

/** Cues shorter than this are padded (never silently skipped) and marked in the preview. */
export const PLAY_REMOVED_ONLY_SHORT_CUE_MS = 200

export const CLEAN_TAKE_OMISSION_TYPES = ['filler', 'silence', 'retake', 'manual'] as const

/** The Clean Take experiment page always sends this. Backend still defaults omitted values to true — see issue handoff. */
export const CLEAN_TAKE_EXPORT_ON_FINISH_DEFAULT = false

/** Filler and retake lexicons are English-only today. */
export const CLEAN_TAKE_FILLER_LANGUAGE = 'en' as const

export const CLEAN_TAKE_MIN_OMISSION_MS = 250

export const CLEAN_TAKE_COPY = {
  eyebrow: 'AI Producer · Clean Take',
  title: 'Clean Take',
  subhead:
    'Get a conservative first-pass cleanup to review. Nothing is exported until you approve the cut list.',
  directionLabel: 'Optional keep/drop notes',
  directionPlaceholder:
    'Optional: what should be kept, who it is for, or which retakes to prioritize. Leave blank for a conservative first pass you can review.',
  cta: 'Propose a first-pass cleanup to review',
  ctaStarting: 'Starting…',
  languageNote:
    'Filler and retake detection is currently English-only. Other languages are marked unsupported or UNKNOWN until measured.',
  reviewTitle: 'Review first pass',
  reviewBody:
    'This is a suggested cut, not a finished unsupervised video. Restore any omission, then approve before export. Review, reject, and restore do not use extra credits.',
  exportCta: 'Approve and export',
} as const

export type CleanTakeKeptCut = {
  sourceId: string
  sourceProjectId?: string
  startMs: number
  endMs: number
  reason?: string
  kind?: string
}

export type CleanTakeSourceExtent = {
  sourceId: string
  sourceProjectId?: string
  startMs: number
  endMs: number
  title?: string
}

export type CleanTakeOmissionType = 'filler' | 'silence' | 'retake' | 'manual'

export type CleanTakeOmission = {
  id: string
  sourceId: string
  sourceProjectId?: string
  startMs: number
  endMs: number
  type: CleanTakeOmissionType
  reason: string
  accepted?: boolean
}

export type LockedRange = {
  id: string
  label: string
  startMs: number
  endMs: number
  sourceId?: string
}

export type CleanTakeRunSource = {
  projectId: string
  title?: string
}

export type CleanTakeRunBody = {
  storyMode: 'clean_take_v1'
  outputType: 'story'
  genre: 'irl_just_chatting'
  platform: 'tiktok'
  music: 'none'
  memeSfx: 'off'
  exportOnFinish: boolean
  instruction?: string
  sources: Array<{
    sourceId: string
    kind: 'upload'
    projectId: string
    title?: string
  }>
  /** Additive; today's runs POST schema strips unknown keys until Backend adds the field. */
  lockedRanges?: LockedRange[]
  /** Clean Take first-pass default is `'light'`. Sent explicitly; the planner may still ignore it until Backend honors it. */
  fillerStrength: CleanupStrength
}

export function buildCleanTakeRunBody(input: {
  sources: CleanTakeRunSource[]
  instruction?: string
  exportOnFinish?: boolean
  lockedRanges?: LockedRange[]
  fillerStrength?: CleanupStrength
}): CleanTakeRunBody {
  const instruction = input.instruction?.trim()
  const lockedRanges = (input.lockedRanges ?? []).filter((row) => row.endMs > row.startMs)
  return {
    storyMode: 'clean_take_v1',
    outputType: 'story',
    genre: 'irl_just_chatting',
    platform: 'tiktok',
    music: 'none',
    memeSfx: 'off',
    exportOnFinish: input.exportOnFinish ?? CLEAN_TAKE_EXPORT_ON_FINISH_DEFAULT,
    fillerStrength: input.fillerStrength ?? CLEAN_TAKE_DEFAULT_STRENGTH,
    ...(instruction ? { instruction } : {}),
    sources: input.sources.map((source, index) => ({
      sourceId: `source_${index}`,
      kind: 'upload' as const,
      projectId: source.projectId,
      title: source.title,
    })),
    ...(lockedRanges.length ? { lockedRanges } : {}),
  }
}

export function omitRestoredOmissions(
  omissions: CleanTakeOmission[],
  restoredIds: Iterable<string>,
): CleanTakeOmission[] {
  const skip = new Set(restoredIds)
  return omissions.filter((row) => !skip.has(row.id))
}

export type PlayRemovedOnlyCue = {
  id: string
  startSec: number
  endSec: number
  paddedShort: boolean
}

export type PlayRemovedOnlySegment = {
  id: string
  sourceId: string
  /** Source-timeline in/out after edge padding, used to pull frames from that source. */
  inMs: number
  outMs: number
  /** Assembled preview timeline (concatenated, including padding). */
  outputStartMs: number
  outputEndMs: number
  originalStartMs: number
  originalEndMs: number
  /** True when the original omission was shorter than PLAY_REMOVED_ONLY_SHORT_CUE_MS and was padded rather than skipped. */
  paddedShort: boolean
}

export function padRemovedRange(
  startMs: number,
  endMs: number,
  extentStartMs: number,
  extentEndMs: number,
  padMs: number = PLAY_REMOVED_ONLY_EDGE_PAD_MS,
): { inMs: number; outMs: number; paddedShort: boolean } {
  const original = Math.max(0, endMs - startMs)
  const inMs = Math.max(extentStartMs, startMs - padMs)
  const outMs = Math.min(extentEndMs, Math.max(endMs, inMs + 1) + padMs)
  return {
    inMs,
    outMs: Math.max(outMs, inMs + 1),
    paddedShort: original < PLAY_REMOVED_ONLY_SHORT_CUE_MS,
  }
}

/**
 * Assembled play-removed-only segments in output order.
 * Multi-source omissions stay on their own sourceId. Short cues are padded, never dropped.
 */
export function playRemovedOnlySegments(
  omissions: CleanTakeOmission[],
  extents: CleanTakeSourceExtent[] = [],
  padMs: number = PLAY_REMOVED_ONLY_EDGE_PAD_MS,
): PlayRemovedOnlySegment[] {
  const extentById = new Map(extents.map((row) => [row.sourceId, row]))
  const out: PlayRemovedOnlySegment[] = []
  let cursor = 0
  for (const row of omissions) {
    const extent = extentById.get(row.sourceId)
    const extentStart = extent?.startMs ?? Math.min(row.startMs, 0)
    const extentEnd = extent?.endMs ?? Math.max(row.endMs, row.startMs + 1)
    const padded = padRemovedRange(row.startMs, row.endMs, extentStart, extentEnd, padMs)
    const dur = padded.outMs - padded.inMs
    out.push({
      id: row.id,
      sourceId: row.sourceId,
      inMs: padded.inMs,
      outMs: padded.outMs,
      outputStartMs: cursor,
      outputEndMs: cursor + dur,
      originalStartMs: row.startMs,
      originalEndMs: row.endMs,
      paddedShort: padded.paddedShort,
    })
    cursor += dur
  }
  return out
}

/** @deprecated Prefer playRemovedOnlySegments (assembled preview). Kept for clock conversions in tests. */
export function playRemovedOnlyCues(omissions: CleanTakeOmission[], extents: CleanTakeSourceExtent[] = []): PlayRemovedOnlyCue[] {
  return playRemovedOnlySegments(omissions, extents).map((row) => ({
    id: row.id,
    startSec: row.inMs / 1000,
    endSec: row.outMs / 1000,
    paddedShort: row.paddedShort,
  }))
}

export function lightStrengthExcludesOptInFillers(): boolean {
  return OPT_IN_FILLER_WORDS.length > 0 && CLEAN_TAKE_DEFAULT_STRENGTH === 'light'
}

function loHi(range: CutRange): CutRange {
  const lo = Math.min(range[0], range[1])
  const hi = Math.max(range[0], range[1])
  return [lo, hi]
}

export function rangesOverlapMs(a: CutRange, b: CutRange): boolean {
  const [loA, hiA] = loHi(a)
  const [loB, hiB] = loHi(b)
  return hiA > loB && hiB > loA
}

export function overlapsAnyLockedRange(
  range: CutRange,
  locked: LockedRange[] | CutRange[] | undefined,
  sourceId?: string,
): boolean {
  if (!locked?.length) return false
  return locked.some((item) => {
    if (!Array.isArray(item) && item.sourceId && sourceId && item.sourceId !== sourceId) return false
    const other: CutRange = Array.isArray(item) ? item : [item.startMs, item.endMs]
    return rangesOverlapMs(range, other)
  })
}

export function introOutroLockedRanges(
  startMs: number,
  endMs: number,
  introMs: number,
  outroMs: number,
  sourceId?: string,
): LockedRange[] {
  const out: LockedRange[] = []
  const span = Math.max(0, endMs - startMs)
  if (introMs > 0 && span > 0) {
    const hi = Math.min(endMs, startMs + introMs)
    if (hi - startMs >= 1) {
      out.push({
        id: 'lock-intro',
        label: 'Intro',
        startMs,
        endMs: hi,
        sourceId,
      })
    }
  }
  if (outroMs > 0 && span > 0) {
    const lo = Math.max(startMs, endMs - outroMs)
    if (endMs - lo >= 1) {
      out.push({
        id: 'lock-outro',
        label: 'Outro',
        startMs: lo,
        endMs,
        sourceId,
      })
    }
  }
  return out
}

export function parseCleanTakeCuts(raw: unknown): CleanTakeKeptCut[] {
  if (!raw || typeof raw !== 'object') return []
  const record = raw as Record<string, unknown>
  const bag = record.cleanTake && typeof record.cleanTake === 'object'
    ? (record.cleanTake as Record<string, unknown>)
    : record
  const cuts = bag.cuts
  if (!Array.isArray(cuts)) return []
  const out: CleanTakeKeptCut[] = []
  for (const item of cuts) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const startMs = Number(row.startMs)
    const endMs = Number(row.endMs)
    const sourceId = String(row.sourceId ?? '').trim()
    if (!sourceId || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue
    out.push({
      sourceId,
      sourceProjectId: typeof row.sourceProjectId === 'string' ? row.sourceProjectId : undefined,
      startMs: Math.round(startMs),
      endMs: Math.round(endMs),
      reason: typeof row.reason === 'string' ? row.reason : undefined,
      kind: typeof row.kind === 'string' ? row.kind : undefined,
    })
  }
  return out
}

export function parseCleanTakeMeta(payload: unknown): {
  cuts: CleanTakeKeptCut[]
  durationMs?: number
  title?: string
} | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as Record<string, unknown>
  const fromClip =
    root.clip && typeof root.clip === 'object'
      ? (root.clip as Record<string, unknown>).aiMeta
      : undefined
  const aiMeta = (root.aiMeta ?? fromClip) as Record<string, unknown> | undefined
  const source = aiMeta ?? root
  const cleanTake = source.cleanTake
  if (!cleanTake || typeof cleanTake !== 'object') return null
  const cuts = parseCleanTakeCuts(cleanTake)
  const meta = cleanTake as Record<string, unknown>
  const outline = meta.outline && typeof meta.outline === 'object' ? (meta.outline as Record<string, unknown>) : null
  return {
    cuts,
    durationMs: Number.isFinite(Number(meta.durationMs)) ? Number(meta.durationMs) : undefined,
    title: typeof outline?.title === 'string' ? outline.title : undefined,
  }
}

function mergeAdjacent(ranges: CutRange[]): CutRange[] {
  return mergeCutRanges(ranges.map((r) => loHi(r)))
}

export function omittedRangesFromCleanTakeCuts(
  cuts: CleanTakeKeptCut[],
  sources: CleanTakeSourceExtent[],
  minOmissionMs = CLEAN_TAKE_MIN_OMISSION_MS,
): CleanTakeOmission[] {
  const out: CleanTakeOmission[] = []
  for (const source of sources) {
    const kept = cuts
      .filter((cut) => cut.sourceId === source.sourceId || (source.sourceProjectId && cut.sourceProjectId === source.sourceProjectId))
      .map((cut) => loHi([cut.startMs, cut.endMs]))
      .sort((a, b) => a[0] - b[0])
    const merged = mergeAdjacent(kept)
    let cursor = source.startMs
    const emit = (startMs: number, endMs: number, betweenKept: boolean, position: 'lead' | 'mid' | 'tail') => {
      if (endMs - startMs < minOmissionMs) return
      const id = `${source.sourceId}:${startMs}:${endMs}`
      const type = classifyOmissionType({ startMs, endMs, betweenKept, position })
      out.push({
        id,
        sourceId: source.sourceId,
        sourceProjectId: source.sourceProjectId,
        startMs,
        endMs,
        type,
        reason: reasonForOmissionType(type, position),
        accepted: false,
      })
    }
    for (const [start, end] of merged) {
      if (start > cursor) {
        const isLead = cursor <= source.startMs
        emit(cursor, start, !isLead, isLead ? 'lead' : 'mid')
      }
      cursor = Math.max(cursor, end)
    }
    if (source.endMs > cursor) {
      emit(cursor, source.endMs, false, 'tail')
    }
  }
  return out
}

export function omissionToCleanupProposal(omission: CleanTakeOmission): CleanupProposal {
  const kind: CleanupCutKind =
    omission.type === 'retake'
      ? 'retake'
      : omission.type === 'filler'
        ? 'filler'
        : omission.type === 'silence'
          ? 'gap'
          : 'manual'
  return {
    id: omission.id,
    kind,
    range: [omission.startMs, omission.endMs],
    label: `${omission.type} · ${omission.reason}`,
  }
}

export function invertRangesWithin(trim: CutRange, keep: CutRange[]): CutRange[] {
  const [lo, hi] = loHi(trim)
  const kept = mergeAdjacent(keep.map(loHi).filter(([a, b]) => b > lo && a < hi).map(([a, b]) => [Math.max(lo, a), Math.min(hi, b)]))
  const cuts: CutRange[] = []
  let cursor = lo
  for (const [start, end] of kept) {
    if (start > cursor) cuts.push([cursor, start])
    cursor = Math.max(cursor, end)
  }
  if (hi > cursor) cuts.push([cursor, hi])
  return cuts
}

/** Build an audition edit that plays only the given removed ranges on a single-source cut list.
 * Each range is expanded by PLAY_REMOVED_ONLY_EDGE_PAD_MS on both sides (clamped to the trim).
 * Short ranges are padded, never omitted.
 */
export function playRemovedOnlyEdits(
  edits: ClipEditsV2,
  removedRanges: CutRange[],
  padMs: number = PLAY_REMOVED_ONLY_EDGE_PAD_MS,
): ClipEditsV2 {
  const trim: CutRange = [edits.trim.in, edits.trim.out]
  const padded = removedRanges.map((range) => {
    const lo = Math.min(range[0], range[1])
    const hi = Math.max(range[0], range[1])
    const next = padRemovedRange(lo, hi, trim[0], trim[1], padMs)
    return [next.inMs, next.outMs] as CutRange
  })
  const cuts = invertRangesWithin(trim, padded)
  return {
    ...edits,
    cutRanges: cuts,
    // Single-source flip: drop assembled inserts so the preview is the inverted main-source cuts.
    inserts: undefined,
  }
}

export function findEditSourceIdForOmission(
  edits: ClipEditsV2,
  omission: CleanTakeOmission,
  keptCuts: CleanTakeKeptCut[] = [],
): string | null {
  const sources = edits.sources ?? []
  if (!sources.length) {
    return null
  }
  const byExact = sources.find((source) => source.id === omission.sourceId)
  if (byExact) return byExact.id
  const cutIndex = keptCuts.findIndex(
    (cut) =>
      cut.sourceId === omission.sourceId ||
      (omission.sourceProjectId && cut.sourceProjectId === omission.sourceProjectId),
  )
  if (cutIndex >= 0 && sources[cutIndex]) return sources[cutIndex]!.id
  if (sources.length === 1) return sources[0]!.id
  return null
}

function firstKeptFromEdits(
  edits: ClipEditsV2,
  keptCuts: CleanTakeKeptCut[],
): { sourceId: string; startMs: number; endMs: number } | null {
  if (keptCuts[0]) {
    return { sourceId: keptCuts[0].sourceId, startMs: keptCuts[0].startMs, endMs: keptCuts[0].endMs }
  }
  return {
    sourceId: edits.sources?.[0]?.id ?? '',
    startMs: edits.trim.in,
    endMs: edits.trim.out,
  }
}

/**
 * Re-insert an omitted source range into the assembled Clean Take sequence.
 * Same-source material before the main trim expands the trim (and cuts the hole).
 * Later material is spliced as an E5b append insert, reusing existing media sources.
 * Failure returns the original edits unchanged.
 */
export function restoreCleanTakeOmission(
  edits: ClipEditsV2,
  omission: CleanTakeOmission,
  keptCuts: CleanTakeKeptCut[] = [],
): { ok: true; edits: ClipEditsV2 } | { ok: false; error: string; edits: ClipEditsV2 } {
  const duration = omission.endMs - omission.startMs
  if (duration < 200) {
    return { ok: false, error: 'omission_too_short', edits }
  }
  const first = firstKeptFromEdits(edits, keptCuts)
  const sameAsMain =
    first &&
    (omission.sourceId === first.sourceId ||
      (!!omission.sourceProjectId && keptCuts[0]?.sourceProjectId === omission.sourceProjectId) ||
      ((edits.sources?.length ?? 0) === 1 && !edits.inserts?.length))

  if (sameAsMain && omission.endMs <= edits.trim.in) {
    const hole: CutRange = [omission.endMs, edits.trim.in]
    const nextCuts =
      hole[1] > hole[0] ? mergeCutRanges([...(edits.cutRanges ?? []), hole]) : (edits.cutRanges ?? [])
    return {
      ok: true,
      edits: {
        ...edits,
        trim: { ...edits.trim, in: omission.startMs },
        cutRanges: nextCuts,
      },
    }
  }

  if (sameAsMain && omission.startMs >= edits.trim.out) {
    // If there are no later inserts, extend the main trim and cut the gap.
    const laterInserts = (edits.inserts ?? []).filter((row) => !row.append || true)
    if (!laterInserts.length) {
      const hole: CutRange = [edits.trim.out, omission.startMs]
      const nextCuts =
        hole[1] > hole[0] ? mergeCutRanges([...(edits.cutRanges ?? []), hole]) : (edits.cutRanges ?? [])
      return {
        ok: true,
        edits: {
          ...edits,
          trim: { ...edits.trim, out: omission.endMs },
          cutRanges: nextCuts,
        },
      }
    }
  }

  if (sameAsMain && omission.startMs >= edits.trim.in && omission.endMs <= edits.trim.out) {
    // Omission was represented as a cut on the main clip — use the existing restore helper.
    return { ok: true, edits: restoreCleanupProposal(edits, [omission.startMs, omission.endMs]) }
  }

  const sourceId = findEditSourceIdForOmission(edits, omission, keptCuts)
  if (!sourceId) {
    return { ok: false, error: 'source_media_not_on_output', edits }
  }

  const insert: ClipInsert = {
    id: `restore_${omission.id.replace(/[^A-Za-z0-9_:.~-]/g, '_').slice(0, 80)}`,
    sourceId,
    atSrcMs: edits.trim.out,
    append: true,
    inMs: omission.startMs,
    durMs: duration,
    audio: 'source',
    fit: 'contain',
  }

  const inserts = spliceAppendInsert(edits.inserts, insert, omission, keptCuts, edits)
  return { ok: true, edits: { ...edits, inserts } }
}

function spliceAppendInsert(
  existing: ClipInsert[] | undefined,
  insert: ClipInsert,
  omission: CleanTakeOmission,
  keptCuts: CleanTakeKeptCut[],
  edits: ClipEditsV2,
): ClipInsert[] {
  const current = (existing ?? []).filter((row) => row.id !== insert.id)
  // Play order: main trim, then append inserts in array order (Mode 2 convention).
  type Piece = { kind: 'main' | 'insert'; index: number; startMs: number; endMs: number; sourceId: string }
  const pieces: Piece[] = [
    { kind: 'main', index: -1, startMs: edits.trim.in, endMs: edits.trim.out, sourceId: keptCuts[0]?.sourceId ?? edits.sources?.[0]?.id ?? '' },
  ]
  current.forEach((row, index) => {
    pieces.push({ kind: 'insert', index, startMs: row.inMs, endMs: row.inMs + row.durMs, sourceId: row.sourceId })
  })
  const preceding = [...pieces]
    .reverse()
    .find((piece) => piece.sourceId === insert.sourceId && piece.endMs <= omission.startMs)
    ?? [...pieces].reverse().find((piece) => piece.endMs <= omission.startMs)
  if (!preceding || preceding.kind === 'main') {
    return [insert, ...current].slice(0, 50)
  }
  const next = [...current]
  next.splice(preceding.index + 1, 0, insert)
  return next.slice(0, 50)
}

/** Play-removed-only for assembled Clean Take: mute the kept main take and append only omissions.
 * Uses the assembled preview (inserts on each omission's source), not a single source-clock media URL.
 * Short cues are padded by PLAY_REMOVED_ONLY_EDGE_PAD_MS, never skipped.
 */
export function playRemovedOnlyFromOmissions(
  edits: ClipEditsV2,
  omissions: CleanTakeOmission[],
  keptCuts: CleanTakeKeptCut[] = [],
  extents: CleanTakeSourceExtent[] = [],
  padMs: number = PLAY_REMOVED_ONLY_EDGE_PAD_MS,
): ClipEditsV2 {
  const inserts: ClipInsert[] = []
  const extentById = new Map(extents.map((row) => [row.sourceId, row]))
  for (const [index, omission] of omissions.entries()) {
    const sourceId = findEditSourceIdForOmission(edits, omission, keptCuts)
    if (!sourceId) continue
    const extent = extentById.get(omission.sourceId)
    const source = (edits.sources ?? []).find((row) => row.id === sourceId)
    const extentStart = extent?.startMs ?? 0
    const extentEnd = extent?.endMs ?? source?.durationMs ?? Math.max(omission.endMs + padMs, omission.startMs + 1)
    const padded = padRemovedRange(omission.startMs, omission.endMs, extentStart, extentEnd, padMs)
    inserts.push({
      id: `removed_only_${index}`,
      sourceId,
      atSrcMs: edits.trim.out,
      append: true,
      inMs: padded.inMs,
      durMs: padded.outMs - padded.inMs,
      audio: 'source',
      fit: 'contain',
    })
  }
  return {
    ...edits,
    cutRanges: mergeCutRanges([...(edits.cutRanges ?? []), [edits.trim.in, edits.trim.out]]),
    inserts,
  }
}

export function durationAfterRestore(edits: ClipEditsV2): number {
  return displayDurationMs(edits)
}

export function subtractCutRange(edits: ClipEditsV2, range: CutRange): ClipEditsV2 {
  return { ...edits, cutRanges: subtractRangeFromCuts(edits.cutRanges ?? [], range) }
}

export function omissionsOverlappingLocked(
  omissions: CleanTakeOmission[],
  locked: LockedRange[],
): CleanTakeOmission[] {
  return omissions.filter((item) => overlapsAnyLockedRange([item.startMs, item.endMs], locked, item.sourceId))
}

export { proposalId }

export function isCleanTakeAiMeta(aiMeta: unknown): boolean {
  if (!aiMeta || typeof aiMeta !== 'object') return false
  const cleanTake = (aiMeta as Record<string, unknown>).cleanTake
  return Boolean(cleanTake && typeof cleanTake === 'object')
}

export function normalizeOmissionType(raw: unknown): CleanTakeOmissionType | null {
  if (raw === 'filler' || raw === 'repeat') return 'filler'
  if (raw === 'silence' || raw === 'gap' || raw === 'pause') return 'silence'
  if (raw === 'retake') return 'retake'
  if (raw === 'manual' || raw === 'chatter' || raw === 'omission') return 'manual'
  return null
}

export function classifyOmissionType(input: {
  startMs: number
  endMs: number
  betweenKept?: boolean
  position?: 'lead' | 'mid' | 'tail'
  hintedType?: unknown
}): CleanTakeOmissionType {
  const hinted = normalizeOmissionType(input.hintedType)
  if (hinted) return hinted
  if (input.betweenKept || input.position === 'mid') return 'retake'
  const duration = input.endMs - input.startMs
  if (duration > 0 && duration < 800) return 'filler'
  if (duration >= 1000 && duration <= 5000) return 'silence'
  return 'manual'
}

export function reasonForOmissionType(type: CleanTakeOmissionType, position: 'lead' | 'mid' | 'tail' | 'unknown' = 'unknown'): string {
  if (type === 'filler') return 'Short filler-like omission (um/uh-style window)'
  if (type === 'silence') return 'Silence or pause omitted from the first pass'
  if (type === 'retake') return 'Earlier take or mid-passage omitted from the first pass'
  if (position === 'lead') return 'Opening material omitted from the first pass'
  if (position === 'tail') return 'Ending material omitted from the first pass'
  return 'Omitted from the first pass'
}

export type CleanTakeReviewState = {
  v: 1
  omissions: CleanTakeOmission[]
}

type ClipEditsWithCleanTakeReview = ClipEditsV2 & { cleanTakeReview?: CleanTakeReviewState }

/** Persist remaining review omissions on the saved edits (survives normalizeEdits via object spread). */
export function writeCleanTakeReview(edits: ClipEditsV2, omissions: CleanTakeOmission[]): ClipEditsV2 {
  const next: ClipEditsWithCleanTakeReview = { ...edits, cleanTakeReview: { v: 1, omissions } }
  return next
}

export function readCleanTakeReview(edits: ClipEditsV2): CleanTakeReviewState | null {
  const raw = (edits as ClipEditsWithCleanTakeReview).cleanTakeReview
  if (!raw || raw.v !== 1 || !Array.isArray(raw.omissions)) return null
  const omissions: CleanTakeOmission[] = []
  for (const row of raw.omissions) {
    if (!row || typeof row !== 'object') continue
    const startMs = Number(row.startMs)
    const endMs = Number(row.endMs)
    const sourceId = String(row.sourceId ?? '').trim()
    const type = normalizeOmissionType(row.type) ?? 'manual'
    if (!sourceId || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue
    omissions.push({
      id: typeof row.id === 'string' && row.id ? row.id : `${sourceId}:${startMs}:${endMs}`,
      sourceId,
      sourceProjectId: typeof row.sourceProjectId === 'string' ? row.sourceProjectId : undefined,
      startMs: Math.round(startMs),
      endMs: Math.round(endMs),
      type,
      reason: typeof row.reason === 'string' && row.reason ? row.reason : reasonForOmissionType(type),
      accepted: row.accepted === true,
    })
  }
  return { v: 1, omissions }
}

export function sourceExtentsFromEdits(edits: ClipEditsV2): CleanTakeSourceExtent[] {
  return (edits.sources ?? []).map((source) => ({
    sourceId: source.id,
    startMs: 0,
    endMs: Math.max(1, Number(source.durationMs) || 0),
    title: source.label,
  }))
}

export function keptRangesFromEdits(edits: ClipEditsV2): Array<{ sourceId: string; startMs: number; endMs: number }> {
  const out: Array<{ sourceId: string; startMs: number; endMs: number }> = []
  const mainId = edits.sources?.[0]?.id
  if (mainId) {
    const holes = mergeAdjacent((edits.cutRanges ?? []).map((range) => loHi(range)))
    let cursor = edits.trim.in
    for (const [start, end] of holes) {
      if (start > cursor) out.push({ sourceId: mainId, startMs: cursor, endMs: start })
      cursor = Math.max(cursor, end)
    }
    if (edits.trim.out > cursor) out.push({ sourceId: mainId, startMs: cursor, endMs: edits.trim.out })
  }
  for (const insert of edits.inserts ?? []) {
    if (!insert.sourceId || !(insert.durMs > 0)) continue
    out.push({ sourceId: insert.sourceId, startMs: insert.inMs, endMs: insert.inMs + insert.durMs })
  }
  return out
}

export function omissionCoveredByEdits(edits: ClipEditsV2, omission: CleanTakeOmission, minCoverMs = 200): boolean {
  const sourceId = findEditSourceIdForOmission(edits, omission) ?? omission.sourceId
  let covered = 0
  for (const kept of keptRangesFromEdits(edits)) {
    if (kept.sourceId !== sourceId && kept.sourceId !== omission.sourceId) continue
    const lo = Math.max(kept.startMs, omission.startMs)
    const hi = Math.min(kept.endMs, omission.endMs)
    if (hi > lo) covered += hi - lo
  }
  const duration = omission.endMs - omission.startMs
  return duration > 0 && covered >= Math.min(duration, Math.max(minCoverMs, duration * 0.8))
}

/**
 * Rebuild the remaining omission list from the saved edits.
 * Prefer the persisted `cleanTakeReview` list (filtered by what is still missing).
 * Do not re-derive from aiMeta.cleanTake.cuts — restored takes stay gone after load().
 */
export function listOmissionsFromSavedEdits(
  edits: ClipEditsV2,
  extents?: CleanTakeSourceExtent[],
): CleanTakeOmission[] {
  const stored = readCleanTakeReview(edits)
  if (stored) {
    return stored.omissions.filter((row) => !omissionCoveredByEdits(edits, row))
  }
  const sourceExtents = (extents && extents.length ? extents : sourceExtentsFromEdits(edits)).filter((row) => row.endMs > row.startMs)
  const kept: CleanTakeKeptCut[] = keptRangesFromEdits(edits).map((row) => ({
    sourceId: row.sourceId,
    startMs: row.startMs,
    endMs: row.endMs,
  }))
  return omittedRangesFromCleanTakeCuts(kept, sourceExtents)
}

export function cleanupPanelDefaultStrength(defaultStrength?: CleanupStrength): CleanupStrength {
  return defaultStrength ?? DEFAULT_CLEANUP_STRENGTH
}
