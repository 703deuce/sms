import { createHash } from 'crypto'
import { normalizeAudioEdits, type ClipEditsAudio } from '@/lib/clips/audio'
import { normalizeBrollItems, type BrollItem } from '@/lib/clips/broll'
import type { ExportAspect } from '@/lib/clips/export-aspect'
import { clampTrimToExtendedBounds } from '@/lib/clips/trim-bounds'
import { clampZoomIntensity } from '@/lib/clips/zoom-keyframes'
import type { SilenceTrimSettings } from '@/lib/clips/silence-trim'
import { normalizeLayoutSegments, type LayoutSegment } from '@/lib/clips/layout-segments'
import { normalizeExportTemplate, type ClipExportTemplate } from '@/lib/clips/export-template'
import { isSpeechLevelingEnabled } from '@/lib/clips/speech-leveling'
import { normalizeFitBlurStrength, type FitBlurStrength } from '@/lib/clips/fit-blur'
import { normalizeTimelineLanes, type TimelineLanesState } from '@/lib/clips/editor/timeline-lane-state'
import {
  normalizeCutTransitions,
  normalizeKeyframeTracks,
  type CutTransition,
  type KeyframeTrack,
} from '@/lib/clips/editor/motion-schema'
import { hasColor, normalizeColorEdits, type ClipColorEdits } from '@/lib/clips/editor/color'
import { normalizeSegmentSpeeds, speedWarpPieces, warpedDurationMs, warpMs, type SegmentSpeed } from '@/lib/clips/editor/speed'
import { normalizeTextItems, type TextItem } from '@/lib/clips/editor/text-items'

export type CutRange = [number, number]

export type FacecamBox = { x: number; y: number; w: number; h: number }

export type ClipLayoutFacecam = {
  box?: FacecamBox
  gameplay?: FacecamBox | null
  split?: number
  position?: 'top' | 'bottom'
  pipCorner?: 'TL' | 'TR' | 'BL' | 'BR'
}

