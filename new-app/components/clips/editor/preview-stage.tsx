'use client'

import './libass-preview.css'

import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ClipBrandEdits } from '@/lib/clips/brand'
import type { ClipEditsV2, ClipWord } from '@/lib/clips/edits'
import { normalizeEditSpeed, orderedKeepSegments } from '@/lib/clips/edits'
import { fitBlurCssFilter, fitBlurStrength } from '@/lib/clips/fit-blur'
import { editorPreviewCaptionClipWords, editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { logEditorDecision } from '@/lib/clips/editor-decision-log'
import { t6TemplatesEnabled } from '@/lib/clips/t6-feature-flags'
import { editorTemplateSegmentIndex, editorTemplateSpec } from '@/lib/clips/templates/editor-spec'
import { T6_TEMPLATES_BY_ID } from '@/lib/clips/templates/registry'
import { TemplateStage, TemplateTitleOverlay } from '@/components/clips/editor/template-stage'
import { cropPanX, normalizeCropTrack, type CropTrack } from '@/lib/clips/crop-track'
import type { ExportAspect } from '@/lib/clips/export-aspect'
import { shotAt } from '@/lib/clips/crop-track'
import type { SourceWord } from '@/lib/clips/source-words'
import { BrollPreviewVideo } from '@/components/clips/editor/broll-preview-video'
import {
  layoutUsesLetterboxBlurPreview,
} from '@/lib/clips/layout-preview'
import { usesStreamHeadlineBandOverlay } from '@/lib/clips/stream-compose-layout'
import { resolveComposeSpec, type ComposeSpec } from '@/lib/clips/compose-spec'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import { ExportTemplateOverlay } from '@/components/clips/export-template-overlay'
import { PreviewSafeZoneOverlay } from '@/components/clips/editor/preview-safe-zone'
import { STREAM_HEADLINE_BAR_FRAC } from '@/lib/clips/headline-band-layout'
import { headlinePreviewFontFamily, nearestPipCorner, pipCornerSlotStyle } from '@/lib/clips/headline-preview-style'
import type { ExportPlatformId } from '@/lib/clips/export-platform-presets'
import { applyPlaybackTime, outputDurationFromEdits, sourceMsFromVideo, videoTimeFromSourceMs } from '@/lib/clips/editor-playback'
import { InsertPlayback } from '@/components/clips/editor/insert-playback'
import type { EditorMedia } from '@/lib/server/clips/clip-detail'
import type { BrollMediaRow } from '@/lib/server/clips/broll-media'
import { coverBoxStyle, stackPanelStyles } from '@/lib/clips/facecam-geometry'
import { hookTextDuplicatesCaptions } from '@/lib/clips/hook-duplicate'
import { fitTopHeadlineLines } from '@/lib/clips/fit-top-headline-lines'
import { overlayLayout } from '@/lib/clips/stream-overlay-layout'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { splitAudioSrcAt, splitPlanFor } from '@/lib/clips/editor/split-edits'
import { brollTransitionWindows, brollVisibleRange } from '@/lib/clips/editor/transitions'
import { applyMotionFrame } from '@/components/clips/editor/motion-preview'
import { HookOverlayPreview } from '@/components/clips/editor/hook-overlay-preview'
import { TextItemsPreview } from '@/components/clips/editor/text-items-preview'
import { CanvasSelectionOverlay, type CanvasLayerDom } from '@/components/clips/editor/canvas-selection-overlay'
import { orderedStack } from '@/lib/clips/editor/layer-props'
import type { KeyframeTarget } from '@/lib/clips/editor/keyframes'
import { ColorLookDefs, lookFilterCss, usedSpecs } from '@/components/clips/editor/color-look-defs'
import { videoSpecAtSource } from '@/lib/clips/editor/color'
import { speedAtSource } from '@/lib/clips/editor/speed'
import { textItemFrame } from '@/lib/clips/editor/text-frame'
import { libassSupported, previewLibassEnabled } from '@/lib/clips/preview-libass-flag'
import { buildPreviewScripts, PREVIEW_SCRIPT_ORDER, UNDER_Z_BASE, type PreviewScriptKey, type PreviewScripts } from '@/lib/clips/render-plan/preview-scripts'
import { underPasses } from '@/lib/clips/editor/tracks'

/** G1b: the Text script counts as present when only under-text canvases carry text items. */
function hasScript(scripts: PreviewScripts, k: PreviewScriptKey): boolean {
  return Boolean(scripts[k] || (k === 'text' && scripts.under?.length))
}
import { exportPixelSize } from '@/lib/clips/export-aspect'
import { formatHeadlineForExport } from '@/lib/clips/export-template'
import { TITLE_STYLES } from '@/lib/clips/templates/registry'
import { LibassSinkContext, type LibassSink } from '@/components/clips/editor/libass-context'
import type { LibassClock, LibassStatusFn } from '@/components/clips/editor/libass-overlay'

// EP2: libass-wasm layers load only when the editor preview mounts them (own chunk + /jassub/*).
const LibassPreviewLayers = lazy(() =>
  import('@/components/clips/editor/libass-overlay').then((m) => ({ default: m.LibassPreviewLayers })),
)
import { segmentAudio, segmentMediaMs, sourceById, sourceSegmentAt } from '@/lib/clips/editor/sources'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function usesSpeakerCropPreview(edits: ClipEditsV2, track: CropTrack | null): boolean {
  if (!track) return false
  const mode = edits.layout?.mode ?? 'speaker_follow'
  if (
    mode === 'center_crop' ||
    mode === 'fill' ||
    mode === 'fit' ||
    mode === 'fit_blur' ||
    mode === 'fit_top' ||
    mode === 'full_frame' ||
    mode === 'facecam_stack' ||
    mode === 'facecam_pip'
  ) {
    return false
  }
  return true
}

function aspectRatioParts(aspect: ExportAspect | undefined): { aw: number; ah: number } {
  switch (aspect) {
    case '16:9':
      return { aw: 16, ah: 9 }
    case '1:1':
      return { aw: 1, ah: 1 }
    case '4:5':
      return { aw: 4, ah: 5 }
    default:
      return { aw: 9, ah: 16 }
  }
}

export function PreviewStage({
  videoUrl,
  posterUrl = null,
  edits,
  words,
  previewWords,
  brandLogoUrl,
  cropTrack,
  brollMedia = [],
  videoRef,
  onTick,
  channelDisplay,
  chatPreviewEnabled = false,
  media = null,
  audition = null,
  safeZoneVisible = false,
  onStickerMove,
  onPipCornerChange,
  testBoxSize,
  composeSpecPreview = false,
  aiMeta = null,
  selectedTextId = null,
  sourceUrls = null,
  canvas = null,
}: {
  videoUrl: string | null
  posterUrl?: string | null
  edits: ClipEditsV2
  words: SourceWord[]
  previewWords?: ClipWord[]
  brandLogoUrl?: string | null
  cropTrack: CropTrack | null
  brollMedia?: BrollMediaRow[]
  videoRef: React.RefObject<HTMLVideoElement | null>
  onTick: (tick: { sourceMs: number; outputMs: number; playing: boolean }) => void
  channelDisplay?: string | null
  chatPreviewEnabled?: boolean
  media?: EditorMedia | null
  audition?: { edits: ClipEditsV2 } | null
  safeZoneVisible?: boolean
  onStickerMove?: (x: number, y: number) => void
  onPipCornerChange?: (corner: 'TL' | 'TR' | 'BL' | 'BR') => void
  /** Test-only fixed preview box (production never passes). */
  testBoxSize?: { w: number; h: number }
  composeSpecPreview?: boolean
  aiMeta?: Record<string, unknown> | null
  /** E4: outline the text item being edited in the Text panel. */
  selectedTextId?: string | null
  /** E5: signed URLs of other sources (refId → url) from the project media library. */
  sourceUrls?: Record<string, string> | null
  /** G1a: on-canvas selection / move / scale / rotate / crop / text edit (null = view only). */
  canvas?: {
    /** saved edits (commits are computed from these, not from the lane-state `edits`) */
    baseEdits: ClipEditsV2
    selected: KeyframeTarget | null
    onSelect: (target: KeyframeTarget | null) => void
    onCommit: (next: ClipEditsV2, pushHistory: boolean) => void
    cropMode: boolean
    onCropModeChange: (on: boolean) => void
  } | null
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const videoRefInner = useRef<HTMLVideoElement>(null)
  const blurRef = useRef<HTMLVideoElement>(null)
  const editsRef = useRef(edits)
  const aiMetaRef = useRef(aiMeta)
  aiMetaRef.current = aiMeta
  const trackRef = useRef(cropTrack)
  const aspect = edits.aspectRatio ?? '9:16'
  const layoutMode = edits.layout?.mode ?? 'speaker_follow'
  const mediaOffsetMs = media?.offsetMs ?? 0
  const compositePreview = media?.kind === 'composite'
  // T6.3: in template mode the primary <video> belongs to TemplateStage (panel 0). The legacy
  // layout-mode code below (speaker-crop rAF transform, style resets) must not touch it: with
  // I5 (fallbackMode speaker_follow) the crop-track tick overwrote panel 0's geometry, so the
  // preview showed the speaker-track crop instead of the template (empty wall on B).
  const t6TemplateActive = Boolean(
    !compositePreview &&
      videoUrl &&
      t6TemplatesEnabled() &&
      edits.layout?.template?.id &&
      T6_TEMPLATES_BY_ID[edits.layout.template.id],
  )
  const t6TemplateActiveRef = useRef(t6TemplateActive)
  t6TemplateActiveRef.current = t6TemplateActive
  const headlineOn = usesStreamHeadlineBandOverlay(edits as ClipEditsV2)
  const HEADLINE_FITTOP_MODES = new Set(['fit_top', 'speaker_follow', 'auto'])
  const letterboxPreview = !compositePreview && layoutUsesLetterboxBlurPreview(layoutMode)
  const blurStrength = fitBlurStrength(edits)
  const fitTopPreview = Boolean(
    !compositePreview &&
      videoUrl &&
      (layoutMode === 'fit_top' || (headlineOn && HEADLINE_FITTOP_MODES.has(layoutMode))),
  )
  const headlineBandTopFrac =
    headlineOn && !HEADLINE_FITTOP_MODES.has(layoutMode) && !letterboxPreview
      ? STREAM_HEADLINE_BAR_FRAC
      : 0
  const centerCropPreview =
    Boolean(!compositePreview && videoUrl && (layoutMode === 'center_crop' || layoutMode === 'fill'))
  const normalizedTrack = cropTrack ? normalizeCropTrack(cropTrack) : null
  const speakerApproxPreview = Boolean(
    videoUrl &&
      !compositePreview &&
      !letterboxPreview &&
      !fitTopPreview &&
      !centerCropPreview &&
      !normalizedTrack &&
      (layoutMode === 'speaker_follow' || layoutMode === 'auto'),
  )
  const previewFallbackLogged = useRef(false)
  const cropPreview = Boolean(
    videoUrl &&
      !compositePreview &&
      normalizedTrack &&
      usesSpeakerCropPreview(edits, normalizedTrack) &&
      !letterboxPreview &&
      !fitTopPreview,
  )
  editsRef.current = edits
  trackRef.current = normalizedTrack
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [playing, setPlaying] = useState(false)
  const [canPlay, setCanPlay] = useState(false)
  const [captionTimeSec, setCaptionTimeSec] = useState(0)
  // T6.7: scene segment under the playhead (-1 = one template). Only changes at a boundary.
  const [sceneSeg, setSceneSeg] = useState(-1)
  const sceneSrcMsRef = useRef<number | null>(null)
  const sceneSegRef = useRef(-1)
  const brollRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  // E5: uploaded image B-roll (stills) — opacity / look only, no media clock.
  const brollImgRefs = useRef<Record<string, HTMLImageElement | null>>({})
  // E1fix: the rAF tick below is mounted once ([] deps). Reading the `brollMedia` prop there froze
  // it at the first render, so B-roll inserted after load (new media rows) stayed at opacity 0 in
  // the preview while export showed it. Read the live list through a ref instead.
  const brollMediaRef = useRef(brollMedia)
  brollMediaRef.current = brollMedia
  // E1fix: last source time read from the bound main <video>; a layout/template switch remounts that
  // element (keyed by layout mode), and without this the new element starts at 0:00.
  const lastSrcMsRef = useRef<number | null>(null)
  const boundVideoRef = useRef<HTMLVideoElement | null>(null)
  const seekKeyRef = useRef<string | null>(null)
  // E3: layers driven per tick by motion-preview (keyframes + transitions).
  const underRef = useRef<HTMLDivElement>(null)
  const mainKfRef = useRef<HTMLDivElement>(null)
  const mainLayerRef = useRef<HTMLDivElement>(null)
  const cloneARef = useRef<HTMLDivElement>(null)
  const cutDipRef = useRef<HTMLDivElement>(null)
  const cloneBRef = useRef<HTMLDivElement>(null)
  const brollBoxRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const brollDipRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const hookRef = useRef<HTMLDivElement | null>(null)
  // E4: text item layers, last applied playback rate (per-item speed) and main-layer look.
  const textRefs = useRef<Record<string, HTMLDivElement | null>>({})
  // E5: other-source layers (inside the main layer, so keyframes / color looks apply like export).
  const srcBoxRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const srcElRefs = useRef<Record<string, HTMLVideoElement | HTMLImageElement | null>>({})
  const srcMutedMainRef = useRef<{ prev: boolean } | null>(null)
  // G1b3: J / L cuts — a hidden second element plays the main source's sound at the audio position
  // while the picture is already / still on the other side of a cut (export: split_edits.py).
  const splitAudioRef = useRef<HTMLVideoElement | null>(null)
  const lastRateRef = useRef<number | null>(null)
  const onTickRef = useRef(onTick)
  const boxSizeRef = useRef({ w: 0, h: 0 })
  const captionTimeRef = useRef(0)
  // EP2: output-time clock for the libass-wasm layers, fed by the rAF tick below.
  const libassOutMsRef = useRef(0)
  // G1a: output ms of the frame on screen (canvas gestures key at the playhead).
  const outMsRef = useRef(0)
  const [stageBoxEl, setStageBoxEl] = useState<HTMLDivElement | null>(null)
  const libassSubsRef = useRef(new Set<(ms: number) => void>())
  const libassClock = useMemo<LibassClock>(
    () => ({
      now: () => libassOutMsRef.current,
      subscribe: (fn) => {
        libassSubsRef.current.add(fn)
        return () => {
          libassSubsRef.current.delete(fn)
        }
      },
    }),
    [],
  )
  const wordsRef = useRef(words)
  const auditionRef = useRef(audition)
  wordsRef.current = words
  auditionRef.current = audition
  onTickRef.current = onTick
  boxSizeRef.current = box
  const lookEdits = (audition?.edits ?? edits) as ClipEditsV2
  const lookSpecs = useMemo(() => usedSpecs(lookEdits), [lookEdits])

  useEffect(() => {
    const el = videoRefInner.current
    if (!el) return
    ;(videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
    const keepSrcMs = lastSrcMsRef.current
    if (boundVideoRef.current === el || keepSrcMs == null) {
      boundVideoRef.current = el
      return
    }
    // E1fix: a different <video> mounted (layout / template change): restore the playhead.
    const restore = () => {
      const t = videoTimeFromSourceMs(keepSrcMs, mediaOffsetMs)
      if (Math.abs(el.currentTime - t) > 0.05) el.currentTime = t
      boundVideoRef.current = el
    }
    if (el.readyState >= 1) restore()
    else el.addEventListener('loadedmetadata', restore, { once: true })
    return () => el.removeEventListener('loadedmetadata', restore)
  }, [videoRef, cropPreview, letterboxPreview, aspect, videoUrl, layoutMode, edits.layout?.template?.id, mediaOffsetMs])

  useLayoutEffect(() => {
    const v = videoRefInner.current
    const b = blurRef.current
    if (!v || t6TemplateActive) return
    if (centerCropPreview || letterboxPreview || fitTopPreview || speakerApproxPreview) {
      if (!cropPreview) {
        v.style.width = ''
        v.style.left = ''
        v.style.transform = ''
        if (!letterboxPreview && !fitTopPreview) {
          v.style.height = ''
          v.style.top = ''
        }
      }
    }
    if (b) {
      if (letterboxPreview || fitTopPreview) {
        b.style.display = 'block'
        b.style.height = ''
        b.style.width = ''
        b.style.transform = ''
        b.style.filter = ''
      } else if (!cropPreview && !letterboxPreview && !fitTopPreview) {
        b.style.display = 'none'
        b.style.height = ''
        b.style.width = ''
        b.style.transform = ''
        b.style.filter = ''
      }
    }
  }, [
    layoutMode,
    centerCropPreview,
    cropPreview,
    letterboxPreview,
    fitTopPreview,
    speakerApproxPreview,
    videoUrl,
    t6TemplateActive,
  ])

  useLayoutEffect(() => {
    if (testBoxSize && testBoxSize.w > 0 && testBoxSize.h > 0) {
      boxSizeRef.current = testBoxSize
      setBox(testBoxSize)
      return
    }
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width: W, height: H } = e.contentRect
      const { aw, ah } = aspectRatioParts(aspect)
      const h = Math.floor(Math.min(H, (W * ah) / aw))
      if (h <= 0) return
      const w = Math.floor((h * aw) / ah)
      const prev = boxSizeRef.current
      if (prev.w === w && prev.h === h) return
      boxSizeRef.current = { w, h }
      setBox({ w, h })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [aspect, testBoxSize?.w, testBoxSize?.h])

  useEffect(() => {
    const v = videoRefInner.current
    const b = blurRef.current
    if (!videoUrl) {
      setCanPlay(false)
      return
    }
    const v0 = videoRefInner.current
    setCanPlay(Boolean(v0 && v0.readyState >= 2))
    logEditorDecision('preview_ready', {
      mode: layoutMode,
      readyState: v0?.readyState ?? 0,
    })
    if (b) {
      if (cropPreview || letterboxPreview || fitTopPreview) {
        if (!b.src) b.src = videoUrl
      } else {
        b.removeAttribute('src')
        b.load()
      }
    }
    // E1fix: only a new source / trim-in rewinds to trim.in. A layout / template / band change
    // (which can remount the <video>) keeps the current playhead instead of jumping to 0:00.
    const seekKey = `${videoUrl}|${edits.trim.in}`
    const keepMs = lastSrcMsRef.current
    const sameSource = seekKeyRef.current === seekKey
    seekKeyRef.current = seekKey
    const seekAll = videoTimeFromSourceMs(sameSource && keepMs != null ? keepMs : edits.trim.in, mediaOffsetMs)
    wrapRef.current?.querySelectorAll('video').forEach((el) => {
      el.muted = el !== v
      const seek = () => {
        try {
          if (Number.isFinite(seekAll) && seekAll >= 0) el.currentTime = seekAll
        } catch {
          /* metadata not ready */
        }
      }
      if (el.readyState >= 1) seek()
      else el.addEventListener('loadedmetadata', seek, { once: true })
    })
  }, [
    videoUrl,
    edits.trim.in,
    cropPreview,
    letterboxPreview,
    fitTopPreview,
    mediaOffsetMs,
    layoutMode,
    headlineBandTopFrac,
  ])

  useEffect(() => {
    const rate = normalizeEditSpeed(edits.speed) ?? 1
    const applyRate = (el: HTMLVideoElement | null) => {
      if (el) el.playbackRate = rate
    }
    applyRate(videoRefInner.current)
    applyRate(blurRef.current)
    wrapRef.current?.querySelectorAll('video').forEach((el) => applyRate(el))
    Object.values(brollRefs.current).forEach((el) => applyRate(el))
  }, [edits.speed, videoUrl, canPlay])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const v = videoRefInner.current
      const blur = blurRef.current
      const e = auditionRef.current?.edits ?? editsRef.current
      const playbackEdits = editorPreviewEdits(e, wordsRef.current)
      const track = trackRef.current
      const letterbox = layoutUsesLetterboxBlurPreview(e.layout?.mode ?? 'speaker_follow')
      let src = e.trim.in
      if (v) {
        src = sourceMsFromVideo(v.currentTime, mediaOffsetMs)
        if (blur && Math.abs(blur.currentTime - v.currentTime) > 0.05) {
          blur.currentTime = v.currentTime
        }
        // Only the main layer's videos follow the main clock (B-roll and E3 transition clones
        // have their own media times).
        mainLayerRef.current?.querySelectorAll('video').forEach((el) => {
          // E5: other-source videos keep their own media time (set below).
          if (el.dataset.ownClock) return
          if (el !== v && el !== blur && Math.abs(el.currentTime - v.currentTime) > 0.05) {
            el.currentTime = v.currentTime
          }
        })
        if (!v.paused) {
          const stepped = applyPlaybackTime(src, playbackEdits)
          if (Math.abs(stepped.sourceMs - src) > 5) {
            const t = videoTimeFromSourceMs(stepped.sourceMs, mediaOffsetMs)
            v.currentTime = t
            if (blur) blur.currentTime = t
            src = stepped.sourceMs
          }
          if (stepped.atEnd) {
            v.pause()
            setPlaying(false)
          }
        }
      }
      if (v && v === boundVideoRef.current) lastSrcMsRef.current = src
      const segIdx = editorTemplateSegmentIndex(editsRef.current, aiMetaRef.current, src)
      if (segIdx !== sceneSegRef.current) {
        sceneSegRef.current = segIdx
        sceneSrcMsRef.current = src
        setSceneSeg(segIdx)
      }
      const out = applyPlaybackTime(src, playbackEdits).outputMs
      const outSec = out / 1000
      if (out !== libassOutMsRef.current) {
        libassOutMsRef.current = out
        libassSubsRef.current.forEach((fn) => fn(out))
      }
      if (Math.abs(captionTimeRef.current - outSec) >= 0.02) {
        captionTimeRef.current = outSec
        setCaptionTimeSec(outSec)
      }
      const outMs = out
      outMsRef.current = out
      // E4: per-item speed — every element plays at global × segment speed (pitch preserved), so
      // the edit-time clock (captions, overlays, B-roll, music) advances exactly like the export warp.
      const rate = (normalizeEditSpeed(e.speed) ?? 1) * speedAtSource(e.segmentSpeeds, src)
      if (e.segmentSpeeds?.length || lastRateRef.current !== null) {
        // Compared per element each tick (cheap), so B-roll / remounted videos pick it up too.
        lastRateRef.current = e.segmentSpeeds?.length ? rate : null
        const setRate = (el: HTMLVideoElement | null) => {
          if (el && el.playbackRate !== rate) el.playbackRate = rate
        }
        setRate(v)
        setRate(blur)
        mainLayerRef.current?.querySelectorAll('video').forEach((el) => setRate(el))
        Object.values(brollRefs.current).forEach((el) => setRate(el))
      }
      // E5: Video-lane segments from another source — show its layer at the mapped media time; the
      // segment's sound mode mutes / unmutes the main and the source element (export: media_sources).
      const sseg = sourceSegmentAt(e.sourceSegments, src)
      const ssrc = sseg ? sourceById(e.sources, sseg.sourceId) : undefined
      for (const s of e.sources ?? []) {
        const box = srcBoxRefs.current[s.id]
        const el = srcElRefs.current[s.id]
        if (!box) continue
        const on = Boolean(sseg && sseg.sourceId === s.id)
        const vis = on ? 'visible' : 'hidden'
        if (box.style.visibility !== vis) box.style.visibility = vis
        if (el && on && sseg) {
          const fit = sseg.fit === 'contain' ? 'contain' : 'cover'
          if (el.style.objectFit !== fit) el.style.objectFit = fit
        }
        if (el instanceof HTMLVideoElement) {
          if (on && sseg) {
            const t = segmentMediaMs(sseg, s, src) / 1000
            if (Math.abs(el.currentTime - t) > 0.15) el.currentTime = t
            const muted = segmentAudio(sseg, s) === 'main'
            if (el.muted !== muted) el.muted = muted
            if (v && el.playbackRate !== v.playbackRate) el.playbackRate = v.playbackRate
            if (v && !v.paused && el.paused) void el.play().catch(() => {})
            if (v && v.paused && !el.paused) el.pause()
          } else {
            if (!el.paused) el.pause()
            if (!el.muted) el.muted = true
          }
        }
      }
      const tbNow = timebaseFor(playbackEdits)
      const splitSrc = splitAudioSrcAt(splitPlanFor(playbackEdits, tbNow.segs), outMs)
      const sa = splitAudioRef.current
      if (sa) {
        if (v && splitSrc != null) {
          const t = videoTimeFromSourceMs(splitSrc, mediaOffsetMs)
          if (Math.abs(sa.currentTime - t) > 0.12) sa.currentTime = t
          const baseMuted = srcMutedMainRef.current ? srcMutedMainRef.current.prev : v.muted
          if (sa.muted !== baseMuted) sa.muted = baseMuted
          if (sa.volume !== v.volume) sa.volume = v.volume
          if (sa.playbackRate !== v.playbackRate) sa.playbackRate = v.playbackRate
          if (!v.paused && sa.paused) void sa.play().catch(() => {})
          if (v.paused && !sa.paused) sa.pause()
        } else if (!sa.paused) sa.pause()
      }
      const muteMain = Boolean(sseg && segmentAudio(sseg, ssrc) === 'source') || (Boolean(v) && splitSrc != null)
      if (v && muteMain && !srcMutedMainRef.current) {
        srcMutedMainRef.current = { prev: v.muted }
        v.muted = true
      } else if (v && !muteMain && srcMutedMainRef.current) {
        v.muted = srcMutedMainRef.current.prev
        srcMutedMainRef.current = null
      }
      // E4: color looks — main layer by source position, B-roll per item (SVG filters, ColorLookDefs).
      const mainLook = lookFilterCss(videoSpecAtSource(e.color, src))
      if (mainLayerRef.current && mainLayerRef.current.style.filter !== mainLook) mainLayerRef.current.style.filter = mainLook
      for (const it of e.textItems ?? []) {
        const el = textRefs.current[it.id]
        if (!el) continue
        const f = textItemFrame(e, it, outMs)
        const vis = f.visible ? 'visible' : 'hidden'
        if (el.style.visibility !== vis) el.style.visibility = vis
        const op = String(f.visible ? f.opacity : 0)
        if (el.style.opacity !== op) el.style.opacity = op
        if (el.style.transform !== f.transform) el.style.transform = f.transform
      }
      const bWins = brollTransitionWindows(e.broll)
      for (const item of e.broll || []) {
        // E1fix: live media rows via ref (the tick is mounted once).
        const media = brollMediaRef.current.find((m) => m.id === item.id)
        const img = brollImgRefs.current[item.id]
        if (img && media?.url) {
          const [iStart, iEnd] = brollVisibleRange(item, bWins)
          const iop = iStart <= outMs && outMs < iEnd ? '1' : '0'
          if (img.style.opacity !== iop) img.style.opacity = iop
          const iLook = lookFilterCss(e.color?.broll?.[item.id])
          if (img.style.filter !== iLook) img.style.filter = iLook
          continue
        }
        const el = brollRefs.current[item.id]
        if (!el || !media?.url) continue
        // E3: an outgoing item keeps playing through the next item's 'between' transition.
        const [visStart, visEnd] = brollVisibleRange(item, bWins)
        const active = visStart <= outMs && outMs < visEnd
        // E1fix contract: the B-roll <video> itself is opacity 1 while active (E3 shows/hides and
        // animates its box; keyframed opacity lives on the box, not here).
        const op = active ? '1' : '0'
        if (el.style.opacity !== op) el.style.opacity = op
        const bLook = lookFilterCss(e.color?.broll?.[item.id])
        if (el.style.filter !== bLook) el.style.filter = bLook
        if (active) {
          // E2: inMs = media in-point (split / left-trim). Export loops short B-roll (-stream_loop -1).
          const relRaw = (outMs - item.startMs + (item.inMs ?? 0)) / 1000
          const d = el.duration
          const rel = Number.isFinite(d) && d > 0.1 ? relRaw % d : relRaw
          if (Math.abs(el.currentTime - rel) > 0.15) el.currentTime = rel
          if (v && !v.paused && el.paused) void el.play()
          if (v && v.paused && !el.paused) el.pause()
        } else if (!el.paused) el.pause()
      }
      applyMotionFrame(
        {
          under: underRef.current,
          mainKf: mainKfRef.current,
          mainLayer: mainLayerRef.current,
          cloneA: cloneARef.current,
          cutDip: cutDipRef.current,
          cloneB: cloneBRef.current,
          brollBox: brollBoxRefs.current,
          brollDip: brollDipRefs.current,
          hook: hookRef.current,
        },
        e,
        tbNow,
        outMs,
        {
          boxW: boxSizeRef.current.w,
          playing: v ? !v.paused : false,
          rate,
          mediaOffsetMs,
          lookAt: e.color ? (ms: number) => lookFilterCss(videoSpecAtSource(e.color, ms)) : undefined,
        },
      )
      onTickRef.current({ sourceMs: src, outputMs: out, playing: v ? !v.paused : playing })

      const { w: boxW, h: boxH } = boxSizeRef.current
      if (v && !t6TemplateActiveRef.current && track && usesSpeakerCropPreview(e, track) && boxH > 0 && Array.isArray(track.shots) && track.shots.length > 0) {
        const s = boxH / track.H
        const fi = Math.round(((src - track.t0_ms) / 1000) * track.fps)
        const { i: shotI } = shotAt(track, src)
        const overrides = Array.isArray(e.layout?.shotOverrides) ? e.layout.shotOverrides : []
        const ov = overrides.find((o) => o.i === shotI)?.focus
        const wide = ov === 'both'
        const arr = ov === 'A' ? track.x0_A : ov === 'B' ? track.x0_B : track.x0
        const raw = arr?.length ? arr[clamp(fi, 0, arr.length - 1)] : cropPanX(track, fi)
        const x0 = raw ?? cropPanX(track, fi)
        const fit = wide || x0 <= -2
        if (fit) {
          v.style.height = `${boxH}px`
          v.style.width = `${boxW}px`
          v.style.left = '0'
          v.style.top = '0'
          v.style.transform = 'translate3d(0,0,0)'
          if (blur) {
            blur.style.display = 'block'
            blur.style.height = '100%'
            blur.style.width = '100%'
            blur.style.transform = 'scale(1.2)'
            blur.style.filter = fitBlurCssFilter(fitBlurStrength(e), boxW)
          }
        } else {
          if (blur) blur.style.display = 'none'
          v.style.height = `${boxH}px`
          v.style.width = `${track.W * s}px`
          v.style.left = '0'
          v.style.top = '0'
          const x0s = x0 * s
          v.style.transform = `translate3d(${-x0s}px,0,0)`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const previewEdits = useMemo(() => editorPreviewEdits(edits, words), [edits, words])
  const previewOutDurMs = useMemo(() => outputDurationFromEdits(previewEdits), [previewEdits])
  const facecamBox = edits.layout.facecam?.box
  const facecamGameplay = edits.layout.facecam?.gameplay
  const facecamStackPreview =
    Boolean(videoUrl) &&
    !compositePreview &&
    layoutMode === 'facecam_stack' &&
    facecamBox &&
    !cropPreview &&
    !letterboxPreview
  const facecamPipPreview =
    Boolean(videoUrl) &&
    !compositePreview &&
    layoutMode === 'facecam_pip' &&
    facecamBox &&
    !cropPreview &&
    !letterboxPreview
  const captionWords = useMemo(() => {
    if (previewWords?.length) return previewWords.map((w) => ({
      ...w,
      w: typeof w.w === 'string' ? w.w : String(w.w ?? ''),
    }))
    return editorPreviewCaptionClipWords(words, edits)
  }, [previewWords, words, edits])
  // E6: same rule as the export (worker hook_duplicate.py) — a hook that is the opening spoken
  // line is not drawn over captions showing those words.
  const hookDupesCaptions =
    edits.captions?.enabled !== false &&
    Boolean(edits.hookOverlay?.enabled) &&
    hookTextDuplicatesCaptions(edits.hookOverlay?.text ?? '', captionWords, edits.hookOverlay?.durationMs ?? 2500)

  useEffect(() => {
    logEditorDecision('caption_timeline', {
      wordCount: captionWords.length,
      silenceTrimEnabled: Boolean(edits.silenceTrim?.enabled),
      previewWordSource: previewWords?.length ? 'dub' : 'editor_preview',
    })
  }, [captionWords.length, edits.silenceTrim?.enabled, previewWords?.length])

  useEffect(() => {
    if (!speakerApproxPreview || previewFallbackLogged.current) return
    previewFallbackLogged.current = true
    logEditorDecision('preview_fallback', { reason: 'no_crop_track' })
  }, [speakerApproxPreview])

  const composeSpec = useMemo(() => {
    if (!composeSpecPreview || !fitTopPreview) return null
    try {
      return resolveComposeSpec(edits as ClipEditsV2, 1080, 1920)
    } catch {
      return null
    }
  }, [composeSpecPreview, fitTopPreview, edits])

  const fitTopLayout = useMemo(() => {
    if (!fitTopPreview) return null
    if (composeSpec) {
      const legacy = overlayLayout(2, 1080, 1920)
      return {
        ...legacy,
        videoY: composeSpec.video.y,
        videoH: composeSpec.video.h,
        headlineTop: composeSpec.headline?.y ?? legacy.headlineTop,
        headlineH: composeSpec.headline?.h ?? legacy.headlineH,
      }
    }
    try {
      const lines = fitTopHeadlineLines(edits)
      return overlayLayout(Math.max(2, lines.length || 2), 1080, 1920)
    } catch (err) {
      console.warn('[clipper:preview] fit_top_fallback', err)
      return null
    }
  }, [fitTopPreview, edits, composeSpec])

  const templatePreview = useMemo(() => {
    if (!videoUrl || compositePreview) return null
    // T6.5: same spec helper as the layout studio's 9:16 preview.
    // T6.7: with per-scene segments, the spec of the segment under the playhead.
    return editorTemplateSpec(edits, aiMeta, sceneSeg >= 0 ? (sceneSrcMsRef.current ?? undefined) : undefined)
  }, [videoUrl, compositePreview, edits, aiMeta, sceneSeg])

  const brand = (edits.brand || {}) as ClipBrandEdits
  const pos = brand.logoPosition ?? 'TR'

  // E1fix: B-roll covers the same region the export overlays it on. Template mode and plain
  // layouts: the whole 9:16 frame (the T6 title band is burned on top after B-roll; its preview
  // band is z-[26]). fit_top / stream headline: the video area under the band, because the worker
  // overlays B-roll on the cut and then composes that into the band layout.
  // EP2: every text overlay through libass-wasm from the export's own .ass (render-plan builders).
  const libassWanted = !compositePreview && box.w > 0 && previewLibassEnabled() && libassSupported()
  const [libassStatus, setLibassStatus] = useState<Partial<Record<PreviewScriptKey, 'ready' | 'failed'>>>({})
  const [libassFailed, setLibassFailed] = useState<string | null>(null)
  const [libassHeadline, setLibassHeadline] = useState<Parameters<LibassSink['headline']>[0]>(null)
  const [libassBadge, setLibassBadge] = useState<Parameters<LibassSink['badge']>[0]>(null)
  const libassSink = useMemo<LibassSink>(() => ({ headline: setLibassHeadline, badge: setLibassBadge }), [])
  const libassPlay = useMemo(() => exportPixelSize((edits.aspectRatio ?? '9:16') as ExportAspect, '1080p'), [edits.aspectRatio])
  // G1b: a text track under an overlay track. Same rule as edits_render._under_text_passes: only
  // when B-roll covers the whole frame (no template / fit_top / headline band); else text on top.
  const underPassList = useMemo(() => {
    if (compositePreview || templatePreview || fitTopPreview || headlineBandTopFrac > 0) return []
    return underPasses(edits as ClipEditsV2, (edits.broll ?? []).map((b) => b.id))
  }, [edits, compositePreview, templatePreview, fitTopPreview, headlineBandTopFrac])
  const underZ = useMemo(() => {
    const m: Record<string, number> = {}
    underPassList.forEach((p, i) => {
      for (const id of p.ids) m[`${p.kind}:${id}`] = UNDER_Z_BASE + i
    })
    return m
  }, [underPassList])
  const underZRef = useRef(underZ)
  underZRef.current = underZ
  const libassScripts = useMemo(() => {
    if (!libassWanted || libassFailed) return null
    try {
      const mode = edits.layout?.mode ?? 'speaker_follow'
      return buildPreviewScripts({
        edits: edits as unknown as Record<string, unknown>,
        words: edits.captions?.enabled === false ? [] : captionWords,
        playW: templatePreview?.playW ?? libassPlay.width,
        playH: templatePreview?.playH ?? libassPlay.height,
        durationMs: Math.max(1, previewOutDurMs),
        t6Spec: templatePreview ?? null,
        titleStyles: TITLE_STYLES as unknown as Record<string, { text?: string; font?: string; bg?: { kind?: string } }>,
        formatHeadline: formatHeadlineForExport,
        composeCaptions: composeSpec?.captions ?? null,
        streamFrame: !templatePreview && ['fit_top', 'fit_blur', 'full_frame'].includes(mode),
        headline: templatePreview ? null : libassHeadline,
        badge: libassBadge,
        hookDuplicatesCaptions: hookDupesCaptions,
        underPasses: underPassList,
      })
    } catch (err) {
      console.warn('[clipper:preview] libass_scripts_fail', err)
      return null
    }
  }, [libassWanted, libassFailed, edits, captionWords, templatePreview, libassPlay, previewOutDurMs, composeSpec, libassHeadline, libassBadge, hookDupesCaptions, underPassList])
  const onLibassStatus = useCallback<LibassStatusFn>((key, status, info) => {
    setLibassStatus((prev) => (prev[key] === status ? prev : { ...prev, [key]: status }))
    logEditorDecision('preview_ready', { renderer: 'libass', layer: key, status, ...info })
    if (status === 'failed') setLibassFailed(String(info.reason ?? 'unknown'))
  }, [])
  // A layer whose script went away forgets its status (a new one starts as DOM until ready).
  useEffect(() => {
    if (!libassScripts) return
    setLibassStatus((prev) => {
      const next = { ...prev }
      let changed = false
      for (const k of PREVIEW_SCRIPT_ORDER) if (!hasScript(libassScripts, k) && next[k]) { delete next[k]; changed = true }
      return changed ? next : prev
    })
  }, [libassScripts])
  const libassClass = libassScripts
    ? PREVIEW_SCRIPT_ORDER.filter((k) => hasScript(libassScripts, k) && libassStatus[k] === 'ready').map((k) => `libass-${k}`).join(' ')
    : ''

  const brollRegionStyle = useMemo((): React.CSSProperties => {
    if (!templatePreview && fitTopPreview && fitTopLayout && box.h > 0) {
      const sy = box.h / fitTopLayout.playH
      return { left: 0, right: 0, top: fitTopLayout.videoY * sy, height: fitTopLayout.videoH * sy }
    }
    if (!templatePreview && headlineBandTopFrac > 0) {
      return { left: 0, right: 0, bottom: 0, top: `${headlineBandTopFrac * 100}%` }
    }
    return { inset: 0 }
  }, [templatePreview, fitTopPreview, fitTopLayout, box.h, headlineBandTopFrac])

  // G1a: canvas layers bottom → top (same order as the DOM / the export composite).
  const getOutMs = useCallback(() => outMsRef.current, [])
  const getCanvasLayers = useCallback((): CanvasLayerDom[] => {
    const e = editsRef.current
    const out: CanvasLayerDom[] = [{ target: 'video', el: mainKfRef.current, frame: stageBoxEl }]
    for (const b of orderedStack(e, 'broll', e.broll ?? [])) {
      const el = brollBoxRefs.current[b.id] ?? null
      out.push({ target: `broll:${b.id}`, el, frame: el?.parentElement ?? null })
    }
    // Hook (z-22) sits under the text items (z-23).
    if (hookRef.current) {
      out.push({ target: 'text', el: hookRef.current, frame: stageBoxEl, content: hookRef.current.firstElementChild as HTMLElement | null })
    }
    for (const t of orderedStack(e, 'text', e.textItems ?? [])) {
      const el = textRefs.current[t.id] ?? null
      out.push({ target: `text:${t.id}`, el, frame: stageBoxEl, content: el?.querySelector<HTMLElement>('[data-testid="preview-text-block"]') ?? null })
    }
    // G1b: text under an overlay track hit-tests under that overlay (same z as the drawing).
    const uz = underZRef.current
    if (!Object.keys(uz).length) return out
    const zOf = (l: CanvasLayerDom) => {
      if (l.target === 'video') return 0
      if (l.target.startsWith('broll:')) return uz[`overlay:${l.target.slice(6)}`] ?? 15
      if (l.target.startsWith('text:')) return uz[`text:${l.target.slice(5)}`] ?? 23
      return 22
    }
    return out.map((l, i) => ({ l, i, z: zOf(l) })).sort((a, b) => a.z - b.z || a.i - b.i).map((x) => x.l)
  }, [stageBoxEl])

  return (
    <div ref={wrapRef} className="absolute inset-0 flex flex-col items-center justify-center">
      {compositePreview ? (
        <p className="mb-2 max-w-md px-3 text-center text-xs text-muted-foreground">
          This older clip&apos;s preview has captions and headline baked in. Edits apply on export.
        </p>
      ) : null}
      <LibassSinkContext.Provider value={libassWanted ? libassSink : null}>
      <div
        style={{ width: box.w || undefined, height: box.h || undefined }}
        ref={setStageBoxEl}
        className={`relative overflow-hidden rounded-xl bg-black ${libassClass}`}
        data-preview-renderer={libassClass ? 'libass' : 'dom'}
      >
        {posterUrl && !canPlay ? (
          <img
            src={posterUrl}
            alt=""
            className="absolute inset-0 z-0 size-full object-cover"
          />
        ) : null}
        {!canPlay && videoUrl ? (
          <div
            className="absolute inset-0 z-[2] animate-pulse bg-gradient-to-b from-muted/40 via-muted/20 to-muted/40"
            aria-hidden
          />
        ) : null}
        <div ref={underRef} className="absolute inset-0" data-testid="preview-under">
        <div ref={mainKfRef} className="absolute inset-0" style={{ transformOrigin: '50% 50%' }} data-testid="preview-main-kf">
        <div ref={mainLayerRef} className="absolute inset-0" data-testid="preview-main-layer">
        {templatePreview ? (
          <TemplateStage
            spec={templatePreview}
            blurStrength={blurStrength}
            videoUrl={videoUrl}
            posterUrl={posterUrl}
            primaryVideoRef={videoRefInner}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            lowResWarning={
              (media?.height ?? 1080) < 720 &&
              templatePreview.panels.some((p) => p.src.w < 0.5 && p.dest.h > templatePreview.playH * 0.3)
            }
            onReady={() => setCanPlay(true)}
          />
        ) : letterboxPreview ? (
          <>
            <video
              key={`preview-blur-${layoutMode}`}
              ref={blurRef}
              src={videoUrl ?? undefined}
              className="absolute inset-0 size-full max-w-none scale-110 object-cover blur-2xl"
              style={{ filter: fitBlurCssFilter(blurStrength, box.w) }}
              muted
              playsInline
              aria-hidden
            />
            <video
              key={`preview-main-${layoutMode}`}
              ref={videoRefInner}
              src={videoUrl ?? undefined}
              className={`absolute inset-x-0 top-1/2 z-[1] w-full -translate-y-1/2 object-contain transition-opacity ${canPlay ? 'opacity-100' : 'opacity-0'}`}
              playsInline
              poster={posterUrl ?? undefined}
              onLoadedMetadata={() => {
                const v = videoRefInner.current
                const b = blurRef.current
                if (v && b) b.currentTime = v.currentTime
              }}
              onCanPlay={() => setCanPlay(true)}
              onLoadedData={() => setCanPlay(true)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          </>
        ) : fitTopPreview && fitTopLayout && box.h > 0 ? (
          (() => {
            const sy = box.h / fitTopLayout.playH
            const videoTop = fitTopLayout.videoY * sy
            const videoH = fitTopLayout.videoH * sy
            return (
              <>
                <video
                  ref={blurRef}
                  src={videoUrl ?? undefined}
                  className="absolute inset-0 size-full max-w-none object-cover"
                  style={{ filter: fitBlurCssFilter(blurStrength, box.w) }}
                  muted
                  playsInline
                  aria-hidden
                />
                <video
                  key={`preview-main-${layoutMode}`}
                  ref={videoRefInner}
                  src={videoUrl ?? undefined}
                  data-testid={composeSpec ? 'compose-video' : 'fit-top-main-video'}
                  className={`absolute inset-x-0 z-[1] max-w-none object-cover transition-opacity ${canPlay ? 'opacity-100' : 'opacity-0'}`}
                  style={{ top: videoTop, height: videoH, width: '100%' }}
                  playsInline
                  poster={posterUrl ?? undefined}
                  onLoadedMetadata={() => {
                    const v = videoRefInner.current
                    const b = blurRef.current
                    if (v && b) b.currentTime = v.currentTime
                  }}
                  onCanPlay={() => setCanPlay(true)}
                  onLoadedData={() => setCanPlay(true)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />
              </>
            )
          })()
        ) : fitTopPreview && videoUrl ? (
          <video
            ref={videoRefInner}
            src={videoUrl ?? undefined}
            className={`size-full object-contain transition-opacity ${canPlay ? 'opacity-100' : 'opacity-0'}`}
            playsInline
            poster={posterUrl ?? undefined}
            onCanPlay={() => setCanPlay(true)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : facecamStackPreview && facecamBox ? (
          (() => {
            const split = edits.layout.facecam?.split ?? 0.4
            const position = edits.layout.facecam?.position ?? 'top'
            const { faceFrac, gameFrac, faceFirst } = stackPanelStyles(split, position)
            const gameBox = facecamGameplay ?? { x: 0, y: 0, w: 1, h: 1 }
            const panels = faceFirst
              ? [
                  { box: facecamBox, h: `${faceFrac * 100}%` },
                  { box: gameBox, h: `${gameFrac * 100}%` },
                ]
              : [
                  { box: gameBox, h: `${gameFrac * 100}%` },
                  { box: facecamBox, h: `${faceFrac * 100}%` },
                ]
            const stackBody = (
              <div className="flex size-full flex-col overflow-hidden">
                {panels.map((panel, idx) => (
                  <div key={idx} className="relative w-full overflow-hidden" style={{ height: panel.h }}>
                    <video
                      key={`stack-${idx}-${layoutMode}`}
                      ref={idx === (faceFirst ? 1 : 0) ? videoRefInner : undefined}
                      src={videoUrl ?? undefined}
                      className={`max-w-none ${canPlay ? 'opacity-100' : 'opacity-0'}`}
                      style={coverBoxStyle(panel.box)}
                      playsInline
                      onCanPlay={() => setCanPlay(true)}
                      onLoadedData={() => setCanPlay(true)}
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                    />
                  </div>
                ))}
              </div>
            )
            return headlineBandTopFrac > 0 ? (
              <div
                className="absolute inset-x-0 bottom-0 overflow-hidden"
                style={{ top: `${headlineBandTopFrac * 100}%` }}
              >
                {stackBody}
              </div>
            ) : (
              stackBody
            )
          })()
        ) : facecamPipPreview && facecamBox ? (
          (() => {
            const pipBody = (
              <div className="relative size-full overflow-hidden">
                <video
                  ref={videoRefInner}
                  src={videoUrl ?? undefined}
                  className={`max-w-none size-full object-cover ${canPlay ? 'opacity-100' : 'opacity-0'}`}
                  style={coverBoxStyle(facecamGameplay ?? { x: 0, y: 0, w: 1, h: 1 })}
                  playsInline
                  onCanPlay={() => setCanPlay(true)}
                  onLoadedData={() => setCanPlay(true)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />
                <div
                  className={`absolute z-[2] overflow-hidden rounded-md ring-2 ring-white/80 ${onPipCornerChange ? 'cursor-grab' : ''}`}
                  style={pipCornerSlotStyle(edits.layout.facecam?.pipCorner)}
                  onPointerUp={
                    onPipCornerChange
                      ? (e) => {
                          const rect = e.currentTarget.parentElement?.getBoundingClientRect()
                          if (!rect) return
                          onPipCornerChange(nearestPipCorner(e.clientX, e.clientY, rect))
                        }
                      : undefined
                  }
                >
                  <video
                    src={videoUrl ?? undefined}
                    className="max-w-none"
                    style={coverBoxStyle(facecamBox)}
                    playsInline
                    muted
                    aria-hidden
                  />
                </div>
              </div>
            )
            return headlineBandTopFrac > 0 ? (
              <div
                className="absolute inset-x-0 bottom-0 overflow-hidden"
                style={{ top: `${headlineBandTopFrac * 100}%` }}
              >
                {pipBody}
              </div>
            ) : (
              pipBody
            )
          })()
        ) : cropPreview ? (
          (() => {
            const cropBody = (
              <>
                <video
                  key={`preview-blur-${layoutMode}`}
                  ref={blurRef}
                  src={videoUrl ?? undefined}
                  className="absolute inset-0 size-full max-w-none object-cover"
                  muted
                  playsInline
                  aria-hidden
                />
                <video
                  key={`preview-main-${layoutMode}`}
                  ref={videoRefInner}
                  src={videoUrl ?? undefined}
                  className={`absolute left-0 top-0 z-[1] max-w-none transition-opacity ${canPlay ? 'opacity-100' : 'opacity-0'}`}
                  style={{ position: 'absolute', left: 0, top: 0, maxWidth: 'none' }}
                  playsInline
                  onLoadedMetadata={() => {
                    const v = videoRefInner.current
                    const b = blurRef.current
                    if (v && b) b.currentTime = v.currentTime
                  }}
                  onCanPlay={() => setCanPlay(true)}
                  onLoadedData={() => setCanPlay(true)}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />
              </>
            )
            return headlineBandTopFrac > 0 ? (
              <div
                className="absolute inset-x-0 bottom-0 overflow-hidden"
                style={{ top: `${headlineBandTopFrac * 100}%` }}
              >
                {cropBody}
              </div>
            ) : (
              cropBody
            )
          })()
        ) : centerCropPreview ? (
          (() => {
            const fillBody = (
              <video
                key={`preview-main-${layoutMode}`}
                ref={videoRefInner}
                src={videoUrl ?? undefined}
                data-testid="center-crop-video"
                className={`size-full transition-opacity ${canPlay ? 'opacity-100' : 'opacity-0'} ${edits.layout.cropBox ? '' : 'object-cover'}`}
                style={edits.layout.cropBox ? coverBoxStyle(edits.layout.cropBox) : undefined}
                playsInline
                onCanPlay={() => setCanPlay(true)}
                onLoadedData={() => setCanPlay(true)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
              />
            )
            return headlineBandTopFrac > 0 ? (
              <div
                className="absolute inset-x-0 bottom-0 overflow-hidden"
                style={{ top: `${headlineBandTopFrac * 100}%` }}
              >
                {fillBody}
              </div>
            ) : (
              fillBody
            )
          })()
        ) : speakerApproxPreview ? (
          <>
            <video
              ref={videoRefInner}
            src={videoUrl ?? undefined}
            className={`size-full object-cover transition-opacity ${canPlay ? 'opacity-100' : 'opacity-0'}`}
            playsInline
            onCanPlay={() => setCanPlay(true)}
            onLoadedData={() => setCanPlay(true)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
            <p className="pointer-events-none absolute bottom-2 inset-x-2 z-[30] rounded bg-black/55 px-2 py-1 text-center text-[10px] text-white/90">
              Framing preview is approximate until auto-reframe runs
            </p>
          </>
        ) : videoUrl ? (
          <video
            ref={videoRefInner}
            src={videoUrl ?? undefined}
            className={`size-full object-contain transition-opacity ${canPlay ? 'opacity-100' : 'opacity-0'}`}
            playsInline
            onCanPlay={() => setCanPlay(true)}
            onLoadedData={() => setCanPlay(true)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        ) : (
          <div className="flex size-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">No video</div>
        )}
        {(edits.sources ?? []).map((s) => {
          const url = s.mediaType !== 'audio' ? sourceUrls?.[s.refId] : undefined
          if (!url) return null
          return (
            <div
              key={`${s.id}:${url}`}
              ref={(el) => {
                srcBoxRefs.current[s.id] = el
              }}
              className="pointer-events-none absolute inset-0 overflow-hidden bg-black"
              style={{ visibility: 'hidden' }}
              data-testid="preview-source"
              data-source-id={s.id}
            >
              {s.mediaType === 'image' ? (
                <img
                  ref={(el) => {
                    srcElRefs.current[s.id] = el
                  }}
                  src={url}
                  alt=""
                  className="size-full object-cover"
                  draggable={false}
                />
              ) : (
                <video
                  ref={(el) => {
                    srcElRefs.current[s.id] = el
                  }}
                  src={url}
                  data-own-clock="1"
                  className="size-full object-cover"
                  muted
                  playsInline
                  preload="auto"
                />
              )}
            </div>
          )
        })}
        <InsertPlayback videoRef={videoRefInner} edits={edits} words={words} sourceUrls={sourceUrls} mediaOffsetMs={mediaOffsetMs} />
        {videoUrl && edits.splitEdits?.length ? (
          <video
            ref={splitAudioRef}
            src={videoUrl}
            className="hidden"
            data-testid="preview-split-audio"
            data-own-clock="1"
            playsInline
            preload="auto"
            aria-hidden
          />
        ) : null}
        </div>
        {/* E3 cut transitions: clone A (outgoing, continued), dip colour, clone B (incoming, pre-rolled). */}
        <div ref={cloneARef} className="pointer-events-none absolute inset-0" style={{ visibility: 'hidden' }} data-testid="preview-transition-a" aria-hidden />
        <div ref={cutDipRef} className="pointer-events-none absolute inset-0" style={{ opacity: 0 }} data-testid="preview-transition-color" aria-hidden />
        <div ref={cloneBRef} className="pointer-events-none absolute inset-0" style={{ visibility: 'hidden' }} data-testid="preview-transition-b" aria-hidden />
        </div>
        </div>
        {!compositePreview &&
          // G1a: DOM order = stacking order (time order; bring forward / back among overlapping items).
          orderedStack(edits, 'broll', edits.broll || [])
            .map((item) => {
              const media = brollMedia.find((m) => m.id === item.id)
              if (!media?.url) return null
              // E1fix region (full frame / under the title band / fit-top video rect) wraps the
              // E3 per-item dip + keyframed box.
              return (
                <div
                  key={`${item.id}:${media.url}`}
                  className={`pointer-events-none absolute overflow-hidden ${underZ[`overlay:${item.id}`] == null ? 'z-[15]' : ''}`}
                  style={underZ[`overlay:${item.id}`] == null ? brollRegionStyle : { ...brollRegionStyle, zIndex: underZ[`overlay:${item.id}`] }}
                  data-testid="preview-broll"
                  data-broll-id={item.id}
                >
                  <div
                    ref={(el) => {
                      brollDipRefs.current[item.id] = el
                    }}
                    className="pointer-events-none absolute inset-0"
                    style={{ opacity: 0 }}
                    aria-hidden
                  />
                  <div
                    ref={(el) => {
                      brollBoxRefs.current[item.id] = el
                    }}
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                    style={{ visibility: 'hidden', transformOrigin: '50% 50%' }}
                    data-testid="preview-broll-layer"
                    data-broll-id={item.id}
                  >
                    {media.mediaType === 'image' ? (
                      <img
                        ref={(el) => {
                          brollImgRefs.current[item.id] = el
                        }}
                        src={media.url}
                        alt=""
                        draggable={false}
                        className="pointer-events-none absolute size-full object-cover"
                        style={{ inset: 0, opacity: 0 }}
                      />
                    ) : (
                      <BrollPreviewVideo
                        src={media.url}
                        videoRef={(el) => {
                          brollRefs.current[item.id] = el
                        }}
                        className="pointer-events-none absolute overflow-hidden"
                        style={{ inset: 0, opacity: 0 }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
        <ColorLookDefs specs={lookSpecs} />
        <TextItemsPreview
          edits={(audition?.edits ?? edits) as ClipEditsV2}
          underZ={underZ}
          boxH={box.h}
          selectedId={selectedTextId}
          elRef={(id, el) => {
            textRefs.current[id] = el
          }}
        />
        {!compositePreview && !(templatePreview && edits.exportTemplate?.headlineBar?.enabled) && !hookDupesCaptions ? (
          <HookOverlayPreview
            edits={edits as ClipEditsV2}
            boxW={box.w}
            boxH={box.h}
            elRef={(el) => {
              hookRef.current = el
            }}
          />
        ) : null}
        {!compositePreview && brandLogoUrl && brand.logoKey && (
          <img
            src={brandLogoUrl}
            alt=""
            className="pointer-events-none absolute z-[20]"
            style={{
              opacity: brand.logoOpacity ?? 0.9,
              width: `${brand.logoSizePct ?? 12}%`,
              top: pos.includes('T') ? 12 : undefined,
              bottom: pos.includes('B') ? 12 : undefined,
              left: pos.includes('L') ? 12 : undefined,
              right: pos.includes('R') ? 12 : undefined,
            }}
          />
        )}
        {!compositePreview && edits.captions?.enabled !== false && (
          <CaptionOverlay
            words={captionWords}
            currentTimeSec={captionTimeSec}
            edits={edits as ClipEditsV2}
            boxHeightPx={box.h}
            outputDurationSec={outputDurationFromEdits(previewEdits) / 1000}
            templateCaptionRect={
              templatePreview?.captionRect
                ? { y: templatePreview.captionRect.y, h: templatePreview.captionRect.h, playH: templatePreview.playH }
                : null
            }
          />
        )}
        {safeZoneVisible && box.w > 0 ? (
          <PreviewSafeZoneOverlay
            boxWidth={box.w}
            boxHeight={box.h}
            platform={(edits.exportTemplate?.exportPlatformId ?? 'tiktok') as ExportPlatformId}
          />
        ) : null}
        {templatePreview && edits.exportTemplate?.headlineBar?.enabled ? (
          <TemplateTitleOverlay
            spec={templatePreview}
            text={edits.exportTemplate.headlineBar.text?.trim() || edits.exportTemplate.suggestedHeadline?.trim() || ''}
            styleId={edits.exportTemplate.headlineStyle?.t6Id}
            headlineStyle={edits.exportTemplate.headlineStyle as { t6Id?: string; textColor?: string; font?: string } | undefined}
            boxWidth={box.w}
            fontFamily={headlinePreviewFontFamily('Anton')}
          />
        ) : null}
        {!compositePreview ? (
        <ExportTemplateOverlay
          hideHeadline={Boolean(templatePreview)}
          edits={edits as ClipEditsV2}
          boxWidth={box.w}
          boxHeight={box.h}
          channelDisplay={channelDisplay}
          chatPreviewEnabled={chatPreviewEnabled}
          outputMs={captionTimeSec * 1000}
          outputDurationMs={previewOutDurMs}
          onStickerMove={onStickerMove}
          composeSpec={composeSpec}
        />
        ) : null}
        {libassScripts ? (
          <Suspense fallback={null}>
            <LibassPreviewLayers
              scripts={libassScripts}
              playW={templatePreview?.playW ?? libassPlay.width}
              playH={templatePreview?.playH ?? libassPlay.height}
              clock={libassClock}
              onStatus={onLibassStatus}
            />
          </Suspense>
        ) : null}
        {canvas && !compositePreview && box.w > 0 ? (
          <CanvasSelectionOverlay
            edits={edits}
            baseEdits={canvas.baseEdits}
            box={stageBoxEl}
            getOutMs={getOutMs}
            getLayers={getCanvasLayers}
            selected={canvas.selected}
            onSelect={canvas.onSelect}
            onCommit={canvas.onCommit}
            cropMode={canvas.cropMode}
            onCropModeChange={canvas.onCropModeChange}
            readOnly={Boolean(audition)}
          />
        ) : null}
        {libassFailed ? (
          <p
            className="pointer-events-none absolute left-2 top-2 z-[30] rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/85"
            data-testid="libass-fallback-chip"
            title={`Text preview fell back to the approximate renderer (${libassFailed})`}
          >
            Approximate text preview
          </p>
        ) : null}
      </div>
      </LibassSinkContext.Provider>
    </div>
  )
}

export function seekToOutputMs(
  video: HTMLVideoElement,
  edits: ClipEditsV2,
  outputMs: number,
  mediaOffsetMs = 0,
) {
  const segs = orderedKeepSegments(edits)
  let acc = 0
  let target = edits.trim.in
  for (const [a, b] of segs) {
    const len = b - a
    if (outputMs < acc + len) {
      target = a + (outputMs - acc)
      break
    }
    acc += len
  }
  video.currentTime = videoTimeFromSourceMs(target, mediaOffsetMs)
}
