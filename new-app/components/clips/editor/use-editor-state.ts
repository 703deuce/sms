'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { ClipAudioMusic, ClipAudioSfx, ClipEditsAudio, ClipStudioSound } from '@/lib/clips/audio'
import { addVoiceoverClip } from '@/lib/clips/editor/recording'
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
import {
  nextClientSaveSeq,
  saveSyncRequired,
  shouldApplySaveResponse,
  shouldDiscardDraftForServerStamp,
} from '@/lib/clips/editor-save-order'
import { toast } from 'sonner'

const MAX_UNDO = 100

export type ProducerStripState = { changeCount: number; expiresAt: number }

type State = {
  edits: ClipEditsV2
  past: ClipEditsV2[]
  pastLabels: (string | undefined)[]
  future: ClipEditsV2[]
  saveState: 'saved' | 'saving' | 'dirty' | 'error'
  producerStrip: ProducerStripState | null
}

type Action =
  | { type: 'set'; edits: ClipEditsV2; pushHistory?: boolean }
  | { type: 'addCuts'; cutRanges: CutRange[] }
  | { type: 'APPLY_PATCH'; edits: ClipEditsV2 }
  /** Single undo step with a named label (PR-16 / AI_QUALITY Q2). */
  | { type: 'pass'; edits: ClipEditsV2; label: string }
  /** Producer batch: always one undo step even when canonical edits match (e.g. no-op patch). */
  | { type: 'BATCH'; edits: ClipEditsV2; before?: ClipEditsV2; producerChangeCount?: number; label?: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'clearProducerStrip' }
  | { type: 'saved'; clean: boolean }
  | { type: 'saving' }
  | { type: 'serverSync'; edits: ClipEditsV2 }
  | { type: 'needsSave' }
  | { type: 'saveFailed' }
  | { type: 'replaceRestore'; edits: ClipEditsV2; recordUndo?: boolean }
  | { type: 'hydrate'; edits: ClipEditsV2 }
  | { type: 'resetHistory' }

function editsEqual(a: ClipEditsV2, b: ClipEditsV2) {
  return canonicalEditsJson(a) === canonicalEditsJson(b)
}

function pushPast(state: State, snap: ClipEditsV2, label?: string): Pick<State, 'past' | 'pastLabels' | 'future'> {
  return {
    past: [...state.past, snap].slice(-MAX_UNDO),
    pastLabels: [...state.pastLabels, label].slice(-MAX_UNDO),
    future: [],
  }
}

export function editorEditsReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set': {
      if (editsEqual(state.edits, action.edits)) return state
      const push = action.pushHistory !== false
      const pastBlock = push ? pushPast(state, state.edits) : { past: state.past, pastLabels: state.pastLabels, future: state.future }
      return { ...state, edits: action.edits, ...pastBlock, future: push ? [] : state.future, saveState: 'dirty' }
    }
    case 'addCuts': {
      const next = { ...state.edits, cutRanges: action.cutRanges }
      if (editsEqual(state.edits, next)) return state
      return { ...state, edits: next, ...pushPast(state, state.edits), saveState: 'dirty' }
    }
    case 'APPLY_PATCH': {
      if (editsEqual(state.edits, action.edits)) return state
      return { ...state, edits: action.edits, ...pushPast(state, state.edits), saveState: 'dirty' }
    }
    case 'pass': {
      if (editsEqual(state.edits, action.edits)) return state
      return { ...state, edits: action.edits, ...pushPast(state, state.edits, action.label), saveState: 'dirty' }
    }
    case 'BATCH': {
      const snap = action.before ?? state.edits
      const n = action.producerChangeCount ?? 0
      const producerStrip =
        n > 0 ? { changeCount: n, expiresAt: Date.now() + 15_000 } : state.producerStrip
      return {
        ...state,
        edits: action.edits,
        ...pushPast(state, snap, action.label ?? (n > 0 ? `Producer · ${n} change(s)` : 'Producer')),
        saveState: 'dirty',
        producerStrip,
      }
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
        pastLabels: state.pastLabels.slice(0, -1),
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
        pastLabels: [...state.pastLabels, undefined].slice(-MAX_UNDO),
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
      const record = action.recordUndo !== false
      const pastBlock = record ? pushPast(state, state.edits) : { past: state.past, pastLabels: state.pastLabels, future: state.future }
      return {
        ...state,
        edits: action.edits,
        ...pastBlock,
        future: record ? [] : state.future,
        saveState: 'dirty',
      }
    }
    case 'hydrate': {
      if (editsEqual(state.edits, action.edits)) return { ...state, saveState: 'saved', past: [], pastLabels: [], future: [] }
      return { ...state, edits: action.edits, saveState: 'saved', past: [], pastLabels: [], future: [] }
    }
    case 'resetHistory':
      if (!state.past.length && !state.future.length) return state
      return { ...state, past: [], pastLabels: [], future: [] }
    default:
      return state
  }
}