export type ClipEditsV2 = {
  v: 2
  trim: { in: number; out: number }
  cutRanges: CutRange[]
  wordFixes: Record<string, string>
  /** Stable source-time + original text for export parity when word indices differ. */
  wordFixMeta?: Record<string, WordFixMetaEntry>
  captions: {
    enabled?: boolean
    presetId?: string
    font?: string
    animation?: string
    size?: number
    position?: string
    case?: string
    wordsPerLine?: number
    colors?: { a?: string; b?: string }
    emphasis?: number[]
    keywordHighlight?: boolean
    autoEmojis?: boolean
    emojiByWord?: Record<string, string>
    progressBar?: {
      enabled?: boolean
      color?: string
      position?: 'top' | 'bottom'
      thickness?: number
    }
    presetConfig?: Record<string, unknown>
    customPresetId?: string
    /** Bottom safe margin % for burned captions (platform export presets). */
    marginVPct?: number
    /** Active-word emphasis independent of preset (default: legacy preset/animation). */
    activeStyle?: 'color' | 'highlight' | 'fill'
    highlightColor?: string
  }
  /** Optional hook title in the first ~2–3s (brand-styled). */
  hookOverlay?: {
    enabled?: boolean
    text?: string
    durationMs?: number
  }
  layout: {
    mode:
      | 'speaker_follow'
      | 'fit_blur'
      | 'fit_top'
      | 'full_frame'
      | 'center_crop'
      | 'subject_follow'
      | 'split'
      | 'fill'
      | 'fit'
      | 'grid3'
      | 'grid4'
      | 'dynamic'
      | 'auto'
      | 'screen_pip'
      | 'facecam_stack'
      | 'facecam_pip'
    shotOverrides: { i: number; focus: 'auto' | 'A' | 'B' | 'both' }[]
    layoutSegments?: LayoutSegment[]
    facecam?: ClipLayoutFacecam
    /** Normalized pan crop for Fill / speaker_follow (upload editor). */
    cropBox?: FacecamBox
    /** User chose layout in editor — skip auto IRL headline ↔ layout sync. */
    userPicked?: boolean
    /** E6: blurred-background strength for fit/blur fills (default strong; lib/clips/fit-blur.ts). */
    blurStrength?: FitBlurStrength
    template?: {
      id?: string
      auto?: boolean
      reason?: string
      lane?: 'gaming' | 'irl' | 'just_chatting' | 'podcast'
      boxes?: Partial<
        Record<'facecam' | 'action' | 'content' | 'person0' | 'person1' | 'person2' | 'person3', FacecamBox>
      >
      params?: { split?: number; pipCorner?: 'TL' | 'TR' | 'BL' | 'BR' }
      /** T6.7: auto pick per scene of aiMeta.signals.scenes (export renders each segment). */
      segments?: { startS: number; endS: number; id: string; lane?: string; scene: number }[]
      /** Source-timeline ms of the clip start the segment times are relative to. */
      segmentsBaseMs?: number
    }
  }
  broll?: BrollItem[]
  audio?: ClipEditsAudio
  thumbnailId?: string | null
  audioTrack?: string
  brand?: unknown
  zoom?: { enabled?: boolean; intensity?: number; facecamOnly?: boolean }
  silenceTrim?: SilenceTrimSettings
  /** Integrated loudness target (LUFS) for export loudnorm. */
  loudnessLufs?: -14 | -16 | -18 | -23 | -24
  /** Explicit opt-in for speech leveling (toggle); loudnessLufs alone is not enough. */
  speechLevelingEnabled?: boolean
  /** Source-ms blocks in output order (transcript rearrange). */
  sectionOrder?: CutRange[]
  /** Export playback speed (post-step); preview uses playbackRate. */
  speed?: 1.1 | 1.25 | 1.5
  /** Loop quiet room tone under EDL gap segments on export. */
  roomTone?: boolean
  /** Fingerprint of last auto-applied vocabulary (sha1 hex). */
  vocabApplied?: string
  /** Editor / export preview aspect (defaults to 9:16). */
  aspectRatio?: ExportAspect
  /** Export-only overlays (headline bar, badge, channel link) — not burned into preview.mp4. */
  exportTemplate?: ClipExportTemplate
  /** Bundled Kenney SFX on export render (off | subtle | meme). */
  exportSfx?: 'off' | 'subtle' | 'meme'
  /** Stream chat burn-in (VOD chat replay in lower blur band). */
  chatOverlay?: {
    enabled?: boolean
    position?: 'gameplay_right' | 'gameplay_left' | 'bottom'
    opacity?: number
  }
  /** Trim end for loop-friendly Shorts/TikTok (default on for those presets). */
  loopFriendlyEnd?: boolean
  layersV?: number
  layers?: unknown
  layersLegacyFp?: string
  /** E2 timeline lane toggles (mute / hide / lock); applied to preview + export. */
  timelineLanes?: TimelineLanesState
  /**
   * E2fix: Video-lane split points (SOURCE ms, sorted). A split only divides the Video lane into
   * separately selectable / deletable / trimmable segments; it never changes the render by itself
   * (the worker ignores it — deleting a half becomes a normal cut range).
   */
  videoSplits?: number[]
  /**
   * E3 keyframes. Local time per target: video / voice / text = output ms; broll:<id> = ms from the
   * item's startMs (anchored to its media via inMs); music = ms from the music window start.
   */
  keyframes?: KeyframeTrack[]
  /** E3 Video-lane cut transitions, keyed by the source start of the segment after the cut. */
  transitions?: CutTransition[]
  /** E4 text items on the Text lane (output ms; keyframe target `text:<id>`). */
  textItems?: TextItem[]
  /** E4 color looks (Adjust + Filters): whole video, per Video item (source range), per B-roll id. */
  color?: ClipColorEdits
  /** E4 per-item speed 0.25–4× over SOURCE ranges (pitch-preserved; export post-step warp). */
  segmentSpeeds?: SegmentSpeed[]
}

export type ClipBounds = {
  clipStartMs: number
  clipEndMs: number
  trimMinMs?: number
  trimMaxMs?: number
}

export type WordFixMetaEntry = { s: number; w: string }

export function defaultEdits(bounds: ClipBounds): ClipEditsV2 {
  return {
    v: 2,
    trim: { in: bounds.clipStartMs, out: bounds.clipEndMs },
    cutRanges: [],
    wordFixes: {},
    captions: {
      enabled: true,
      presetId: 'bold_pop',
      animation: 'pop',
      size: 6.5,
      position: 'bottom',
      case: 'sentence',
      wordsPerLine: 2,
    },
    layout: { mode: 'speaker_follow', shotOverrides: [] },
    silenceTrim: { enabled: false, minGapMs: 350, keepMs: 120, fillerTrim: true },
  }
}

/** Migrate legacy clip-relative trim/cuts to absolute source ms. */
function migrateLegacyEdits(raw: Record<string, unknown>, bounds: ClipBounds): Record<string, unknown> {
  const clipLen = bounds.clipEndMs - bounds.clipStartMs
  const trim = (raw.trim as { in?: number; out?: number }) || {}
  const tin = Number(trim.in ?? 0)
  const tout = Number(trim.out ?? clipLen)
  const looksRelative = tout <= clipLen + 500 && tin < bounds.clipEndMs - bounds.clipStartMs
  if (!looksRelative) return raw
  const cutRanges = (raw.cutRanges as CutRange[]) || []
  return {
    ...raw,
    trim: { in: bounds.clipStartMs + tin, out: bounds.clipStartMs + tout },
    cutRanges: cutRanges.map(([a, b]) => [bounds.clipStartMs + a, bounds.clipStartMs + b] as CutRange),
  }
}

