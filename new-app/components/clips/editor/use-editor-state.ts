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
import { mergeEditsThreeWay } from '@/lib/clips/edits-merge'
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
  | { type: 'serverSync'; edits: ClipEditsV2 }
  | { type: 'needsSave' }

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
    case 'serverSync':
      if (editsEqual(state.edits, action.edits)) {
        return { ...state, saveState: 'saved' }
      }
      return { ...state, edits: action.edits, saveState: 'saved' }
    case 'needsSave':
      return { ...state, saveState: 'dirty' }
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

  const setEdits = useCallback((edits: ClipEditsV2, pushHistory = true) => {
    if (editsEqual(editsRef.current, edits)) return
    bumpLocalRevision()
    dispatch({ type: 'set', edits, pushHistory })
  }, [bumpLocalRevision])

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

  const addCutRanges = useCallback(
    (ranges: CutRange[]) => {
      if (!ranges.length) return
      const spans = wordSpans()
      let cuts = [...editsRef.current.cutRanges]
      for (const range of ranges) {
        const snapped = spans.length ? snapCutRangeToWordGaps(range, spans) ?? range : range
        const nextRange = spans.length
          ? sanitizeCutRangesForWords([snapped], spans)[0] ?? snapped
          : snapped
        cuts = mergeCutRanges([...cuts, nextRange])
      }
      setEdits({ ...editsRef.current, cutRanges: cuts })
    },
    [setEdits, wordSpans],
  )

  const addCutRange = useCallback(
    (range: CutRange) => {
      addCutRanges([range])
    },
    [addCutRanges],
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

  const restoreCutRange = useCallback(
    (range: CutRange) => {
      const cuts = subtractRangeFromCuts(state.edits.cutRanges, range)
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

  const processSaveQueue = useCallback(async () => {
    if (saveInFlightRef.current) {
      savePendingRef.current = true
      return
    }
    if (savedRevisionRef.current >= localRevisionRef.current) {
      dispatch({ type: 'saved' })
      return
    }

    saveInFlightRef.current = true
    dispatch({ type: 'saving' })
    try {
      while (savedRevisionRef.current < localRevisionRef.current) {
        const revisionAtSend = localRevisionRef.current
        saveBaseEditsRef.current = lastSavedEditsRef.current
        writeEditorAutosaveDraft(clipId, {
          edits: editsRef.current,
          savedAt: new Date().toISOString(),
          serverUpdatedAt: serverUpdatedAtRef.current,
        })
        try {
          const res = await patchClip(clipId, {
            edits: editsRef.current,
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
          if (err instanceof FetchJsonError && err.status === 409 && err.conflictData) {
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
      /* keep dirty; user can retry */
    } finally {
      saveInFlightRef.current = false
      const pending = savePendingRef.current
      savePendingRef.current = false
      dispatch({ type: 'saved' })
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
    addCutRanges,
    setWordFix,
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
