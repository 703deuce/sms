import {
  defaultEdits,
  normalizeEdits,
  canonicalEditsJson,
  mergeCutRanges,
  sanitizeCutRangesForTrim,
  orderedKeepSegments,
  remapTime,
  normalizeVideoSplits,
  SECTION_ORDER_MAX_BLOCKS,
  type ClipBounds,
  type ClipEditsV2,
  type CutRange,
  type ClipWord,
} from '@/lib/clips/edits'
import { refineCutBoundary } from '@/lib/clips/cuts-quality/cut-boundary-refine'
import { proposalId } from '@/lib/clips/editor/cleanup-proposals'
import { setSplitEdit } from '@/lib/clips/editor/split-edits'
import {
  TRANSITION_DEFAULT_MS,
  type CutTransition,
  type TransitionType,
  type KeyframeTrack,
} from '@/lib/clips/editor/motion-schema'
import { DEFAULT_TEXT_STYLE, textPreset, type TextItem } from '@/lib/clips/editor/text-items'
import { setSegmentSpeed } from '@/lib/clips/editor/speed'
import { addFreezeFrame } from '@/lib/clips/editor/inserts'
import { createId } from '@/lib/supabase/id'

export type PlanSeg = {
  id: string
  sourceId: string
  srcInMs: number
  srcOutMs: number
  beat?: string
}

export type RmsFrames = (centerSrcMs: number) => { tMs: number; rms: number }[]

export const TRANSITION_MAP: Record<string, TransitionType | null> = {
  cut: null,
  whip: 'whip_pan',
  flash: 'dip_white',
  zoom: 'zoom_in',
  dissolve: 'crossfade',
  fade_black: 'dip_black',
}

function tileBlocks(
  ordered: PlanSeg[],
  chrono: PlanSeg[],
  trimIn: number,
  trimOut: number,
): CutRange[] | undefined {
  const blocks: CutRange[] = []
  for (let i = 0; i < ordered.length && blocks.length < SECTION_ORDER_MAX_BLOCKS; i++) {
    const seg = ordered[i]!
    const idx = chrono.findIndex((c) => c.id === seg.id)
    const next = idx >= 0 && idx < chrono.length - 1 ? chrono[idx + 1]!.srcInMs : trimOut
    const end = Math.min(Math.max(seg.srcOutMs, seg.srcInMs + 300), next, trimOut)
    const start = Math.max(seg.srcInMs, trimIn)
    if (end - start >= 300) blocks.push([start, end])
  }
  return blocks.length ? blocks : undefined
}

export function cutKey(range: CutRange): string {
  return proposalId(range)
}

export class DraftEditsBuilder {
  segs: PlanSeg[] = []
  private e: ClipEditsV2
  private userCuts: { r: CutRange; kind: 'gap' | 'filler' | 'manual' }[] = []
  private musicTouched = false
  /** Rough-cut specialist boundaries have already passed the shared word guard. */
  preserveApprovedEdges = false
  aspectRatio: ClipEditsV2['aspectRatio'] = '9:16'
  private legacyMode = false
  mainSourceId: string
  private words: ClipWord[]
  private rms: RmsFrames

  constructor(
    readonly bounds: ClipBounds,
    mainSourceId?: string,
    words: ClipWord[] = [],
    rms?: RmsFrames,
  ) {
    this.e = defaultEdits(bounds)
    if (!mainSourceId) {
      this.legacyMode = true
      this.mainSourceId = 'legacy'
      this.words = words
      this.rms = rms ?? (() => [])
      return
    }
    this.mainSourceId = mainSourceId
    this.words = words
    this.rms = rms ?? (() => [])
  }

  /** @deprecated legacy loop shim — prefer segment tools + snapshot(). */
  get edits(): ClipEditsV2 {
    return this.legacyMode ? this.e : this.snapshot()
  }

  applyPlan(plan: import('@/lib/ai-producer-agent/types').EditPlanJson): { warnings: string[] } {
    const warnings: string[] = []
    if (!plan.segments.length) {
      warnings.push('empty_plan')
      return { warnings }
    }
    if (this.legacyMode) {
      this.mainSourceId = plan.segments[0]?.sourceId ?? 'legacy'
      const idMap = new Map<string, string>()
      for (const seg of plan.segments) {
        const added = this.addSegment({
          sourceId: seg.sourceId,
          srcInMs: seg.srcInMs,
          srcOutMs: seg.srcOutMs,
          beat: seg.beat,
        })
        idMap.set(seg.id, added.id)
      }
      for (const c of plan.cutsInside ?? []) {
        this.cutRange(c.removeSrcMs[0], c.removeSrcMs[1], 'manual')
      }
      for (const t of plan.transitions ?? []) {
        const at = idMap.get(t.atSegment) ?? t.atSegment
        try {
          this.setTransition(at, t.type)
        } catch {
          warnings.push('bad_transition')
        }
      }
      this.e = this.snapshot()
      return { warnings }
    }
    warnings.push('applyPlan_not_supported')
    return { warnings }
  }

