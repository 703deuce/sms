'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ClipAudioSfx } from '@/lib/clips/audio'
import { clipsFetch } from '@/lib/clips-api'
import type { SfxCue } from '@/components/clips/editor/use-audio-mix'

/**
 * E2: decode placed SFX so the preview plays them at `atMs` (export already did) and the
 * timeline can draw their real length. Generations that are still rendering are retried.
 */
export function useSfxCues(sfx: ClipAudioSfx[]): { cues: SfxCue[]; durationsMs: Record<string, number> } {
  const [buffers, setBuffers] = useState<Record<string, AudioBuffer>>({})
  const ids = useMemo(() => [...new Set(sfx.map((s) => s.generationId))].sort(), [sfx])
  const idsKey = ids.join('|')

  useEffect(() => {
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const load = async (id: string, attempt: number) => {
      try {
        const res = await clipsFetch<{ status: string; downloadUrl: string | null }>(`/api/clips/generations/${id}`)
        if (cancelled) return
        if (res.status !== 'READY' || !res.downloadUrl) {
          if (res.status !== 'FAILED' && attempt < 20) timers.push(setTimeout(() => void load(id, attempt + 1), 3000))
          return
        }
        const ab = await (await fetch(res.downloadUrl)).arrayBuffer()
        const Ctx = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : null
        if (!Ctx) return
        const decoded = await new Ctx(1, 1, 44_100).decodeAudioData(ab)
        if (!cancelled) setBuffers((prev) => ({ ...prev, [id]: decoded }))
      } catch {
        /* preview-only: export still renders the SFX */
      }
    }
    for (const id of ids) if (!buffers[id]) void load(id, 0)
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the id set changes
  }, [idsKey])

  return useMemo(() => {
    const cues: SfxCue[] = []
    const durationsMs: Record<string, number> = {}
    for (const s of sfx) {
      const b = buffers[s.generationId]
      if (!b) continue
      durationsMs[s.generationId] = Math.round(b.duration * 1000)
      cues.push({ buffer: b, atMs: s.atMs, volume: s.volume ?? 0.8, generationId: s.generationId })
    }
    return { cues, durationsMs }
  }, [buffers, sfx])
}
