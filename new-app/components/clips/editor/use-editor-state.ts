'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { ClipAudioMusic, ClipAudioSfx, ClipEditsAudio, ClipStudioSound } from '@/lib/clips/audio'
import {
  DEFAULT_DUCK_DEPTH,
  DEFAULT_MUSIC_FADE_IN_MS,
  DEFAULT_MUSIC_FADE_OUT_MS,
  DEFAULT_MUSIC_VOLUME,
  DEFAULT_STUDIO_SOUND_MIX,
  normalizeAudioEdits,
} from '@/lib/clips/audio'
import type { BrollItem } from '@/lib/clips/broll'
import { isManualBroll } from '@/lib/clips/broll-auto-utils'
import {
  canonicalEditsJson,
  defaultEdits,
  editsPayloadForSave,
  mergeCutRanges,
  normalizeEdits,
  subtractRangeFromCuts,
  type ClipEditsV2,
  type CutRange,
} from '@/lib/clips/edits'
import type { ClipBounds } from '@/lib/clips/edits'
import { clampTrimToExtendedBounds } from '@/lib/clips/trim-bounds'
import { headlineBarAllowedForLayout } from '@/lib/clips/export-template'
import {
  cutRangeForLayoutSegmentAt,
  deleteLayoutSegmentAt,
  setLayoutModeForSegmentAt,
  splitLayoutSegmentAt,
  defaultLayoutSegments,
} from '@/lib/clips/layout-segments'
import { FetchJsonError } from '@/lib/client/fetch-json'
import { patchClip } from '@/lib/clips-api'
import {
  clearEditorAutosaveDraft,
  draftDiffersFromServer,
  readEditorAutosaveDraft,
  writeEditorAutosaveDraft,
} from '@/lib/clips/editor-autosave-draft'
import { sanitizeCutRangesForWords, snapCutRangeToWordGaps } from '@/lib/clips/word-cut'
import { mergeCleanupCutRanges } from '@/lib/clips/editor/cleanup-proposals'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'
import { mergeEditsThreeWay } from '@/lib/clips/edits-merge'
import { hasAnchoredContent, rippleAnchoredItems } from '@/lib/clips/editor/clip-timeline'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import {
  legacyFromLayers,
  resolveLayers,
  syncLayersFromLegacy,
  type Layer,
} from '@/lib/clips/layers'
import { toast } from 'sonner'

const MAX_UNDO = 100

export type ProducerStripState = { changeCount: number; expiresAt: number }

type State = {
  edits: ClipEditsV2
  past: ClipEditsV2[]
  future: ClipEditsV2[]
  saveState: 'saved' | 'saving' | 'dirty' | 'error'
  producerStrip: ProducerStripState | null
}

type Action =
  | { type: 'set'; edits: ClipEditsV2; pushHistory?: boolean }
  | { type: 'addCuts'; cutRanges: CutRange[] }
  | { type: 'APPLY_PATCH'; edits: ClipEditsV2 }
  /** Producer batch: always one undo step even when canonical edits match (e.g. no-op patch). */
  | { type: 'BATCH'; edits: ClipEditsV2; before?: ClipEditsV2; producerChangeCount?: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'clearProducerStrip' }
  | { type: 'saved'; clean: boolean }
  | { type: 'saving' }
  | { type: 'serverSync'; edits: ClipEditsV2 }
  | { type: 'needsSave' }
  | { type: 'saveFailed' }
  | { type: 'replaceRestore'; edits: ClipEditsV2 }
  | { type: 'hydrate'; edits: ClipEditsV2 }

function editsEqual(a: ClipEditsV2, b: ClipEditsV2) {
  return canonicalEditsJson(a) === canonicalEditsJson(b)
}