  addSegment(s: Omit<PlanSeg, 'id'>, atIndex?: number): PlanSeg {
    const seg: PlanSeg = { ...s, id: createId('seg') }
    if (atIndex == null || atIndex >= this.segs.length) this.segs.push(seg)
    else this.segs.splice(atIndex, 0, seg)
    this.recompose()
    return seg
  }

  trimSegment(id: string, srcInMs?: number, srcOutMs?: number) {
    const s = this.seg(id)
    if (srcInMs != null) s.srcInMs = srcInMs
    if (srcOutMs != null) s.srcOutMs = srcOutMs
    this.recompose()
  }

  reorder(order: string[]) {
    if (order.length !== this.segs.length || order.some((id) => !this.segs.find((s) => s.id === id))) {
      throw new Error('order must list every segment once')
    }
    this.segs = order.map((id) => this.seg(id))
    this.recompose()
  }

  split(atSrcMs: number) {
    this.e.videoSplits = normalizeVideoSplits(
      [...(this.e.videoSplits ?? []), atSrcMs],
      this.e.trim.in,
      this.e.trim.out,
    )
  }

  private recompose() {
    const main = this.segs.filter((s) => s.sourceId === this.mainSourceId)
    if (!main.length) return
    const chrono = [...main].sort((a, b) => a.srcInMs - b.srcInMs)
    const trimIn = chrono[0]!.srcInMs
    const trimOut = chrono[chrono.length - 1]!.srcOutMs
    const gaps: CutRange[] = []
    for (let i = 1; i < chrono.length; i++) {
      const g0 = chrono[i - 1]!.srcOutMs
      const g1 = chrono[i]!.srcInMs
      if (g1 > g0) gaps.push(this.preserveApprovedEdges ? [g0, g1] : this.refine([g0, g1], 'gap'))
    }
    const cuts = this.userCuts.map((c) => this.refine(c.r, c.kind))
    this.e.trim = { in: trimIn, out: trimOut }
    this.e.cutRanges = sanitizeCutRangesForTrim(mergeCutRanges([...gaps, ...cuts]), trimIn, trimOut)
    if (!this.e.cutRanges.length) {
      delete this.e.cutQualityMeta
      delete this.e.cutCleanupKinds
    }
    const natural = main.every((s, i) => s === chrono[i])
    this.e.sectionOrder = natural
      ? undefined
      : tileBlocks(main.slice(0, SECTION_ORDER_MAX_BLOCKS), chrono, trimIn, trimOut)
  }

  cutRange(srcInMs: number, srcOutMs: number, kind: 'gap' | 'filler' | 'manual') {
    this.userCuts.push({ r: [srcInMs, srcOutMs], kind })
    this.recompose()
  }

  private refine([a, b]: CutRange, kind: string): CutRange {
    if (!this.e.cutQualityMeta) this.e.cutQualityMeta = {}
    if (!this.e.cutCleanupKinds) this.e.cutCleanupKinds = {}
    const ms = this.words.map((w) => [Math.round(w.s * 1000), Math.round(w.e * 1000)] as const)
    const prevEndMs = ms.filter(([, e]) => e <= a).at(-1)?.[1] ?? null
    const nextStartMs = ms.find(([s]) => s >= b)?.[0] ?? null
    const { range, meta } = refineCutBoundary({
      neighbors: { prevEndMs, wordStartMs: a, wordEndMs: b, nextStartMs },
      frames: this.rms((a + b) / 2),
      reason: kind,
    })
    const key = cutKey(range)
    this.e.cutQualityMeta![key] = meta
    ;(this.e.cutCleanupKinds as Record<string, string>)[key] = kind === 'gap' || kind === 'filler' ? kind : 'manual'
    return range
  }

  setTransition(atSegment: string, type: string, durMs = TRANSITION_DEFAULT_MS) {
    const t = TRANSITION_MAP[type]
    if (t === undefined) throw new Error('bad transition ' + type)
    const seg = this.seg(atSegment)
    const list: CutTransition[] = (this.e.transitions ?? []).filter((x) => x.srcMs !== seg.srcInMs)
    if (t) list.push({ type: t, durMs, srcMs: seg.srcInMs })
    this.e.transitions = list
  }