const LAYOUT_MODES: ClipEditsV2['layout']['mode'][] = [
  'speaker_follow',
  'fit_blur',
  'fit_top',
  'full_frame',
  'center_crop',
  'subject_follow',
  'split',
  'fill',
  'fit',
  'grid3',
  'grid4',
  'dynamic',
  'auto',
  'screen_pip',
  'facecam_stack',
  'facecam_pip',
]

const EXPORT_ASPECTS: ExportAspect[] = ['9:16', '4:5', '1:1', '16:9']

function normalizeWordFixMeta(
  raw: unknown,
  fixes: Record<string, string>,
): Record<string, WordFixMetaEntry> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const out: Record<string, WordFixMetaEntry> = {}
  for (const [k, v] of Object.entries(o)) {
    if (!(k in fixes)) continue
    if (!v || typeof v !== 'object') continue
    const row = v as { s?: unknown; w?: unknown }
    const s = Number(row.s)
    const w = typeof row.w === 'string' ? row.w : fixes[k]
    if (!Number.isFinite(s) || !w) continue
    out[k] = { s: Math.round(s), w }
  }
  return Object.keys(out).length ? out : undefined
}

function normalizeCaptions(
  raw: unknown,
  base: ClipEditsV2['captions'],
): ClipEditsV2['captions'] {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const wpl = Number(o.wordsPerLine)
  const size = Number(o.size)
  return {
    ...base,
    enabled: o.enabled === undefined ? base.enabled : Boolean(o.enabled),
    wordsPerLine: Number.isFinite(wpl) && wpl > 0 ? Math.min(8, Math.round(wpl)) : base.wordsPerLine,
    size:
      Number.isFinite(size) && size >= 3
        ? Math.min(12, size)
        : size > 0 && size < 3
          ? base.size
          : base.size,
    position: typeof o.position === 'string' ? o.position : base.position,
    case: typeof o.case === 'string' ? o.case : base.case,
    presetId: typeof o.presetId === 'string' ? o.presetId : base.presetId,
    animation: typeof o.animation === 'string' ? o.animation : base.animation,
    colors: o.colors && typeof o.colors === 'object' ? (o.colors as ClipEditsV2['captions']['colors']) : base.colors,
    emphasis: Array.isArray(o.emphasis) ? (o.emphasis as number[]) : base.emphasis,
    keywordHighlight: o.keywordHighlight === undefined ? base.keywordHighlight : Boolean(o.keywordHighlight),
    autoEmojis: o.autoEmojis === undefined ? base.autoEmojis : Boolean(o.autoEmojis),
    emojiByWord:
      o.emojiByWord && typeof o.emojiByWord === 'object'
        ? (o.emojiByWord as Record<string, string>)
        : base.emojiByWord,
    progressBar:
      o.progressBar && typeof o.progressBar === 'object'
        ? (o.progressBar as ClipEditsV2['captions']['progressBar'])
        : base.progressBar,
    marginVPct:
      typeof o.marginVPct === 'number' && o.marginVPct >= 6 && o.marginVPct <= 28
        ? o.marginVPct
        : base.marginVPct,
    activeStyle:
      o.activeStyle === 'color' || o.activeStyle === 'highlight' || o.activeStyle === 'fill'
        ? o.activeStyle
        : base.activeStyle,
    highlightColor:
      typeof o.highlightColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.highlightColor)
        ? o.highlightColor
        : base.highlightColor,
    presetConfig:
      o.presetConfig && typeof o.presetConfig === 'object'
        ? (o.presetConfig as Record<string, unknown>)
        : base.presetConfig,
  }
}

function normalizeHookOverlay(raw: unknown): ClipEditsV2['hookOverlay'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const durationMs = Number(o.durationMs)
  return {
    enabled: Boolean(o.enabled),
    text: typeof o.text === 'string' ? o.text.slice(0, 120) : undefined,
    durationMs:
      Number.isFinite(durationMs) && durationMs >= 1500 && durationMs <= 5000
        ? Math.round(durationMs)
        : 2500,
  }
}

function normalizeNormBox(raw: unknown): FacecamBox | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const x = Number(r.x)
  const y = Number(r.y)
  const w = Number(r.w)
  const h = Number(r.h)
  if (![x, y, w, h].every(Number.isFinite)) return undefined
  return { x, y, w, h }
}

