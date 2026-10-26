'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildCaptionWords, captionWordsToClipWords } from '@/lib/clips/caption-words'
import { dubWordsToCaptionWords, dubWordsToSourceWords, type DubWordRow } from '@/lib/clips/dub-words'
import { parseAudioTrack } from '@/lib/clips/dub'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { clipsFetch } from '@/lib/clips-api'

type DubRow = {
  id: string
  targetLang: string
  status: string
  audioUrl: string | null
  words: DubWordRow[] | null
}

export function useDubPreview(clipId: string, edits: ClipEditsV2, sourceWords: SourceWord[]) {
  const [dubs, setDubs] = useState<DubRow[]>([])

  const refresh = useCallback(async () => {
    const data = await clipsFetch<{ items: DubRow[] }>(`/api/clips/clips/${clipId}/dubs`)
    setDubs(data.items)
  }, [clipId])

  useEffect(() => {
    void refresh().catch(() => {})
    const t = setInterval(() => void refresh().catch(() => {}), 10_000)
    return () => clearInterval(t)
  }, [refresh])

  const track = parseAudioTrack(edits.audioTrack)
  const activeDub =
    track.kind === 'dub' ? dubs.find((d) => d.id === track.dubTrackId && d.status === 'READY') : null

  const previewWords = useMemo(() => {
    if (activeDub?.words?.length) {
      return captionWordsToClipWords(dubWordsToCaptionWords(activeDub.words))
    }
    return captionWordsToClipWords(buildCaptionWords(sourceWords, edits))
  }, [activeDub, sourceWords, edits])

  const duckWords = useMemo(() => {
    if (activeDub?.words?.length) return dubWordsToSourceWords(activeDub.words)
    return sourceWords
  }, [activeDub, sourceWords])

  return {
    dubs,
    refreshDubs: refresh,
    activeDub,
    dubAudioUrl: activeDub?.audioUrl ?? null,
    useDubAudio: Boolean(activeDub?.audioUrl),
    previewWords,
    duckWords,
  }
}