export function editorEditsReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set': {
      if (editsEqual(state.edits, action.edits)) return state
      const push = action.pushHistory !== false
      const past = push ? [...state.past, state.edits].slice(-MAX_UNDO) : state.past
      return { ...state, edits: action.edits, past, future: push ? [] : state.future, saveState: 'dirty' }
    }
    case 'addCuts': {
      const next = { ...state.edits, cutRanges: action.cutRanges }
      if (editsEqual(state.edits, next)) return state
      const past = [...state.past, state.edits].slice(-MAX_UNDO)
      return { ...state, edits: next, past, future: [], saveState: 'dirty' }
    }
    case 'APPLY_PATCH': {
      if (editsEqual(state.edits, action.edits)) return state
      const past = [...state.past, state.edits].slice(-MAX_UNDO)
      return { ...state, edits: action.edits, past, future: [], saveState: 'dirty' }
    }
    case 'BATCH': {
      const snap = action.before ?? state.edits
      const past = [...state.past, snap].slice(-MAX_UNDO)
      const n = action.producerChangeCount ?? 0
      const producerStrip =
        n > 0 ? { changeCount: n, expiresAt: Date.now() + 15_000 } : state.producerStrip
      return { ...state, edits: action.edits, past, future: [], saveState: 'dirty', producerStrip }
    }
    case 'clearProducerStrip':
      return { ...state, producerStrip: null }
    case 'undo': {
      if (!state.past.length) return state
      const prev = state.past[state.past.length - 1]
      return {
        ...state,
        edits: prev,
        past: state.past.slice(0, -1),
        future: [state.edits, ...state.future].slice(0, MAX_UNDO),
        saveState: 'dirty',
        producerStrip: state.producerStrip ? null : state.producerStrip,
      }
    }
    case 'redo': {
      if (!state.future.length) return state
      const next = state.future[0]
      return {
        ...state,
        edits: next,
        past: [...state.past, state.edits].slice(-MAX_UNDO),
        future: state.future.slice(1),
        saveState: 'dirty',
      }
    }
    case 'saved':
      return { ...state, saveState: action.clean ? 'saved' : 'dirty' }
    case 'saving':
      return { ...state, saveState: 'saving' }
    case 'serverSync':
      if (editsEqual(state.edits, action.edits)) {
        return { ...state, saveState: 'saved' }
      }
      return { ...state, edits: action.edits, saveState: 'saved' }
    case 'needsSave':
      return { ...state, saveState: 'dirty' }
    case 'saveFailed':
      return { ...state, saveState: 'error' }
    case 'replaceRestore': {
      if (editsEqual(state.edits, action.edits)) return { ...state, saveState: 'dirty' }
      const past = [...state.past, state.edits].slice(-MAX_UNDO)
      return { ...state, edits: action.edits, past, future: [], saveState: 'dirty' }
    }
    case 'hydrate': {
      if (editsEqual(state.edits, action.edits)) return { ...state, saveState: 'saved' }
      return { ...state, edits: action.edits, saveState: 'saved' }
    }
    default:
      return state
  }
}