function normalizeLayoutTemplate(raw: unknown): ClipEditsV2['layout']['template'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id : undefined
  if (!id) return undefined
  const lane = o.lane
  const laneOk =
    lane === 'gaming' || lane === 'irl' || lane === 'just_chatting' || lane === 'podcast'
      ? lane
      : undefined
  const boxesRaw = o.boxes
  let boxes: NonNullable<ClipEditsV2['layout']['template']>['boxes']
  if (boxesRaw && typeof boxesRaw === 'object') {
    boxes = {}
    for (const [k, v] of Object.entries(boxesRaw as Record<string, unknown>)) {
      const b = normalizeNormBox(v)
      if (b) boxes[k as keyof typeof boxes] = b
    }
  }
  return {
    id,
    auto: o.auto === true ? true : o.auto === false ? false : undefined,
    reason: typeof o.reason === 'string' ? o.reason : undefined,
    lane: laneOk,
    boxes,
    params:
      o.params && typeof o.params === 'object'
        ? (o.params as { split?: number; pipCorner?: 'TL' | 'TR' | 'BL' | 'BR' })
        : undefined,
    segments: normalizeTemplateSegments(o.segments),
    segmentsBaseMs: Number.isFinite(Number(o.segmentsBaseMs)) ? Number(o.segmentsBaseMs) : undefined,
  }
}

/** T6.7: keep the worker's per-scene template segments through editor saves. */
function normalizeTemplateSegments(
  raw: unknown,
): NonNullable<ClipEditsV2['layout']['template']>['segments'] {
  if (!Array.isArray(raw)) return undefined
  const out: NonNullable<NonNullable<ClipEditsV2['layout']['template']>['segments']> = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const startS = Number(o.startS)
    const endS = Number(o.endS)
    const scene = Number(o.scene)
    if (typeof o.id !== 'string' || !Number.isFinite(startS) || !Number.isFinite(endS) || !(endS > startS)) continue
    if (!Number.isInteger(scene) || scene < 0) continue
    out.push({ startS, endS, id: o.id, lane: typeof o.lane === 'string' ? o.lane : undefined, scene })
  }
  return out.length >= 2 ? out : undefined
}

function normalizeFacecam(raw: unknown): ClipLayoutFacecam | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const boxRaw = o.box
  const parseBox = (b: unknown): FacecamBox | undefined => normalizeNormBox(b)
  const split = Number(o.split)
  const pipCorner = o.pipCorner
  const position = o.position
  const out: ClipLayoutFacecam = {
    box: parseBox(boxRaw),
    gameplay: o.gameplay === null ? null : parseBox(o.gameplay),
    split: Number.isFinite(split) ? Math.min(0.5, Math.max(0.25, split)) : undefined,
    position: position === 'bottom' ? 'bottom' : position === 'top' ? 'top' : undefined,
    pipCorner:
      pipCorner === 'TL' || pipCorner === 'TR' || pipCorner === 'BL' || pipCorner === 'BR'
        ? pipCorner
        : undefined,
  }
  if (!out.box && !out.gameplay && out.split == null && !out.position && !out.pipCorner) return undefined
  return out
}

export function mergeEditsPatch(
  current: ClipEditsV2,
  patch: unknown,
  bounds: ClipBounds,
): ClipEditsV2 {
  const base = normalizeEdits(current, bounds)
  if (!patch || typeof patch !== 'object') return base
  const p = patch as Record<string, unknown>
  const merged: Record<string, unknown> = { ...base, ...p }
  if (Object.prototype.hasOwnProperty.call(p, 'speed') && (p.speed === null || p.speed === 1)) {
    delete merged.speed
  }
  return normalizeEdits(merged, bounds)
}

/** JSON-safe edits for PATCH — explicit `speed: null` clears persisted export speed (1×). */
export function editsPayloadForSave(edits: ClipEditsV2): Record<string, unknown> {
  const payload = JSON.parse(canonicalEditsJson(edits)) as Record<string, unknown>
  if (normalizeEditSpeed(edits.speed) === undefined) {
    payload.speed = null
  }
  // Clearing every lane toggle must clear the persisted value (PATCH merges over the server copy).
  if (!edits.timelineLanes) payload.timelineLanes = null
  if (!edits.videoSplits?.length) payload.videoSplits = null
  if (!edits.keyframes?.length) payload.keyframes = null
  if (!edits.transitions?.length) payload.transitions = null
  if (!edits.textItems?.length) payload.textItems = null
  if (!edits.color) payload.color = null
  if (!edits.segmentSpeeds?.length) payload.segmentSpeeds = null
  return payload
}