export function useEditorState(
  clipId: string,
  bounds: ClipBounds,
  initialEdits: ClipEditsV2,
  opts?: { serverUpdatedAt?: string; editsSaveVersion?: number; words?: SourceWord[]; editorSaveSeq?: number },
) {
  const safeInitial = normalizeEdits(initialEdits, bounds)
  let draft = readEditorAutosaveDraft(clipId)
  if (draft && !draftDiffersFromServer(draft, safeInitial)) {
    clearEditorAutosaveDraft(clipId)
    draft = null
  }
  if (
    draft &&
    shouldDiscardDraftForServerStamp(
      draft.serverUpdatedAt,
      opts?.serverUpdatedAt,
      draft.localRevision,
      draftDiffersFromServer(draft, safeInitial),
    )
  ) {
    clearEditorAutosaveDraft(clipId)
    draft = null
  }
  const draftDiffers = Boolean(draft && draftDiffersFromServer(draft, safeInitial))
  const restored = draftDiffers ? normalizeEdits(draft!.edits, bounds) : safeInitial
  const restoredLocalRevision = draftDiffers ? Math.max(1, draft!.localRevision ?? 1) : 0
  const restoredSaveSeq = draftDiffers ? Math.max(0, draft!.saveSeq ?? 0) : 0
  const serverSaveSeq = typeof opts?.editorSaveSeq === 'number' ? opts.editorSaveSeq : 0
  const [state, dispatch] = useReducer(editorEditsReducer, {
    edits: restored,
    past: [],
    pastLabels: [],
    future: [],
    saveState: draftDiffers ? 'dirty' : 'saved',
    producerStrip: null,
  })
  /** TC4fix: undo is user-session only — nothing before first editor gesture counts (load seeds, draft). */
  const [historyReady, setHistoryReady] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const localRevisionRef = useRef(restoredLocalRevision)
  const savedRevisionRef = useRef(0)
  const saveInFlightRef = useRef(false)
  const savePendingRef = useRef(false)
  const saveSeqRef = useRef(nextClientSaveSeq(Math.max(restoredSaveSeq, serverSaveSeq, 0) - 1))
  const serverConfirmedEditsRef = useRef<ClipEditsV2>(restored)
  const serverUpdatedAtRef = useRef(opts?.serverUpdatedAt)
  const serverVersionRef = useRef(opts?.editsSaveVersion ?? 0)
  const saveBaseEditsRef = useRef<ClipEditsV2>(restored)
  const lastSavedEditsRef = useRef<ClipEditsV2>(restored)
  const wordsRef = useRef(opts?.words ?? [])
  wordsRef.current = opts?.words ?? wordsRef.current
  const editsRef = useRef(state.edits)
  editsRef.current = state.edits
  const historyRef = useRef({ past: state.past, future: state.future })
  historyRef.current = { past: state.past, future: state.future }

  useEffect(() => {
    if (draftDiffers) {
      toast.message('Restored unsaved edits from this device')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, [])

  // TC4fix: fresh load / bfcache restore must not keep pre-reload undo stacks (draft restores content only).
  useEffect(() => {
    setHistoryReady(false)
    dispatch({ type: 'resetHistory' })
    const arm = () => setHistoryReady(true)
    window.addEventListener('pointerdown', arm, { once: true, capture: true })
    window.addEventListener('keydown', arm, { once: true, capture: true })
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return
      setHistoryReady(false)
      dispatch({ type: 'resetHistory' })
    }
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.removeEventListener('pointerdown', arm, { capture: true })
      window.removeEventListener('keydown', arm, { capture: true })
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [clipId])

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
    if (pushHistory) setHistoryReady(true)
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

  const setEditsPass = useCallback(
    (input: ClipEditsV2, label: string) => {
      const edits = rippleFrom(editsRef.current, input)
      if (editsEqual(editsRef.current, edits)) return
      editsRef.current = edits
      setHistoryReady(true)
      bumpLocalRevision()
      dispatch({ type: 'pass', edits, label })
    },
    [bumpLocalRevision, rippleFrom],
  )

  /** One undo step for a full producer patch (not per-field). */
  const applyProducerPatch = useCallback(
    (edits: ClipEditsV2, before?: ClipEditsV2, producerChangeCount?: number, label?: string) => {
      if (editsEqual(editsRef.current, edits)) return
      setHistoryReady(true)
      bumpLocalRevision()
      dispatch({ type: 'BATCH', edits, before, producerChangeCount, label })
    },
    [bumpLocalRevision],
  )

  const undo = useCallback(() => {
    if (!historyRef.current.past.length) return
    setHistoryReady(true)
    const prev = historyRef.current.past[historyRef.current.past.length - 1]!
    editsRef.current = prev
    bumpLocalRevision()
    dispatch({ type: 'undo' })
  }, [bumpLocalRevision])
  const redo = useCallback(() => {
    if (!historyRef.current.future.length) return
    setHistoryReady(true)
    const next = historyRef.current.future[0]!
    editsRef.current = next
    bumpLocalRevision()
    dispatch({ type: 'redo' })
  }, [bumpLocalRevision])

  const jumpHistory = useCallback(
    (steps: number) => {
      if (!steps) return
      setHistoryReady(true)
      let past = historyRef.current.past
      let future = historyRef.current.future
      let edits = editsRef.current
      if (steps < 0) {
        const k = Math.min(-steps, past.length)
        for (let i = 0; i < k; i++) {
          const prev = past[past.length - 1]!
          future = [edits, ...future].slice(0, MAX_UNDO)
          edits = prev
          past = past.slice(0, -1)
        }
      } else {
        const k = Math.min(steps, future.length)
        for (let i = 0; i < k; i++) {
          const next = future[0]!
          past = [...past, edits].slice(-MAX_UNDO)
          edits = next
          future = future.slice(1)
        }
      }
      editsRef.current = edits
      bumpLocalRevision()
      const n = Math.abs(steps)
      for (let i = 0; i < n; i++) {
        dispatch({ type: steps < 0 ? 'undo' : 'redo' })
      }
    },
    [bumpLocalRevision],
  )

  const clearProducerStrip = useCallback(() => dispatch({ type: 'clearProducerStrip' }), [])

  const wordSpans = useCallback(() => {
    return wordsRef.current.map((w) => {
      const { startMs, endMs } = wordSourceMs(w)
      return { s: startMs / 1000, e: endMs / 1000, w: w.w }
    })
  }, [])

  const addCleanupCuts = useCallback(
    (ranges: CutRange[], passLabel?: string) => {
      if (!ranges.length) return
      const spans = wordSpans()
      const cuts = mergeCleanupCutRanges(editsRef.current.cutRanges, ranges, spans)
      const nextEdits = { ...editsRef.current, cutRanges: cuts }
      if (editsEqual(editsRef.current, nextEdits)) return
      const rippled = rippleFrom(editsRef.current, nextEdits)
      editsRef.current = rippled
      bumpLocalRevision()
      setHistoryReady(true)
      if (passLabel) {
        dispatch({ type: 'pass', edits: rippled, label: passLabel })
        return
      }
      if (rippled !== nextEdits) dispatch({ type: 'set', edits: rippled })
      else dispatch({ type: 'addCuts', cutRanges: cuts })
    },
    [bumpLocalRevision, rippleFrom, wordSpans],
  )

  const applyCleanupCut = useCallback(
    (range: CutRange, passLabel?: string) => {
      addCleanupCuts([range], passLabel)
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
      const next: ClipEditsV2 = {
        ...state.edits,
        wordFixes: fixes,
        wordFixMeta: Object.keys(fixMeta).length ? fixMeta : undefined,
      }
      const rippled = rippleFrom(editsRef.current, next)
      if (editsEqual(editsRef.current, rippled)) return
      editsRef.current = rippled
      setHistoryReady(true)
      bumpLocalRevision()
      dispatch({ type: 'pass', edits: rippled, label: 'Word fix' })
    },
    [bumpLocalRevision, rippleFrom, state.edits],
  )

  const applyWordFixesBatch = useCallback(
    (
      fixes: Record<string, string>,
      meta: Record<string, { s: number; w: string }>,
      opts?: { vocabApplied?: string; pushHistory?: boolean },
    ) => {
      const mergedFixes = { ...state.edits.wordFixes, ...fixes }
      const mergedMeta = { ...(state.edits.wordFixMeta ?? {}), ...meta }
      for (const k of Object.keys(mergedMeta)) {
        if (!(k in mergedFixes)) delete mergedMeta[k]
      }
      setEdits(
        {
          ...state.edits,
          wordFixes: mergedFixes,
          wordFixMeta: Object.keys(mergedMeta).length ? mergedMeta : undefined,
          ...(opts?.vocabApplied ? { vocabApplied: opts.vocabApplied } : {}),
        },
        opts?.pushHistory ?? true,
      )
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

  const placeVoiceoverClip = useCallback(
    (uploadId: string, atMs: number, durMs: number) => {
      setEditsPass(addVoiceoverClip(state.edits, uploadId, atMs, durMs, () => crypto.randomUUID()), 'AI voiceover')
    },
    [setEditsPass, state.edits],
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
    let staleRejections = 0
    try {
      while (saveSyncRequired(savedRevisionRef.current, localRevisionRef.current)) {
        attempts += 1
        const revisionAtSend = localRevisionRef.current
        saveSeqRef.current = nextClientSaveSeq(saveSeqRef.current)
        const saveSeqAtSend = saveSeqRef.current
        saveBaseEditsRef.current = lastSavedEditsRef.current
        writeEditorAutosaveDraft(clipId, {
          edits: editsRef.current,
          savedAt: new Date().toISOString(),
          localRevision: localRevisionRef.current,
          saveSeq: saveSeqAtSend,
          serverUpdatedAt: serverUpdatedAtRef.current,
        })
        try {
          const res = await patchClip(clipId, {
            edits: editsPayloadForSave(editsRef.current),
            baseVersion: serverVersionRef.current,
            expectedUpdatedAt: serverUpdatedAtRef.current,
            clientSaveSeq: saveSeqAtSend,
            clientLocalRevision: revisionAtSend,
          })
          if (res.applied === false) {
            staleRejections += 1
            if (typeof (res as { storedSeq?: number }).storedSeq === 'number') {
              saveSeqRef.current = Math.max(saveSeqRef.current, (res as { storedSeq: number }).storedSeq)
            }
            saveSeqRef.current = nextClientSaveSeq(saveSeqRef.current)
            if (staleRejections >= 2) {
              failed = true
              break
            }
            continue
          }
          if (
            !shouldApplySaveResponse(
              saveSeqAtSend,
              saveSeqRef.current,
              revisionAtSend,
              localRevisionRef.current,
            )
          ) {
            continue
          }
          if (res.updatedAt) serverUpdatedAtRef.current = res.updatedAt
          if (typeof res.editsSaveVersion === 'number') serverVersionRef.current = res.editsSaveVersion
          clearEditorAutosaveDraft(clipId)
          savedRevisionRef.current = revisionAtSend
          lastSavedEditsRef.current = editsRef.current
          serverConfirmedEditsRef.current = editsRef.current
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
            // E6: bounded — a server that keeps answering 409 must not spin this loop forever.
            if (conflicts > 4) throw err
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
              // E6: the server now holds `server`, not `merged`. Previously the revision was marked
              // saved here, so the loop exited without PATCHing the merge and the user's edit (e.g. the
              // headline toggle racing the export-headline prefetch write) was lost on reload. Treat the
              // server copy as the new base and let the loop send the merged edits.
              lastSavedEditsRef.current = server
              serverConfirmedEditsRef.current = server
              if (editsEqual(merged, server)) savedRevisionRef.current = revisionAtSend
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

  // TC4b + TC4fix2: always persist the newest revision on leave (draft + keepalive), even behind an in-flight save.
  useEffect(() => {
    const leaveRevisionSentRef = { current: null as number | null }
    const onLeave = () => {
      if (!saveSyncRequired(savedRevisionRef.current, localRevisionRef.current)) return
      if (localRevisionRef.current === leaveRevisionSentRef.current) return
      leaveRevisionSentRef.current = localRevisionRef.current
      if (debounceRef.current) clearTimeout(debounceRef.current)
      saveSeqRef.current = nextClientSaveSeq(saveSeqRef.current)
      const leaveSeq = saveSeqRef.current
      const inFlight = saveInFlightRef.current
      writeEditorAutosaveDraft(clipId, {
        edits: editsRef.current,
        savedAt: new Date().toISOString(),
        localRevision: localRevisionRef.current,
        saveSeq: leaveSeq,
        ...(inFlight ? {} : { serverUpdatedAt: serverUpdatedAtRef.current }),
      })
      const payload = {
        edits: editsPayloadForSave(editsRef.current),
        clientSaveSeq: leaveSeq,
        clientLocalRevision: localRevisionRef.current,
        ...(inFlight ? {} : { baseVersion: serverVersionRef.current, expectedUpdatedAt: serverUpdatedAtRef.current }),
      }
      const body = JSON.stringify(payload)
      if (body.length > 60_000) {
        console.warn('[clipper:editor] keepalive skipped: body exceeds keepalive limit')
        return
      }
      void fetch(`/api/clips/clips/${clipId}`, {
        method: 'PATCH',
        keepalive: true,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body,
      }).catch(() => {})
    }
    window.addEventListener('pagehide', onLeave)
    window.addEventListener('beforeunload', onLeave)
    return () => {
      window.removeEventListener('pagehide', onLeave)
      window.removeEventListener('beforeunload', onLeave)
    }
  }, [clipId])

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
      setHistoryReady(true)
      cancelPendingAutosave()
      bumpLocalRevision()
      const normalized = normalizeEdits(restored, bounds)
      editsRef.current = normalized
      saveBaseEditsRef.current = normalized
      dispatch({ type: 'replaceRestore', edits: normalized, recordUndo: true })
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
      serverConfirmedEditsRef.current = normalized
      dispatch({ type: 'hydrate', edits: normalized })
    },
    [bounds],
  )

  return {
    edits: state.edits,
    layers: resolveLayers(state.edits),
    setLayers,
    setEdits,
    setEditsPass,
    hydrateEdits,
    undo,
    redo,
    jumpHistory,
    historyPast: state.past,
    historyPastLabels: state.pastLabels,
    historyFuture: state.future,
    canUndo: historyReady && state.past.length > 0,
    canRedo: historyReady && state.future.length > 0,
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
    placeVoiceoverClip,
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