  setSplitEdit(atSegment: string, audioOffsetMs: number) {
    this.e = setSplitEdit(this.e, this.seg(atSegment).srcInMs, audioOffsetMs)
  }

  addZoom(outInMs: number, outOutMs: number, scale: number, ease: 'snap' | 'smooth') {
    const others = (this.e.keyframes ?? []).filter((k) => !(k.target === 'video' && k.prop === 'scale'))
    const tr: KeyframeTrack =
      (this.e.keyframes ?? []).find((k) => k.target === 'video' && k.prop === 'scale') ?? {
        target: 'video',
        prop: 'scale',
        points: [],
      }
    const ramp = ease === 'snap' ? 1 : 250
    const ez = ease === 'snap' ? ('linear' as const) : ('inOut' as const)
    const scaleV = scale * 100
    tr.points = [
      ...tr.points,
      { tMs: outInMs, v: 100, ease: ez },
      { tMs: outInMs + ramp, v: scaleV, ease: ez },
      { tMs: Math.max(outInMs + ramp, outOutMs - ramp), v: scaleV, ease: ez },
      { tMs: outOutMs, v: 100 },
    ].sort((x, y) => x.tMs - y.tMs)
    this.e.keyframes = [...others, tr]
  }

  addText(text: string, outInMs: number, durMs: number, kind: 'hook' | 'label' | 'meme', presetId?: string) {
    const p = textPreset(presetId)
    const item: TextItem = {
      id: createId('txt'),
      text,
      startMs: outInMs,
      endMs: outInMs + durMs,
      x: 50,
      y: kind === 'hook' ? 18 : 75,
      style: p?.style ?? DEFAULT_TEXT_STYLE,
      presetId: p?.id,
    }
    this.e.textItems = [...(this.e.textItems ?? []), item]
  }

  setCaptions(c: Partial<NonNullable<ClipEditsV2['captions']>>) {
    this.e.captions = { ...this.e.captions!, ...c }
  }

  setLayout(mode: string, perSegment?: { outInMs: number; outOutMs: number; mode: string }[]) {
    this.e.layout = { ...this.e.layout!, mode: mode as never }
    if (perSegment?.length) {
      ;(this.e.layout as { layoutSegments?: unknown }).layoutSegments = perSegment
    }
  }

  setSpeed(srcInMs: number, srcOutMs: number, rate: number) {
    this.e.segmentSpeeds = setSegmentSpeed(this.e.segmentSpeeds, srcInMs, srcOutMs, rate)
    if (rate < 1) this.e.smoothSlowmo ??= 'blend'
  }

  setFreeze(atSrcMs: number, durMs: number) {
    const segs = orderedKeepSegments(this.e)
    const base = remapTime(atSrcMs, segs)
    if (base == null) throw new Error('freeze out of range')
    const next = addFreezeFrame(this.e.inserts, segs, base, createId('frz'), durMs)
    if (!next) throw new Error('max inserts')
    this.e.inserts = next
  }

  setLoudness(lufs: -14 | -16 | -18) {
    this.e.loudnessLufs = lufs
    this.e.speechLevelingEnabled = true
  }

  addMusic(_a: {
    assetId: string
    outInMs: number
    outOutMs?: number
    volumeDb: number
    fadeInMs?: number
    fadeOutMs?: number
  }) {
    this.musicTouched = true
    this.e.audio = {
      ...(this.e.audio ?? {}),
      musicAssetId: _a.assetId,
      musicVolumeDb: _a.volumeDb,
      duckUnderSpeech: true,
    } as ClipEditsV2['audio']
  }

  addSfx(a: { sfxId: string; outMs: number; volumeDb?: number }) {
    this.e.exportSfx = 'subtle'
  }

  snapshot(): ClipEditsV2 {
    const withAspect = { ...this.e, aspectRatio: this.aspectRatio ?? this.e.aspectRatio }
    const clone = structuredClone(withAspect) as ClipEditsV2
    if (!clone.audio?.musicAssetId) delete clone.audio
    if (!this.musicTouched) delete clone.audio
    return normalizeEdits(clone, this.bounds)
  }

  droppedFields(): string[] {
    const once = this.snapshot()
    const twice = normalizeEdits(JSON.parse(canonicalEditsJson(once)), this.bounds)
    if (canonicalEditsJson(once) === canonicalEditsJson(twice)) return []
    const a = JSON.parse(canonicalEditsJson(once)) as Record<string, unknown>
    const b = JSON.parse(canonicalEditsJson(twice)) as Record<string, unknown>
    return Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
  }

  private seg(id: string) {
    const s = this.segs.find((x) => x.id === id)
    if (!s) throw new Error('unknown segment ' + id)
    return s
  }
}