export function normalizeEdits(raw: unknown, bounds: ClipBounds): ClipEditsV2 {
  const base = defaultEdits(bounds)
  if (!raw || typeof raw !== 'object') return base
  const migrated = migrateLegacyEdits(raw as Record<string, unknown>, bounds)
  const o = migrated
  const layoutRaw = (o.layout as {
    mode?: string
    shotOverrides?: unknown
    layoutSegments?: unknown
    facecam?: unknown
  }) || {}
  const mode = LAYOUT_MODES.includes(layoutRaw.mode as ClipEditsV2['layout']['mode'])
    ? (layoutRaw.mode as ClipEditsV2['layout']['mode'])
    : base.layout.mode
  const aspectRaw = o.aspectRatio
  const aspectRatio = EXPORT_ASPECTS.includes(aspectRaw as ExportAspect)
    ? (aspectRaw as ExportAspect)
    : undefined
  const shotOverrides = Array.isArray(layoutRaw.shotOverrides)
    ? layoutRaw.shotOverrides
        .map((row) => {
          if (!row || typeof row !== 'object') return null
          const r = row as { i?: unknown; focus?: unknown }
          const i = Number(r.i)
          const focus = r.focus
          if (!Number.isFinite(i)) return null
          if (focus !== 'auto' && focus !== 'A' && focus !== 'B' && focus !== 'both') return null
          return { i: Math.round(i), focus }
        })
        .filter(Boolean) as ClipEditsV2['layout']['shotOverrides']
    : []
  const trimRaw = (o.trim as { in?: number; out?: number }) || {}
  const trimLimits =
    bounds.trimMinMs != null && bounds.trimMaxMs != null
      ? { minMs: bounds.trimMinMs, maxMs: bounds.trimMaxMs }
      : undefined
  const trim = clampTrimToExtendedBounds(
    bounds.clipStartMs,
    bounds.clipEndMs,
    {
      in: Number(trimRaw.in ?? base.trim.in),
      out: Number(trimRaw.out ?? base.trim.out),
    },
    trimLimits,
  )
  const rawCuts = Array.isArray(o.cutRanges)
    ? (o.cutRanges as CutRange[]).filter(
        (r) => Array.isArray(r) && r.length === 2 && Number.isFinite(r[0]) && Number.isFinite(r[1]),
      )
    : []
  return {
    ...base,
    ...o,
    v: 2,
    trim,
    cutRanges: sanitizeCutRangesForTrim(rawCuts, trim.in, trim.out),
    wordFixes: (o.wordFixes as Record<string, string>) || {},
    wordFixMeta: normalizeWordFixMeta(o.wordFixMeta, (o.wordFixes as Record<string, string>) || {}),
    captions: normalizeCaptions(o.captions, base.captions),
    layout: {
      ...base.layout,
      mode,
      shotOverrides,
      layoutSegments: normalizeLayoutSegments(layoutRaw.layoutSegments, trim.in, trim.out, mode),
      facecam: normalizeFacecam(layoutRaw.facecam) ?? base.layout.facecam,
      cropBox: normalizeNormBox((layoutRaw as { cropBox?: unknown }).cropBox),
      userPicked: (layoutRaw as { userPicked?: boolean }).userPicked === true ? true : undefined,
      blurStrength: normalizeFitBlurStrength((layoutRaw as { blurStrength?: unknown }).blurStrength),
      template: normalizeLayoutTemplate((layoutRaw as { template?: unknown }).template),
    },
    aspectRatio,
    broll: normalizeBrollItems(o.broll, outputDurationMs({ ...base, ...o, v: 2 } as ClipEditsV2)),
    audio: normalizeAudioEdits(o.audio),
    zoom:
      o.zoom && typeof o.zoom === 'object'
        ? {
            enabled: Boolean((o.zoom as { enabled?: boolean }).enabled),
            intensity: clampZoomIntensity(Number((o.zoom as { intensity?: number }).intensity)),
            facecamOnly: Boolean((o.zoom as { facecamOnly?: boolean }).facecamOnly),
          }
        : undefined,
    silenceTrim:
      o.silenceTrim && typeof o.silenceTrim === 'object'
        ? {
            enabled: Boolean((o.silenceTrim as { enabled?: boolean }).enabled),
            minGapMs: Number((o.silenceTrim as { minGapMs?: number }).minGapMs) || 350,
            keepMs: Number((o.silenceTrim as { keepMs?: number }).keepMs) || 120,
            fillerTrim: (o.silenceTrim as { fillerTrim?: boolean }).fillerTrim !== false,
            protectReactionGaps: Boolean(
              (o.silenceTrim as { protectReactionGaps?: boolean }).protectReactionGaps,
            ),
          }
        : undefined,
    hookOverlay: normalizeHookOverlay(o.hookOverlay),
    exportTemplate: normalizeExportTemplate(o.exportTemplate),
    chatOverlay: normalizeChatOverlay(o.chatOverlay),
    layersV: typeof o.layersV === 'number' ? o.layersV : undefined,
    layers: o.layers,
    layersLegacyFp: typeof o.layersLegacyFp === 'string' ? o.layersLegacyFp : undefined,
    timelineLanes: normalizeTimelineLanes(o.timelineLanes),
    videoSplits: normalizeVideoSplits(o.videoSplits, trim.in, trim.out),
    keyframes: normalizeKeyframeTracks(o.keyframes),
    transitions: normalizeCutTransitions(o.transitions),
    textItems: normalizeTextItems(o.textItems),
    color: normalizeColorEdits(o.color),
    segmentSpeeds: normalizeSegmentSpeeds(o.segmentSpeeds),
    vocabApplied:
      typeof o.vocabApplied === 'string' && o.vocabApplied.length <= 64 ? o.vocabApplied : undefined,
    loudnessLufs:
      o.loudnessLufs === -14 ||
      o.loudnessLufs === -16 ||
      o.loudnessLufs === -18 ||
      o.loudnessLufs === -23 ||
      o.loudnessLufs === -24
        ? (o.loudnessLufs as ClipEditsV2['loudnessLufs'])
        : undefined,
    speechLevelingEnabled: o.speechLevelingEnabled === true ? true : undefined,
    sectionOrder: normalizeSectionOrder(o.sectionOrder, trim.in, trim.out),
    speed: normalizeEditSpeed(o.speed),
  }
}

