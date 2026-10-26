'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'
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
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'saved' }
  | { type: 'saving' }

function editsEqual(a: ClipEditsV2, b: ClipEditsV2) {
  return canonicalEditsJson(a) === canonicalEditsJson(b)
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set': {
      if (editsEqual(state.edits, action.edits)) return state
      const push = action.pushHistory !== false
      const past = push ? [...state.past, state.edits].slice(-MAX_UNDO) : state.past
      return { ...state, edits: action.edits, past, future: push ? [] : state.future, saveState: 'dirty' }
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
  const [state, dispatch] = useReducer(reducer, {
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
    resetEdits: () => setEdits(defaultEdits(bounds), false),
  }
}
