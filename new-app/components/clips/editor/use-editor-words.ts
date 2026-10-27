'use client'

import { useEffect, useRef, useState } from 'react'
import type { ClipBounds } from '@/lib/clips/edits'
import { trimNeedsEditorWordsRefetch } from '@/lib/clips/editor-words-merge'
import { fetchClipEditorWords } from '@/lib/clips-api'
import type { SourceWord } from '@/lib/clips/source-words'

export function useEditorWords(
  clipId: string,
  initialWords: SourceWord[],
  bounds: ClipBounds,
  trim: { in: number; out: number },
) {
  const [words, setWords] = useState(initialWords)
  const [wordsLoading, setWordsLoading] = useState(false)
  const lastTrimRef = useRef(trim)
  const wordsRef = useRef(initialWords)
  wordsRef.current = words

  useEffect(() => {
    setWords(initialWords)
    wordsRef.current = initialWords
  }, [clipId, initialWords])

  useEffect(() => {
    lastTrimRef.current = trim
    if (!trimNeedsEditorWordsRefetch(wordsRef.current, trim, bounds)) return

    const trimSnap = { in: trim.in, out: trim.out }
    const handle = window.setTimeout(() => {
      if (!trimNeedsEditorWordsRefetch(wordsRef.current, trimSnap, bounds)) return
      setWordsLoading(true)
      void fetchClipEditorWords(clipId)
        .then((data) => {
          if (
            lastTrimRef.current.in !== trimSnap.in ||
            lastTrimRef.current.out !== trimSnap.out
          ) {
            return
          }
          setWords(data.words)
          wordsRef.current = data.words
        })
        .catch(() => {
          /* keep prior words; transcript panel still shows best-effort slice */
        })
        .finally(() => setWordsLoading(false))
    }, 280)

    return () => window.clearTimeout(handle)
  }, [clipId, bounds.clipStartMs, bounds.clipEndMs, trim.in, trim.out])

  return { words, wordsLoading }
}