function normalizeChatOverlay(raw: unknown): ClipEditsV2['chatOverlay'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const c = raw as Record<string, unknown>
  const opacity = Number(c.opacity)
  const pos = c.position
  return {
    enabled: Boolean(c.enabled),
    position:
      pos === 'gameplay_left' || pos === 'bottom' || pos === 'gameplay_right' ? pos : 'bottom',
    opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0.2, opacity)) : 0.6,
  }
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(o).sort()) out[k] = sortJson(o[k])
    return out
  }
  return value
}

export function canonicalEditsJson(edits: ClipEditsV2): string {
  return JSON.stringify(sortJson(edits))
}

export function editsVersionHash(edits: ClipEditsV2): string {
  return createHash('sha256').update(canonicalEditsJson(edits)).digest('hex')
}

const VIDEO_SPLITS_MAX = 200

/** E2fix: sorted, unique, integer split points strictly inside the trim (else undefined). */
export function normalizeVideoSplits(raw: unknown, trimIn: number, trimOut: number): number[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined
  const out = [
    ...new Set(
      raw
        .map((v) => Math.round(Number(v)))
        .filter((v) => Number.isFinite(v) && v > trimIn && v < trimOut),
    ),
  ].sort((a, b) => a - b)
  return out.length ? out.slice(0, VIDEO_SPLITS_MAX) : undefined
}

export function isDefaultEdits(edits: ClipEditsV2, bounds: ClipBounds): boolean {
  const d = defaultEdits(bounds)
  return (
    edits.trim.in === d.trim.in &&
    edits.trim.out === d.trim.out &&
    edits.cutRanges.length === 0 &&
    Object.keys(edits.wordFixes).length === 0 &&
    (edits.layout.shotOverrides?.length ?? 0) === 0 &&
    !edits.layout.cropBox &&
    !normalizeSectionOrder(edits.sectionOrder, edits.trim.in, edits.trim.out) &&
    !isSpeechLevelingEnabled(edits) &&
    normalizeEditSpeed(edits.speed) === undefined &&
    // E2: a muted Voice lane must not reuse the voiced preview render.
    !edits.timelineLanes?.voice?.muted &&
    // E3: keyframes / cut transitions are export-only changes to the frames.
    !edits.keyframes?.length &&
    !edits.transitions?.length &&
    // E4: text / color / per-item speed change the frames or the length.
    !edits.textItems?.length &&
    !hasColor(edits.color) &&
    !edits.segmentSpeeds?.length
  )
}

const SPEED_WHITELIST = new Set([1.1, 1.25, 1.5])

export function normalizeEditSpeed(raw: unknown): 1.1 | 1.25 | 1.5 | undefined {
  const n = Number(raw)
  if (n === 1 || !Number.isFinite(n)) return undefined
  if (SPEED_WHITELIST.has(n as 1.1)) return n as 1.1 | 1.25 | 1.5
  return undefined
}

