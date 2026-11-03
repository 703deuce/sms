'use client'

import { useEffect, useRef, useState } from 'react'
import type { ClipBounds } from '@/lib/clips/edits'
import { trimNeedsEditorWordsRefetch } from '@/lib/clips/editor-words-merge'
import { MAX_TRIM_EXTEND_MS } from '@/lib/clips/trim-bounds'
import { clipWordsToAbsolute } from '@/lib/server/clips/editor-words'
import { fetchClipEditorWords } from '@/lib/clips-api'
import type { SourceWord } from '@/lib/clips/source-words'

function absoluteEditorWords(words: SourceWord[], bounds: ClipBounds): SourceWord[] {
  if (!words.length) return words
  return clipWordsToAbsolute(words, bounds.clipStartMs, bounds.clipEndMs) as SourceWord[]
}

export function useEditorWords(
  clipId: string,
  initialWords: SourceWord[],
  bounds: ClipBounds,
  trim: { in: number; out: number },
  contextMs?: number,
) {
  const [words, setWords] = useState(() => absoluteEditorWords(initialWords, bounds))
  const [wordsLoading, setWordsLoading] = useState(false)
  const lastTrimRef = useRef(trim)
  const contextRef = useRef(contextMs)
  const wordsRef = useRef(initialWords)
  wordsRef.current = words
  contextRef.current = contextMs

  const extendMs = contextMs != null && Number.isFinite(contextMs) ? contextMs : MAX_TRIM_EXTEND_MS

  useEffect(() => {
    const next = absoluteEditorWords(initialWords, bounds)
    setWords(next)
    wordsRef.current = next
  }, [clipId, initialWords, bounds.clipStartMs, bounds.clipEndMs])

  useEffect(() => {
    lastTrimRef.current = trim
    if (!trimNeedsEditorWordsRefetch(wordsRef.current, trim, bounds, 250, extendMs)) return

    const trimSnap = { in: trim.in, out: trim.out }
    const ctxSnap = contextRef.current
    const handle = window.setTimeout(() => {
      if (!trimNeedsEditorWordsRefetch(wordsRef.current, trimSnap, bounds, 250, extendMs)) return
      setWordsLoading(true)
      void fetchClipEditorWords(clipId, trimSnap, ctxSnap)
        .then((data) => {
          if (
            lastTrimRef.current.in !== trimSnap.in ||
            lastTrimRef.current.out !== trimSnap.out ||
            contextRef.current !== ctxSnap
          ) {
            return
          }
          setWords(absoluteEditorWords(data.words, bounds))
          wordsRef.current = absoluteEditorWords(data.words, bounds)
        })
        .catch(() => {
          /* keep prior words; transcript panel still shows best-effort slice */
        })
        .finally(() => setWordsLoading(false))
    }, 280)

    return () => window.clearTimeout(handle)
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
        setWords(absoluteEditorWords(data.words, bounds))
        wordsRef.current = absoluteEditorWords(data.words, bounds)
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
        setWords(absoluteEditorWords(data.words, bounds))
        wordsRef.current = absoluteEditorWords(data.words, bounds)
      })
      .finally(() => setWordsLoading(false))
  } }
}
