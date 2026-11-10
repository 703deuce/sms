/** Pure helpers for suggestion-first Clean Take review and restore.
 * Frontend only. Does not change Mode 2 assembly or backend export defaults. */

import type { ClipEditsV2, CutRange } from '../edits'
import { displayDurationMs, mergeCutRanges, subtractRangeFromCuts } from '../edits'
import type { CleanupProposal, CleanupCutKind } from './cleanup-proposals'
import { proposalId, restoreCleanupProposal } from './cleanup-proposals'
import { CLEAN_TAKE_DEFAULT_STRENGTH, OPT_IN_FILLER_WORDS } from './cleanup-strength'
import type { ClipInsert } from './inserts'

export { CLEAN_TAKE_DEFAULT_STRENGTH }

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

export type CleanTakeOmissionType = 'silence' | 'filler' | 'retake' | 'chatter' | 'omission'

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
}

export function buildCleanTakeRunBody(input: {
  sources: CleanTakeRunSource[]
  instruction?: string
  exportOnFinish?: boolean
  lockedRanges?: LockedRange[]
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
}

/** Source-clock cues for a play-removed-only preview of every remaining omission. */
export function playRemovedOnlyCues(omissions: CleanTakeOmission[]): PlayRemovedOnlyCue[] {
  return omissions
    .filter((row) => row.endMs - row.startMs >= 200)
    .map((row) => ({
      id: row.id,
      startSec: row.startMs / 1000,
      endSec: row.endMs / 1000,
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

export function overlapsAnyLockedRange(range: CutRange, locked: LockedRange[] | CutRange[] | undefined): boolean {
  if (!locked?.length) return false
  return locked.some((item) => {
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
    const emit = (startMs: number, endMs: number, type: CleanTakeOmissionType, reason: string) => {
      if (endMs - startMs < minOmissionMs) return
      const id = `${source.sourceId}:${startMs}:${endMs}`
      out.push({
        id,
        sourceId: source.sourceId,
        sourceProjectId: source.sourceProjectId,
        startMs,
        endMs,
        type,
        reason,
        accepted: false,
      })
    }
    for (const [start, end] of merged) {
      if (start > cursor) {
        const isLead = cursor <= source.startMs
        const type: CleanTakeOmissionType = isLead ? 'omission' : 'retake'
        const reason = isLead
          ? 'Opening material omitted from the first pass'
          : 'Earlier take or mid-passage omitted from the first pass'
        emit(cursor, start, type, reason)
      }
      cursor = Math.max(cursor, end)
    }
    if (source.endMs > cursor) {
      emit(cursor, source.endMs, 'omission', 'Ending material omitted from the first pass')
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

/** Build an audition edit that plays only the given removed ranges on a single-source cut list. */
export function playRemovedOnlyEdits(edits: ClipEditsV2, removedRanges: CutRange[]): ClipEditsV2 {
  const trim: CutRange = [edits.trim.in, edits.trim.out]
  const cuts = invertRangesWithin(trim, removedRanges)
  return {
    ...edits,
    cutRanges: cuts,
    // Drop assembled inserts so the preview is only the inverted main-source cuts.
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

/** Play-removed-only for assembled Clean Take: mute the kept main take and append only omissions. */
export function playRemovedOnlyFromOmissions(
  edits: ClipEditsV2,
  omissions: CleanTakeOmission[],
  keptCuts: CleanTakeKeptCut[] = [],
): ClipEditsV2 {
  const inserts: ClipInsert[] = []
  for (const [index, omission] of omissions.entries()) {
    const sourceId = findEditSourceIdForOmission(edits, omission, keptCuts)
    if (!sourceId) continue
    const durMs = omission.endMs - omission.startMs
    if (durMs < 200) continue
    inserts.push({
      id: `removed_only_${index}`,
      sourceId,
      atSrcMs: edits.trim.out,
      append: true,
      inMs: omission.startMs,
      durMs,
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
  return omissions.filter((item) => overlapsAnyLockedRange([item.startMs, item.endMs], locked))
}

export { proposalId }