export function normalizeSectionOrder(
  raw: unknown,
  trimIn: number,
  trimOut: number,
): CutRange[] | undefined {
  if (!raw || !Array.isArray(raw) || !raw.length) return undefined
  if (raw.length > 12) {
    console.warn('[clipper:reorder] invalid_dropped')
    return undefined
  }
  const blocks: CutRange[] = []
  for (const row of raw) {
    if (!Array.isArray(row) || row.length !== 2) {
      console.warn('[clipper:reorder] invalid_dropped')
      return undefined
    }
    const s = Math.round(Number(row[0]))
    const e = Math.round(Number(row[1]))
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
      console.warn('[clipper:reorder] invalid_dropped')
      return undefined
    }
    const cs = Math.max(s, trimIn)
    const ce = Math.min(e, trimOut)
    if (ce - cs < 300) continue
    blocks.push([cs, ce])
  }
  if (!blocks.length) {
    console.warn('[clipper:reorder] invalid_dropped')
    return undefined
  }

  let earliest = 0
  let latest = 0
  for (let i = 1; i < blocks.length; i++) {
    if (blocks[i]![0] < blocks[earliest]![0]) earliest = i
    if (blocks[i]![1] > blocks[latest]![1]) latest = i
  }
  blocks[earliest] = [trimIn, blocks[earliest]![1]]
  blocks[latest] = [blocks[latest]![0], trimOut]

  const clipped = blocks
    .map(([s, e]) => [Math.max(s, trimIn), Math.min(e, trimOut)] as CutRange)
    .filter(([s, e]) => e - s >= 300)
  if (!clipped.length) {
    console.warn('[clipper:reorder] invalid_dropped')
    return undefined
  }

  const sorted = [...clipped].sort((a, b) => a[0] - b[0])
  if (sorted[0]![0] > trimIn + 1 || sorted[sorted.length - 1]![1] < trimOut - 1) {
    console.warn('[clipper:reorder] invalid_dropped')
    return undefined
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]![0] - sorted[i - 1]![1] > 1) {
      console.warn('[clipper:reorder] invalid_dropped')
      return undefined
    }
  }

  let natural = true
  for (let i = 1; i < clipped.length; i++) {
    if (clipped[i]![0] < clipped[i - 1]![0]) {
      natural = false
      break
    }
  }
  if (natural && clipped.length === 1 && clipped[0]![0] === trimIn && clipped[0]![1] === trimOut) {
    return undefined
  }
  if (natural) return undefined

  return clipped
}

export function orderedKeepSegments(edits: ClipEditsV2): [number, number][] {
  const blocks = normalizeSectionOrder(edits.sectionOrder, edits.trim.in, edits.trim.out)
  if (!blocks?.length) {
    return keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges)
  }
  const out: [number, number][] = []
  for (const [bs, be] of blocks) {
    for (const seg of keepSegments(bs, be, edits.cutRanges)) {
      if (seg[1] - seg[0] >= MIN_SEGMENT_MS) out.push(seg)
    }
  }
  return out
}

export function displayDurationMs(edits: ClipEditsV2): number {
  const speed = normalizeEditSpeed(edits.speed) ?? 1
  // E4: per-item speeds warp the edit timeline before the global speed (export_post order).
  const base = edits.segmentSpeeds?.length
    ? warpedDurationMs(speedWarpPieces(orderedKeepSegments(edits), edits.segmentSpeeds))
    : outputDurationMs(edits)
  return Math.round(base / speed)
}

/**
 * E4fix: an edit-timeline position (ms, before speed) → what the viewer sees in the export
 * (per-item speed warp, then global speed). Pairs with displayDurationMs for the player clock.
 */
export function displayPositionMs(edits: ClipEditsV2, editMs: number): number {
  const speed = normalizeEditSpeed(edits.speed) ?? 1
  const base = edits.segmentSpeeds?.length
    ? warpMs(speedWarpPieces(orderedKeepSegments(edits), edits.segmentSpeeds), Math.max(0, editMs))
    : Math.max(0, editMs)
  return Math.round(base / speed)
}

const MIN_SEGMENT_MS = 80

/** Drop or clamp cuts that fall outside the active trim window. */
export function sanitizeCutRangesForTrim(
  cutRanges: CutRange[],
  trimIn: number,
  trimOut: number,
): CutRange[] {
  const out: CutRange[] = []
  for (const [s, e] of cutRanges) {
    const a = Math.min(s, e)
    const b = Math.max(s, e)
    if (b <= trimIn || a >= trimOut) continue
    const cs = Math.max(a, trimIn)
    const ce = Math.min(b, trimOut)
    if (ce - cs >= MIN_SEGMENT_MS) out.push([cs, ce])
  }
  return mergeCutRanges(out)
}

export function keepSegments(trimIn: number, trimOut: number, cutRanges: CutRange[]): [number, number][] {
  const segs: [number, number][] = []
  let t = trimIn
  for (const [s, e] of sanitizeCutRangesForTrim(cutRanges, trimIn, trimOut)) {
    const cs = Math.max(s, trimIn)
    const ce = Math.min(e, trimOut)
    if (ce <= t) continue
    if (cs > t) {
      const segEnd = Math.min(cs, trimOut)
      if (segEnd > t) segs.push([t, segEnd])
    }
    t = Math.max(t, ce)
    if (t >= trimOut) break
  }
  if (t < trimOut) segs.push([t, trimOut])
  return segs.filter(([a, b]) => b - a >= MIN_SEGMENT_MS)
}

