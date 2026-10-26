'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { ClipAudioMusic, ClipAudioSfx, ClipEditsAudio } from '@/lib/clips/audio'
import { DEFAULT_DUCK_DEPTH, DEFAULT_MUSIC_FADE_IN_MS, DEFAULT_MUSIC_FADE_OUT_MS, DEFAULT_MUSIC_VOLUME } from '@/lib/clips/audio'
import type { BrollItem } from '@/lib/clips/broll'
import {
  canonicalEditsJson,
  defaultEdits,
  mergeCutRanges,
  subtractRangeFromCuts,
  type ClipEditsV2,
  type CutRange,
} from '@/lib/clips/edits'
import type { ClipBounds } from '@/lib/clips/edits'
import { patchClip } from '@/lib/clips-api'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'

const MAX_UNDO = 100

type State = {
  edits: ClipEditsV2
  past: ClipEditsV2[]
  future: ClipEditsV2[]
  saveState: 'saved' | 'saving' | 'dirty'
}

type Action =
  | { type: 'set'; edits: ClipEditsV2; pushHistory?: boolean }
  | { type: 'APPLY_PATCH'; edits: ClipEditsV2 }
  /** Producer batch: always one undo step even when canonical edits match (e.g. no-op patch). */
  | { type: 'BATCH'; edits: ClipEditsV2 }
  | { type: 'undo' }
  | { type: 'redo' }
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
      const past = [...state.past, state.edits].slice(-MAX_UNDO)
      return { ...state, edits: action.edits, past, future: [], saveState: 'dirty' }
    }
    case 'undo': {
      if (!state.past.length) return state
      const prev = state.past[state.past.length - 1]
      return {
        edits: prev,
        past: state.past.slice(0, -1),
        future: [state.edits, ...state.future].slice(0, MAX_UNDO),
        saveState: 'dirty',
      }
    }
    case 'redo': {
      if (!state.future.length) return state
      const next = state.future[0]
      return {
        edits: next,
        past: [...state.past, state.edits].slice(-MAX_UNDO),
        future: state.future.slice(1),
        saveState: 'dirty',
      }
    }
    case 'saved':
      return { ...state, saveState: 'saved' }
    case 'saving':
      return { ...state, saveState: 'saving' }
    default:
      return state
  }
}

export function useEditorState(clipId: string, bounds: ClipBounds, initialEdits: ClipEditsV2) {
  const [state, dispatch] = useReducer(editorEditsReducer, {
    edits: initialEdits,
    past: [],
    future: [],
    saveState: 'saved',
  })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editsRef = useRef(state.edits)
  editsRef.current = state.edits

  const setEdits = useCallback((edits: ClipEditsV2, pushHistory = true) => {
    dispatch({ type: 'set', edits, pushHistory })
  }, [])

  /** One undo step for a full producer patch (not per-field). */
  const applyProducerPatch = useCallback((edits: ClipEditsV2) => {
    dispatch({ type: 'BATCH', edits })
  }, [])

  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])

  const addCutRange = useCallback(
    (range: CutRange) => {
      const cuts = mergeCutRanges([...state.edits.cutRanges, range])
      setEdits({ ...state.edits, cutRanges: cuts })
    },
    [setEdits, state.edits],
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
      setEdits({ ...state.edits, layout: { ...state.edits.layout, mode } })
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
      const kept = replace ? cur.filter((b) => b.placement !== 'auto') : cur
      const next = [...kept, ...items]
      setEdits({ ...state.edits, broll: next })
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
      const pad = 5000
      setEdits({
        ...state.edits,
        trim: {
          in: Math.max(bounds.clipStartMs - pad, trim.in),
          out: Math.min(bounds.clipEndMs + pad, trim.out),
        },
      })
    },
    [bounds.clipEndMs, bounds.clipStartMs, setEdits, state.edits],
  )

  useEffect(() => {
    if (state.saveState !== 'dirty') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      dispatch({ type: 'saving' })
      void patchClip(clipId, { edits: editsRef.current })
        .then(() => dispatch({ type: 'saved' }))
        .catch(() => dispatch({ type: 'saved' }))
    }, 1000)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [clipId, state.edits, state.saveState])

  return {
    edits: state.edits,
    setEdits,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    saveState: state.saveState,
    addCutRange,
    setWordFix,
    restoreWord,
    setLayoutMode,
    setShotOverride,
    setTrim,
    setCaptions,
    toggleEmphasis,
    mergeBroll,
    updateBrollItem,
    removeBroll,
    setAudio,
    setMusic,
    patchMusic,
    addSfx,
    updateSfx,
    removeSfx,
    attachMusicGeneration,
    resetEdits: () => setEdits(defaultEdits(bounds), false),
    applyProducerPatch,
    flushSave: () => {
      if (state.saveState === 'dirty') {
        dispatch({ type: 'saving' })
        void patchClip(clipId, { edits: editsRef.current })
          .then(() => dispatch({ type: 'saved' }))
          .catch(() => dispatch({ type: 'saved' }))
      }
    },
  }
}
