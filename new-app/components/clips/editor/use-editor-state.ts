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
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'
import { toast } from 'sonner'

const MAX_UNDO = 100

export type ProducerStripState = { changeCount: number; expiresAt: number }

type State = {
  edits: ClipEditsV2
  past: ClipEditsV2[]
  future: ClipEditsV2[]
  saveState: 'saved' | 'saving' | 'dirty'
  producerStrip: ProducerStripState | null
}

type Action =
  | { type: 'set'; edits: ClipEditsV2; pushHistory?: boolean }
  | { type: 'APPLY_PATCH'; edits: ClipEditsV2 }
  /** Producer batch: always one undo step even when canonical edits match (e.g. no-op patch). */
  | { type: 'BATCH'; edits: ClipEditsV2; before?: ClipEditsV2; producerChangeCount?: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'clearProducerStrip' }
  | { type: 'saved' }
  | { type: 'saving' }

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
      return { ...state, saveState: state.saveState === 'dirty' ? 'dirty' : 'saved' }
    case 'saving':
      return { ...state, saveState: 'saving' }
    default:
      return state
  }
}

export function useEditorState(
  clipId: string,
  bounds: ClipBounds,
  initialEdits: ClipEditsV2,
  opts?: { serverUpdatedAt?: string; words?: SourceWord[] },
) {
  const safeInitial = normalizeEdits(initialEdits, bounds)
  const draft = readEditorAutosaveDraft(clipId)
  const restored =
    draft && draftDiffersFromServer(draft, safeInitial) ? normalizeEdits(draft.edits, bounds) : safeInitial
  const [state, dispatch] = useReducer(editorEditsReducer, {
    edits: restored,
    past: [],
    future: [],
    saveState: draft && draftDiffersFromServer(draft, safeInitial) ? 'dirty' : 'saved',
    producerStrip: null,
  })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveGenRef = useRef(0)
  const serverUpdatedAtRef = useRef(opts?.serverUpdatedAt)
  const wordsRef = useRef(opts?.words ?? [])
  wordsRef.current = opts?.words ?? wordsRef.current
  const editsRef = useRef(state.edits)
  editsRef.current = state.edits

  useEffect(() => {
    if (draft && draftDiffersFromServer(draft, safeInitial)) {
      toast.message('Restored unsaved edits from this device')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, [])

  const setEdits = useCallback((edits: ClipEditsV2, pushHistory = true) => {
    dispatch({ type: 'set', edits, pushHistory })
  }, [])

  /** One undo step for a full producer patch (not per-field). */
  const applyProducerPatch = useCallback(
    (edits: ClipEditsV2, before?: ClipEditsV2, producerChangeCount?: number) => {
      dispatch({ type: 'BATCH', edits, before, producerChangeCount })
    },
    [],
  )

  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const clearProducerStrip = useCallback(() => dispatch({ type: 'clearProducerStrip' }), [])

  const wordSpans = useCallback(() => {
    return wordsRef.current.map((w) => {
      const { startMs, endMs } = wordSourceMs(w)
      return { s: startMs / 1000, e: endMs / 1000, w: w.w }
    })
  }, [])

  const addCutRange = useCallback(
    (range: CutRange) => {
      const spans = wordSpans()
      const snapped = spans.length ? snapCutRangeToWordGaps(range, spans) ?? range : range
      const nextRange = spans.length ? sanitizeCutRangesForWords([snapped], spans)[0] ?? snapped : snapped
      const cuts = mergeCutRanges([...state.edits.cutRanges, nextRange])
      setEdits({ ...state.edits, cutRanges: cuts })
    },
    [setEdits, state.edits, wordSpans],
  )

  const setWordFix = useCallback(
    (index: number, text: string) => {
      const fixes = { ...state.edits.wordFixes }
      if (!text.trim()) delete fixes[String(index)]
      else fixes[String(index)] = text.trim()
      setEdits({
        ...state.edits,
        wordFixes: fixes,
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

  const setLayoutMode = useCallback(
    (mode: ClipEditsV2['layout']['mode']) => {
      let next: ClipEditsV2 = { ...state.edits, layout: { ...state.edits.layout, mode } }
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
      setEdits({ ...state.edits, captions: { ...state.edits.captions, ...captions } })
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
      setEdits({
        ...state.edits,
        audio: { ...cur, studioSound: studio },
      })
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
      setEdits({
        ...state.edits,
        trim: clampTrimToExtendedBounds(bounds.clipStartMs, bounds.clipEndMs, trim),
      })
    },
    [bounds.clipEndMs, bounds.clipStartMs, setEdits, state.edits],
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

  const persistEdits = useCallback(async () => {
    const gen = saveGenRef.current
    try {
      const res = await patchClip(clipId, {
        edits: editsRef.current,
        expectedUpdatedAt: serverUpdatedAtRef.current,
      })
      if (res.updatedAt) serverUpdatedAtRef.current = res.updatedAt
      clearEditorAutosaveDraft(clipId)
      if (gen === saveGenRef.current) dispatch({ type: 'saved' })
      return res
    } catch (err) {
      if (err instanceof FetchJsonError && err.status === 409 && err.conflictData) {
        const data = err.conflictData as { edits?: ClipEditsV2; updatedAt?: string }
        if (data.edits) {
          dispatch({ type: 'set', edits: normalizeEdits(data.edits, bounds), pushHistory: false })
          if (data.updatedAt) serverUpdatedAtRef.current = data.updatedAt
          toast.error('Edits were updated elsewhere — loaded the latest saved version')
        }
      }
      if (gen === saveGenRef.current) dispatch({ type: 'saved' })
      throw err
    }
  }, [bounds, clipId])

  useEffect(() => {
    if (state.saveState !== 'dirty') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const savingUi = setTimeout(() => dispatch({ type: 'saving' }), 250)
    debounceRef.current = setTimeout(() => {
      const gen = ++saveGenRef.current
      dispatch({ type: 'saving' })
      writeEditorAutosaveDraft(clipId, {
        edits: editsRef.current,
        savedAt: new Date().toISOString(),
        serverUpdatedAt: serverUpdatedAtRef.current,
      })
      void persistEdits().catch(() => {})
    }, 450)
    return () => {
      clearTimeout(savingUi)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [clipId, persistEdits, state.edits, state.saveState])

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

  return {
    edits: state.edits,
    setEdits,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    saveState: state.saveState,
    producerStrip: state.producerStrip,
    clearProducerStrip,
    addCutRange,
    setWordFix,
    restoreWord,
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
    flushSave: () => {
      if (state.saveState === 'dirty' || state.saveState === 'saving') {
        const gen = ++saveGenRef.current
        dispatch({ type: 'saving' })
        return persistEdits()
          .then(() => undefined)
          .catch(() => {
            throw new Error('Could not save edits')
          })
      }
      return Promise.resolve()
    },
  }
}