export function remapTime(tMs: number, segs: [number, number][]): number | null {
  let acc = 0
  for (const [a, b] of segs) {
    if (a <= tMs && tMs < b) return acc + (tMs - a)
    acc += b - a
  }
  return null
}

export function outputDurationMs(edits: ClipEditsV2): number {
  const segs = keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges)
  return segs.reduce((sum, [a, b]) => sum + (b - a), 0)
}

export type ClipWord = { w: string; s: number; e: number; p?: number; spk?: number; i?: number; idx?: number }

export function wordKey(w: ClipWord): number | undefined {
  if (w.i !== undefined) return w.i
  if (w.idx !== undefined) return w.idx
  return undefined
}

export function applyWordFixesByIndex<T extends ClipWord>(words: T[], fixes: Record<string, string>): T[] {
  return words.map((w) => {
    const key = wordKey(w)
    if (key !== undefined && fixes[String(key)] !== undefined) return { ...w, w: fixes[String(key)] }
    return w
  })
}

export function wordDisplayText(w: ClipWord, fixes: Record<string, string>): string {
  const key = wordKey(w)
  if (key !== undefined && fixes[String(key)] !== undefined) return fixes[String(key)]
  return w.w
}

export function isWordCut(w: ClipWord, cutRanges: CutRange[]): boolean {
  const mid = ((w.s + w.e) / 2) * 1000
  return cutRanges.some(([s, e]) => mid >= s && mid < e)
}

export function subtractRangeFromCuts(cutRanges: CutRange[], restore: CutRange): CutRange[] {
  const [rs, re] = restore
  const out: CutRange[] = []
  for (const [s, e] of cutRanges) {
    if (re <= s || rs >= e) {
      out.push([s, e])
      continue
    }
    if (rs > s) out.push([s, rs])
    if (re < e) out.push([re, e])
  }
  return out.filter(([a, b]) => b - a >= 40)
}

export function mergeCutRanges(cutRanges: CutRange[]): CutRange[] {
  const sorted = [...cutRanges].sort((a, b) => a[0] - b[0])
  const out: CutRange[] = []
  for (const [s, e] of sorted) {
    const prev = out[out.length - 1]
    if (prev && s <= prev[1]) prev[1] = Math.max(prev[1], e)
    else out.push([s, e])
  }
  return out
}

export function wordsAfterEdits(
  words: ClipWord[],
  edits: ClipEditsV2,
): { words: ClipWord[]; segs: [number, number][] } {
  const segs = orderedKeepSegments(edits)
  const out: ClipWord[] = []
  for (const w of words) {
    const sMs = w.s * 1000
    const eMs = w.e * 1000
    const mid = (sMs + eMs) / 2
    const seg = segs.find(([a, b]) => a <= mid && mid < b)
    if (!seg) continue
    const [a, b] = seg
    const clampStart = Math.max(sMs, a)
    const clampEnd = Math.min(eMs, b)
    if (clampEnd - clampStart < 20) continue
    const outS = remapTime(clampStart, segs)
    const outE = remapTime(clampEnd, segs)
    if (outS === null || outE === null || outE <= outS) continue
    const text =
      w.idx !== undefined && edits.wordFixes[String(w.idx)] !== undefined
        ? edits.wordFixes[String(w.idx)]
        : w.w
    if (!String(text ?? '').trim()) continue
    out.push({
      w: text,
      s: outS / 1000,
      e: outE / 1000,
      p: w.p,
      spk: w.spk,
      idx: w.idx,
    })
  }
  return { words: out, segs }
}

export function formatSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.floor((sec % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

export function buildSrtFromCaptionWords(
  words: { text: string; s_ms: number; e_ms: number }[],
): string {
  const lines: string[] = []
  let n = 1
  for (const w of words) {
    if (!w.text.trim()) continue
    if (w.e_ms <= w.s_ms) continue
    lines.push(String(n++))
    lines.push(`${formatSrtTime(w.s_ms / 1000)} --> ${formatSrtTime(w.e_ms / 1000)}`)
    lines.push(w.text)
    lines.push('')
  }
  return lines.join('\n')
}

/** @deprecated use buildSrtFromCaptionWords(buildCaptionWords(...)) */
export function buildSrt(words: ClipWord[]): string {
  return buildSrtFromCaptionWords(
    words.map((w) => ({ text: w.w, s_ms: w.s * 1000, e_ms: w.e * 1000 })),
  )
}

export const FILLER_RE = /^(um+|uh+|erm|ah+)$/i

/** Clip-relative ms segments for ffmpeg on a clip-cut file. */
export function clipRelativeSegments(edits: ClipEditsV2, clipStartMs: number): [number, number][] {
  const segs = keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges)
  return segs.map(([a, b]) => [a - clipStartMs, b - clipStartMs])
}
