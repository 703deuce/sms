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
  const [loadingReason, setLoadingReason] = useState<'initial' | 'extended' | 'context' | 'reload' | null>(null)
  const wordsLoading = loadingReason != null
  const lastTrimRef = useRef(trim)
  const contextRef = useRef(contextMs)
  const wordsRef = useRef(initialWords)
  // Parent renders may pass a newly allocated but identical words array.
  // Treat source changes by value, or an empty parent array will repeatedly
  // overwrite freshly fetched transcript words and trigger an update loop.
  const incomingRef = useRef(JSON.stringify({ clipId, initialWords, bounds }))
  wordsRef.current = words
  contextRef.current = contextMs

  const extendMs = contextMs != null && Number.isFinite(contextMs) ? contextMs : MAX_TRIM_EXTEND_MS

  useEffect(() => {
    const signature = JSON.stringify({ clipId, initialWords, bounds })
    if (signature === incomingRef.current) return
    incomingRef.current = signature
    setWords(initialWords)
    wordsRef.current = initialWords
    setLoadingReason(null)
  }, [clipId, initialWords, bounds])

  useEffect(() => {
    lastTrimRef.current = trim
    if (!trimNeedsEditorWordsRefetch(wordsRef.current, trim, bounds, 250, extendMs)) return

    const trimSnap = { in: trim.in, out: trim.out }
    const ctxSnap = contextRef.current
    let active = true
    const load = () => {
      if (!active || !trimNeedsEditorWordsRefetch(wordsRef.current, trimSnap, bounds, 250, extendMs)) return
      const extended = trimSnap.in < bounds.clipStartMs || trimSnap.out > bounds.clipEndMs
      setLoadingReason(extended ? 'extended' : 'initial')
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
        .finally(() => { if (active) setLoadingReason(null) })
    }
    // Fetch missing initial transcripts immediately; debounce extended trim drags.
    const delay = wordsRef.current.length ? 280 : 0
    const handle = delay ? window.setTimeout(load, delay) : null
    if (!delay) load()

    return () => {
      active = false
      if (handle != null) window.clearTimeout(handle)
      setLoadingReason(null)
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
    let active = true
    setLoadingReason('context')
    void fetchClipEditorWords(clipId, trimSnap, ctxSnap)
      .then((data) => {
        if (!active || contextRef.current !== ctxSnap) return
        setWords(data.words)
        wordsRef.current = data.words
      })
      .catch(() => {
        /* keep prior words */
      })
      .finally(() => { if (active) setLoadingReason(null) })
    return () => { active = false; setLoadingReason(null) }
  }, [clipId, contextMs, trim.in, trim.out])

  return { words, wordsLoading, loadingReason, reloadWords: () => {
    const trimSnap = { in: trim.in, out: trim.out }
    const ctxSnap = contextRef.current
    setLoadingReason('reload')
    return fetchClipEditorWords(clipId, trimSnap, ctxSnap)
      .then((data) => {
        setWords(data.words)
        wordsRef.current = data.words
      })
      .finally(() => setLoadingReason(null))
  } }
}
