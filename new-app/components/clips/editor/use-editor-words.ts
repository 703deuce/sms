'use client'

import { useEffect, useRef, useState } from 'react'
import type { ClipBounds } from '@/lib/clips/edits'
import { trimNeedsEditorWordsRefetch } from '@/lib/clips/editor-words-merge'
import { MAX_TRIM_EXTEND_MS } from '@/lib/clips/trim-bounds'
import { fetchClipEditorWords } from '@/lib/clips-api'
import type { SourceWord } from '@/lib/clips/source-words'

// Editor payload and refetch endpoint both return words in absolute source seconds.
// Applying clip-relative detection again double-offsets early extended-trim words.
export function useEditorWords(
  clipId: string,
  initialWords: SourceWord[],
  bounds: ClipBounds,
  trim: { in: number; out: number },
  contextMs?: number,
) {
  const [words, setWords] = useState(() => initialWords)
  const [wordsLoading, setWordsLoading] = useState(false)
  const lastTrimRef = useRef(trim)
  const contextRef = useRef(contextMs)
  const wordsRef = useRef(initialWords)
  wordsRef.current = words
  contextRef.current = contextMs

  const extendMs = contextMs != null && Number.isFinite(contextMs) ? contextMs : MAX_TRIM_EXTEND_MS

  useEffect(() => {
    const next = initialWords
    setWords(next)
    wordsRef.current = next
  }, [clipId, initialWords, bounds.clipStartMs, bounds.clipEndMs])

  useEffect(() => {
    lastTrimRef.current = trim
    if (!trimNeedsEditorWordsRefetch(wordsRef.current, trim, bounds, 250, extendMs)) return

    const trimSnap = { in: trim.in, out: trim.out }
    const ctxSnap = contextRef.current
    let active = true
    const load = () => {
      if (!active || !trimNeedsEditorWordsRefetch(wordsRef.current, trimSnap, bounds, 250, extendMs)) return
      setWordsLoading(true)
      void fetchClipEditorWords(clipId, trimSnap, ctxSnap)
        .then((data) => {
          if (
            !active ||
            lastTrimRef.current.in !== trimSnap.in ||
            lastTrimRef.current.out !== trimSnap.out ||
            contextRef.current !== ctxSnap
          ) return
          setWords(data.words)
          wordsRef.current = data.words
        })
        .catch(() => {
          /* retain prior words and let the user retry if loading fails */
        })
        .finally(() => { if (active) setWordsLoading(false) })
    }
    // No initial words means a transcript is absent: fetch immediately instead of
    // waiting for a trim-drag debounce. Extended trims with existing words still debounce.
    const delay = wordsRef.current.length ? 280 : 0
    const handle = delay ? window.setTimeout(load, delay) : null
    if (!delay) load()

    return () => {
      active = false
      if (handle != null) window.clearTimeout(handle)
    }
  }, [
    clipId,
    bounds.clipStartMs,
    bounds.clipEndMs,
    bounds.trimMinMs,
    bounds.trimMaxMs,
    trim.in,
    trim.out,
    extendMs,
  ])

  useEffect(() => {
    if (contextMs == null || !Number.isFinite(contextMs)) return
    const trimSnap = { in: trim.in, out: trim.out }
    const ctxSnap = contextMs
    setWordsLoading(true)
    void fetchClipEditorWords(clipId, trimSnap, ctxSnap)
      .then((data) => {
        if (contextRef.current !== ctxSnap) return
        setWords(data.words)
        wordsRef.current = data.words
      })
      .catch(() => {
        /* keep prior words */
      })
      .finally(() => setWordsLoading(false))
  }, [clipId, contextMs, trim.in, trim.out])

  return { words, wordsLoading, reloadWords: () => {
    const trimSnap = { in: trim.in, out: trim.out }
    const ctxSnap = contextRef.current
    setWordsLoading(true)
    return fetchClipEditorWords(clipId, trimSnap, ctxSnap)
      .then((data) => {
        setWords(data.words)
        wordsRef.current = data.words
      })
      .finally(() => setWordsLoading(false))
  } }
}