export function useEditorState(
  clipId: string,
  bounds: ClipBounds,
  initialEdits: ClipEditsV2,
  opts?: { serverUpdatedAt?: string; editsSaveVersion?: number; words?: SourceWord[] },
) {
  const safeInitial = normalizeEdits(initialEdits, bounds)
  let draft = readEditorAutosaveDraft(clipId)
  if (
    draft &&
    opts?.serverUpdatedAt &&
    draft.serverUpdatedAt &&
    draft.serverUpdatedAt !== opts.serverUpdatedAt
  ) {
    clearEditorAutosaveDraft(clipId)
    draft = null
  }
  const draftDiffers = Boolean(draft && draftDiffersFromServer(draft, safeInitial))
  const restored = draftDiffers ? normalizeEdits(draft!.edits, bounds) : safeInitial
  const [state, dispatch] = useReducer(editorEditsReducer, {
    edits: restored,
    past: [],
    future: [],
    saveState: draftDiffers ? 'dirty' : 'saved',
    producerStrip: null,
  })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const localRevisionRef = useRef(draftDiffers ? 1 : 0)
  const savedRevisionRef = useRef(0)
  const saveInFlightRef = useRef(false)
  const savePendingRef = useRef(false)
  const serverUpdatedAtRef = useRef(opts?.serverUpdatedAt)
  const serverVersionRef = useRef(opts?.editsSaveVersion ?? 0)
  const saveBaseEditsRef = useRef<ClipEditsV2>(restored)
  const lastSavedEditsRef = useRef<ClipEditsV2>(restored)
  const wordsRef = useRef(opts?.words ?? [])
  wordsRef.current = opts?.words ?? wordsRef.current
  const editsRef = useRef(state.edits)
  editsRef.current = state.edits

  useEffect(() => {
    if (draftDiffers) {
      toast.message('Restored unsaved edits from this device')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, [])

  const bumpLocalRevision = useCallback(() => {
    localRevisionRef.current += 1
  }, [])

  /**
   * E2: when the EDL changes (transcript cuts, trim, reorder, silence trim) keep B-roll,
   * SFX and windowed music on the same source content, in the same undo step.
   * E3: also keyframes (on their item / source content) and cut transitions (on their cut).
   */
  const rippleFrom = useCallback((prev: ClipEditsV2, next: ClipEditsV2): ClipEditsV2 => {
    if (!hasAnchoredContent(next) && !hasAnchoredContent(prev)) return next
    const w = wordsRef.current
    return rippleAnchoredItems(prev, next, editorPreviewEdits(prev, w), editorPreviewEdits(next, w))
  }, [])

  const setEdits = useCallback((input: ClipEditsV2, pushHistory = true) => {
    const edits = rippleFrom(editsRef.current, input)
    if (editsEqual(editsRef.current, edits)) return
    editsRef.current = edits
    bumpLocalRevision()
    dispatch({ type: 'set', edits, pushHistory })
  }, [bumpLocalRevision, rippleFrom])

  const setCutRanges = useCallback(
    (cutRanges: CutRange[]) => {
      const next = { ...editsRef.current, cutRanges }
      if (editsEqual(editsRef.current, next)) return
      const rippled = rippleFrom(editsRef.current, next)
      editsRef.current = rippled
      bumpLocalRevision()
      if (rippled !== next) dispatch({ type: 'set', edits: rippled })
      else dispatch({ type: 'addCuts', cutRanges })
    },
    [bumpLocalRevision, rippleFrom],
  )

  /** One undo step for a full producer patch (not per-field). */
  const applyProducerPatch = useCallback(
    (edits: ClipEditsV2, before?: ClipEditsV2, producerChangeCount?: number) => {
      if (editsEqual(editsRef.current, edits)) return
      bumpLocalRevision()
      dispatch({ type: 'BATCH', edits, before, producerChangeCount })
    },
    [bumpLocalRevision],
  )

  const undo = useCallback(() => {
    bumpLocalRevision()
    dispatch({ type: 'undo' })
  }, [bumpLocalRevision])
  const redo = useCallback(() => {
    bumpLocalRevision()
    dispatch({ type: 'redo' })
  }, [bumpLocalRevision])
  const clearProducerStrip = useCallback(() => dispatch({ type: 'clearProducerStrip' }), [])

  const wordSpans = useCallback(() => {
    return wordsRef.current.map((w) => {
      const { startMs, endMs } = wordSourceMs(w)
      return { s: startMs / 1000, e: endMs / 1000, w: w.w }
    })
  }, [])

  const addCleanupCuts = useCallback(
    (ranges: CutRange[]) => {
      if (!ranges.length) return
      const spans = wordSpans()
      const cuts = mergeCleanupCutRanges(editsRef.current.cutRanges, ranges, spans)
      const nextEdits = { ...editsRef.current, cutRanges: cuts }
      if (editsEqual(editsRef.current, nextEdits)) return
      const rippled = rippleFrom(editsRef.current, nextEdits)
      editsRef.current = rippled
      bumpLocalRevision()
      if (rippled !== nextEdits) dispatch({ type: 'set', edits: rippled })
      else dispatch({ type: 'addCuts', cutRanges: cuts })
    },
    [bumpLocalRevision, rippleFrom, wordSpans],
  )

  const applyCleanupCut = useCallback(
    (range: CutRange) => {
      addCleanupCuts([range])
    },
    [addCleanupCuts],
  )

  const applyCleanupCuts = addCleanupCuts

  const setWordFix = useCallback(
    (index: number, text: string, meta?: { s: number; w: string }) => {
      const fixes = { ...state.edits.wordFixes }
      const fixMeta = { ...(state.edits.wordFixMeta ?? {}) }
      const key = String(index)
      if (!text.trim()) {
        delete fixes[key]
        delete fixMeta[key]
      } else {
        fixes[key] = text.trim()
        if (meta) fixMeta[key] = { s: meta.s, w: meta.w }
      }
      setEdits({
        ...state.edits,
        wordFixes: fixes,
        wordFixMeta: Object.keys(fixMeta).length ? fixMeta : undefined,
      })
    },
    [setEdits, state.edits],
  )

  const applyWordFixesBatch = useCallback(
    (
      fixes: Record<string, string>,
      meta: Record<string, { s: number; w: string }>,
      opts?: { vocabApplied?: string },
    ) => {
      const mergedFixes = { ...state.edits.wordFixes, ...fixes }
      const mergedMeta = { ...(state.edits.wordFixMeta ?? {}), ...meta }
      for (const k of Object.keys(mergedMeta)) {
        if (!(k in mergedFixes)) delete mergedMeta[k]
      }
      setEdits({
        ...state.edits,
        wordFixes: mergedFixes,
        wordFixMeta: Object.keys(mergedMeta).length ? mergedMeta : undefined,
        ...(opts?.vocabApplied ? { vocabApplied: opts.vocabApplied } : {}),
      })
    },
    [setEdits, state.edits],
  )

  const restoreWord = useCallback(
    (word: SourceWord) => {
      const { startMs, endMs } = wordSourceMs(word)
      const cuts = subtractRangeFromCuts(state.edits.cutRanges, [startMs, endMs])
      if (editsEqual(state.edits, { ...state.edits, cutRanges: cuts })) return
      setEdits({ ...state.edits, cutRanges: cuts })
    },
    [setEdits, state.edits],
  )

  const restoreCutRange = useCallback(
    (range: CutRange) => {
      const cuts = subtractRangeFromCuts(state.edits.cutRanges, range)
      if (editsEqual(state.edits, { ...state.edits, cutRanges: cuts })) return
      setEdits({ ...state.edits, cutRanges: cuts })
    },
    [setEdits, state.edits],
  )

  const setLayoutMode = useCallback(
    (
      mode: ClipEditsV2['layout']['mode'],
      facecam?: ClipEditsV2['layout']['facecam'],
    ) => {
      let next: ClipEditsV2 = {
        ...state.edits,
        layout: {
          ...state.edits.layout,
          mode,
          userPicked: true,
          layoutSegments: defaultLayoutSegments(state.edits.trim.in, state.edits.trim.out, mode),
          ...(facecam ? { facecam } : {}),
        },
      }
      const tpl = next.exportTemplate
      if (tpl?.headlineBar?.enabled && !headlineBarAllowedForLayout(mode)) {
        next = {
          ...next,
          exportTemplate: {
            ...tpl,
            headlineBar: { enabled: false, text: tpl.headlineBar?.text ?? '' },
          },
        }
      }
      setEdits(next)
    },
    [setEdits, state.edits],
  )

  const setShotOverride = useCallback(
    (i: number, focus: 'auto' | 'A' | 'B' | 'both') => {
      const rest = state.edits.layout.shotOverrides.filter((s) => s.i !== i)
      setEdits({
        ...state.edits,
        layout: { ...state.edits.layout, shotOverrides: [...rest, { i, focus }] },
      })
    },
    [setEdits, state.edits],
  )

  const setCaptions = useCallback(
    (captions: ClipEditsV2['captions']) => {
      const next = { ...state.edits, captions: { ...state.edits.captions, ...captions } }
      setEdits(state.edits.layersV === 3 ? syncLayersFromLegacy(next) : next)
    },
    [setEdits, state.edits],
  )

  const toggleEmphasis = useCallback(
    (wordIndex: number) => {
      const cur = state.edits.captions?.emphasis ?? []
      const has = cur.includes(wordIndex)
      const emphasis = has ? cur.filter((i) => i !== wordIndex) : [...cur, wordIndex]
      setEdits({
        ...state.edits,
        captions: { ...state.edits.captions, emphasis, keywordHighlight: true },
      })
    },
    [setEdits, state.edits],
  )

  const mergeBroll = useCallback(
    (items: BrollItem[], replace = false) => {
      const cur = state.edits.broll || []
      const kept = replace ? cur.filter(isManualBroll) : cur
      const next = [...kept, ...items]
      setEdits({ ...state.edits, broll: next })
    },
    [setEdits, state.edits],
  )

  const setBroll = useCallback(
    (items: BrollItem[]) => {
      setEdits({ ...state.edits, broll: items })
    },
    [setEdits, state.edits],
  )

  const updateBrollItem = useCallback(
    (id: string, patch: Partial<Pick<BrollItem, 'startMs' | 'endMs'>>) => {
      const next = (state.edits.broll || []).map((b) => (b.id === id ? { ...b, ...patch } : b))
      setEdits({ ...state.edits, broll: next })
    },
    [setEdits, state.edits],
  )

  const removeBroll = useCallback(
    (id: string) => {
      setEdits({ ...state.edits, broll: (state.edits.broll || []).filter((b) => b.id !== id) })
    },
    [setEdits, state.edits],
  )

  const setAudio = useCallback(
    (audio: ClipEditsAudio) => {
      setEdits({ ...state.edits, audio })
    },
    [setEdits, state.edits],
  )

  const patchStudioSound = useCallback(
    (studio: ClipStudioSound | null) => {
      const cur = normalizeAudioEdits(state.edits.audio)
      const nextAudio = { ...cur, studioSound: studio }
      const next = { ...state.edits, audio: nextAudio }
      if (editsEqual(state.edits, next)) return
      setEdits(next)
    },
    [setEdits, state.edits],
  )

  const setMusic = useCallback(
    (music: ClipAudioMusic | null) => {
      const cur = state.edits.audio || { music: null, sfx: [] }
      setEdits({ ...state.edits, audio: { ...cur, music } })
    },
    [setEdits, state.edits],
  )

  const patchMusic = useCallback(
    (patch: Partial<ClipAudioMusic>) => {
      const cur = state.edits.audio?.music
      if (!cur) return
      const audio = state.edits.audio || { music: null, sfx: [] }
      setEdits({ ...state.edits, audio: { ...audio, music: { ...cur, ...patch } } })
    },
    [setEdits, state.edits],
  )

  const addSfx = useCallback(
    (item: ClipAudioSfx) => {
      const cur = state.edits.audio || { music: null, sfx: [] }
      setEdits({ ...state.edits, audio: { ...cur, sfx: [...cur.sfx, item] } })
    },
    [setEdits, state.edits],
  )

  const updateSfx = useCallback(
    (generationId: string, patch: Partial<ClipAudioSfx>) => {
      const cur = state.edits.audio || { music: null, sfx: [] }
      setEdits({
        ...state.edits,
        audio: {
          ...cur,
          sfx: cur.sfx.map((s) => (s.generationId === generationId ? { ...s, ...patch } : s)),
        },
      })
    },
    [setEdits, state.edits],
  )

  const removeSfx = useCallback(
    (generationId: string) => {
      const cur = state.edits.audio || { music: null, sfx: [] }
      setEdits({
        ...state.edits,
        audio: { ...cur, sfx: cur.sfx.filter((s) => s.generationId !== generationId) },
      })
    },
    [setEdits, state.edits],
  )

  const attachMusicGeneration = useCallback(
    (generationId: string) => {
      setMusic({
        generationId,
        volume: DEFAULT_MUSIC_VOLUME,
        duckDepth: DEFAULT_DUCK_DEPTH,
        fadeInMs: DEFAULT_MUSIC_FADE_IN_MS,
        fadeOutMs: DEFAULT_MUSIC_FADE_OUT_MS,
      })
    },
    [setMusic],
  )

  const setTrim = useCallback(
    (trim: { in: number; out: number }) => {
      const media =
        bounds.trimMinMs != null && bounds.trimMaxMs != null
          ? { minMs: bounds.trimMinMs, maxMs: bounds.trimMaxMs }
          : undefined
      setEdits({
        ...state.edits,
        trim: clampTrimToExtendedBounds(bounds.clipStartMs, bounds.clipEndMs, trim, media),
      })
    },
    [bounds.clipEndMs, bounds.clipStartMs, bounds.trimMaxMs, bounds.trimMinMs, setEdits, state.edits],
  )

  const splitLayoutAtSource = useCallback(
    (sourceMs: number) => {
      setEdits(splitLayoutSegmentAt(state.edits, sourceMs))
    },
    [setEdits, state.edits],
  )

  const setLayoutModeAtSource = useCallback(
    (sourceMs: number, mode: ClipEditsV2['layout']['mode']) => {
      setEdits(setLayoutModeForSegmentAt(state.edits, sourceMs, mode))
    },
    [setEdits, state.edits],
  )

  const deleteLayoutSegmentAtSource = useCallback(
    (sourceMs: number) => {
      setEdits(deleteLayoutSegmentAt(state.edits, sourceMs))
    },
    [setEdits, state.edits],
  )

  const cutSectionAtSource = useCallback(
    (sourceMs: number) => {
      const range = cutRangeForLayoutSegmentAt(state.edits, sourceMs)
      if (!range) return
      const spans = wordSpans()
      const safe = spans.length ? snapCutRangeToWordGaps(range, spans) : range
      if (!safe) return
      const cuts = mergeCutRanges([...state.edits.cutRanges, safe])
      setEdits({ ...state.edits, cutRanges: cuts })
    },
    [setEdits, state.edits, wordSpans],
  )

  const processSaveQueue = useCallback(async () => {
    if (saveInFlightRef.current) {
      savePendingRef.current = true
      return
    }
    if (savedRevisionRef.current >= localRevisionRef.current) {
      dispatch({ type: 'saved', clean: true })
      return
    }

    saveInFlightRef.current = true
    dispatch({ type: 'saving' })
    const saveStartedAt = Date.now()
    let attempts = 0
    let conflicts = 0
    let failed = false
    try {
      while (savedRevisionRef.current < localRevisionRef.current) {
        attempts += 1
        if (editsEqual(editsRef.current, lastSavedEditsRef.current)) {
          savedRevisionRef.current = localRevisionRef.current
          break
        }
        const revisionAtSend = localRevisionRef.current
        saveBaseEditsRef.current = lastSavedEditsRef.current
        writeEditorAutosaveDraft(clipId, {
          edits: editsRef.current,
          savedAt: new Date().toISOString(),
          serverUpdatedAt: serverUpdatedAtRef.current,
        })
        try {
          const res = await patchClip(clipId, {
            edits: editsPayloadForSave(editsRef.current),
            baseVersion: serverVersionRef.current,
            expectedUpdatedAt: serverUpdatedAtRef.current,
          })
          if (res.updatedAt) serverUpdatedAtRef.current = res.updatedAt
          if (typeof res.editsSaveVersion === 'number') serverVersionRef.current = res.editsSaveVersion
          if (revisionAtSend !== localRevisionRef.current) {
            continue
          }
          clearEditorAutosaveDraft(clipId)
          savedRevisionRef.current = revisionAtSend
          lastSavedEditsRef.current = editsRef.current
          break
        } catch (err) {
          const transient =
            !(err instanceof FetchJsonError) ||
            [0, 408, 429, 500, 502, 503, 504].includes(err.status)
          if (transient && attempts < 4) {
            await new Promise((r) => setTimeout(r, 600 * 2 ** (attempts - 1)))
            continue
          }
          if (err instanceof FetchJsonError && err.status === 409 && err.conflictData) {
            conflicts += 1
            const data = err.conflictData as {
              edits?: ClipEditsV2
              updatedAt?: string
              editsSaveVersion?: number
              externalChange?: boolean
              merged?: boolean
            }
            if (data.updatedAt) serverUpdatedAtRef.current = data.updatedAt
            if (typeof data.editsSaveVersion === 'number') serverVersionRef.current = data.editsSaveVersion
            if (data.edits && revisionAtSend === localRevisionRef.current) {
              const base = saveBaseEditsRef.current
              const local = editsRef.current
              const server = normalizeEdits(data.edits, bounds)
              const { merged, externalChange } = mergeEditsThreeWay(base, local, server, bounds)
              dispatch({ type: 'serverSync', edits: merged })
              editsRef.current = merged
              savedRevisionRef.current = revisionAtSend
              if (externalChange) {
                toast.error('Edits were updated elsewhere — kept your changes where possible')
              }
              continue
            }
            continue
          }
          throw err
        }
      }
    } catch {
      failed = true
      dispatch({ type: 'saveFailed' })
      toast.error('Could not save edits')
    } finally {
      saveInFlightRef.current = false
      const pending = savePendingRef.current
      savePendingRef.current = false
      console.info('[clipper:editor] save', {
        ms: Date.now() - saveStartedAt,
        attempts,
        conflicts,
      })
      if (!failed) {
        dispatch({
          type: 'saved',
          clean: savedRevisionRef.current >= localRevisionRef.current,
        })
      }
      if (savedRevisionRef.current < localRevisionRef.current) {
        dispatch({ type: 'needsSave' })
      }
      if (pending && savedRevisionRef.current < localRevisionRef.current) {
        void processSaveQueue()
      }
    }
  }, [bounds, clipId])

  useEffect(() => {
    if (state.saveState !== 'dirty') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void processSaveQueue()
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [clipId, processSaveQueue, state.edits, state.saveState])

  useEffect(() => {
    const retrySave = () => {
      if (savedRevisionRef.current < localRevisionRef.current) {
        void processSaveQueue()
      }
    }
    window.addEventListener('online', retrySave)
    const onVis = () => {
      if (document.visibilityState === 'visible') retrySave()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('online', retrySave)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [processSaveQueue])

  useEffect(() => {
    if (!state.producerStrip) return
    const ms = state.producerStrip.expiresAt - Date.now()
    if (ms <= 0) {
      dispatch({ type: 'clearProducerStrip' })
      return
    }
    const t = setTimeout(() => dispatch({ type: 'clearProducerStrip' }), ms)
    return () => clearTimeout(t)
  }, [state.producerStrip])

  const cancelPendingAutosave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  const applyRestoredEdits = useCallback(
    (restored: ClipEditsV2) => {
      cancelPendingAutosave()
      bumpLocalRevision()
      const normalized = normalizeEdits(restored, bounds)
      editsRef.current = normalized
      saveBaseEditsRef.current = normalized
      dispatch({ type: 'replaceRestore', edits: normalized })
      void processSaveQueue()
    },
    [bounds, bumpLocalRevision, cancelPendingAutosave, processSaveQueue],
  )

  const setLayers = useCallback(
    (layers: Layer[]) => {
      const merged = legacyFromLayers(layers, editsRef.current)
      setEdits({ ...merged, layersV: 3, layers })
    },
    [setEdits],
  )

  const hydrateEdits = useCallback(
    (next: ClipEditsV2) => {
      const normalized = normalizeEdits(next, bounds)
      if (editsEqual(editsRef.current, normalized)) return
      editsRef.current = normalized
      lastSavedEditsRef.current = normalized
      saveBaseEditsRef.current = normalized
      dispatch({ type: 'hydrate', edits: normalized })
    },
    [bounds],
  )

  return {
    edits: state.edits,
    layers: resolveLayers(state.edits),
    setLayers,
    setEdits,
    hydrateEdits,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    saveState: state.saveState,
    producerStrip: state.producerStrip,
    clearProducerStrip,
    applyCleanupCut,
    applyCleanupCuts,
    setCutRanges,
    setWordFix,
    applyWordFixesBatch,
    restoreWord,
    restoreCutRange,
    setLayoutMode,
    setShotOverride,
    setTrim,
    setCaptions,
    toggleEmphasis,
    mergeBroll,
    setBroll,
    updateBrollItem,
    removeBroll,
    setAudio,
    patchStudioSound,
    setMusic,
    patchMusic,
    addSfx,
    updateSfx,
    removeSfx,
    attachMusicGeneration,
    splitLayoutAtSource,
    setLayoutModeAtSource,
    deleteLayoutSegmentAtSource,
    cutSectionAtSource,
    resetEdits: () => setEdits(defaultEdits(bounds), false),
    applyProducerPatch,
    applyRestoredEdits,
    syncServerUpdatedAt: (iso: string) => {
      serverUpdatedAtRef.current = iso
    },
    syncEditsSaveVersion: (v: number) => {
      serverVersionRef.current = v
    },
    flushSave: () => {
      if (savedRevisionRef.current >= localRevisionRef.current) {
        return Promise.resolve()
      }
      return processSaveQueue().then(() => {
        if (savedRevisionRef.current < localRevisionRef.current) {
          throw new Error('Could not save edits')
        }
      })
    },
  }
}
