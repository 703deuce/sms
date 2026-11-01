'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ClipAudioSfx } from '@/lib/clips/audio'
import { clipsFetch } from '@/lib/clips-api'
import type { SfxCue } from '@/components/clips/editor/use-audio-mix'
import { peaksFromSamples, type AudioPeaks } from '@/components/clips/editor/use-audio-peaks'
import { detectBeats, monoSamples } from '@/lib/clips/editor/beats'

/** G2: beat markers only for music-length clips (short SFX would just add noise). */
const BEATS_MIN_MS = 8000
/** G2: waveform + beats per decoded buffer, computed once (buffers are shared by placements). */
const analysisCache = new WeakMap<AudioBuffer, { peaks: AudioPeaks; beatsMs: number[]; bpm: number | null }>()
function analyse(b: AudioBuffer): { peaks: AudioPeaks; beatsMs: number[]; bpm: number | null } {
  const hit = analysisCache.get(b)
  if (hit) return hit
  const peaks = peaksFromSamples(b.getChannelData(0), b.duration, 40)
  const grid = b.duration * 1000 >= BEATS_MIN_MS ? detectBeats(monoSamples(b), b.sampleRate) : null
  const beatsMs = grid?.beatsMs ?? []
  const out = { peaks, beatsMs, bpm: beatsMs.length && grid?.bpm ? grid.bpm : null }
  analysisCache.set(b, out)
  return out
}

/**
 * E2: decode placed SFX so the preview plays them at `atMs` (export already did) and the
 * timeline can draw their real length. Generations that are still rendering are retried.
 */
export function useSfxCues(
  sfx: ClipAudioSfx[],
  /** E5: signed URL of an uploaded sound (project media library); null until the library loads. */
  uploadUrl?: (uploadId: string) => string | null,
): {
  cues: SfxCue[]
  durationsMs: Record<string, number>
  /** G2: waveform of every placed audio clip (by lane id). */
  peaks: Record<string, AudioPeaks>
  /** G2: media-ms beats of music-length clips (by lane id). */
  beatsMs: Record<string, number[]>
  /** G2fix: detected tempo of music-length clips (by lane id) — the music-clip inspector shows it. */
  bpm: Record<string, number>
} {
  const [buffers, setBuffers] = useState<Record<string, AudioBuffer>>({})
  const ids = useMemo(() => [...new Set(sfx.map((s) => s.generationId))].sort(), [sfx])
  const uploadUrls = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of sfx) {
      const u = s.uploadId && uploadUrl ? uploadUrl(s.uploadId) : null
      if (s.uploadId && u) m[s.generationId] = u
    }
    return m
  }, [sfx, uploadUrl])
  const uploadUrlsRef = useRef(uploadUrls)
  uploadUrlsRef.current = uploadUrls
  // E5b: one upload placed N times is fetched + decoded once.
  const decodedByUrl = useRef(new Map<string, Promise<AudioBuffer | null>>())
  const idsKey = `${ids.join('|')}#${Object.keys(uploadUrls).sort().join('|')}`

  useEffect(() => {
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const load = async (id: string, attempt: number) => {
      try {
        if (sfx.some((s) => s.generationId === id && s.uploadId)) {
          const direct = uploadUrlsRef.current[id]
          if (!direct) return
          let pending = decodedByUrl.current.get(direct)
          if (!pending) {
            pending = (async () => {
              const ab0 = await (await fetch(direct)).arrayBuffer()
              const Ctx0 = typeof OfflineAudioContext !== 'undefined' ? OfflineAudioContext : null
              if (!Ctx0) return null
              return new Ctx0(1, 1, 44_100).decodeAudioData(ab0)
            })().catch(() => null)
            decodedByUrl.current.set(direct, pending)
          }
          const dec = await pending
          if (!dec) {
            decodedByUrl.current.delete(direct)
            return
          }
          if (!cancelled) setBuffers((prev) => ({ ...prev, [id]: dec }))
          return
        }
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
    const peaks: Record<string, AudioPeaks> = {}
    const beatsMs: Record<string, number[]> = {}
    const bpm: Record<string, number> = {}
    for (const s of sfx) {
      const b = buffers[s.generationId]
      if (!b) continue
      durationsMs[s.generationId] = Math.round(b.duration * 1000)
      try {
        const a = analyse(b)
        peaks[s.generationId] = a.peaks
        if (a.beatsMs.length) beatsMs[s.generationId] = a.beatsMs
        if (a.bpm) bpm[s.generationId] = a.bpm
      } catch {
        /* display-only */
      }
      cues.push({
        buffer: b,
        atMs: s.atMs,
        volume: s.volume ?? 0.8,
        generationId: s.generationId,
        inMs: s.inMs,
        durMs: s.durMs,
        ...(s.channel ? { channel: s.channel } : {}),
        // G2: fades / ducking (export: audio_render clip_fade + per-clip sidechaincompress).
        ...(s.fadeInMs ? { fadeInMs: s.fadeInMs } : {}),
        ...(s.fadeOutMs ? { fadeOutMs: s.fadeOutMs } : {}),
        ...(s.duckDepth != null ? { duckDepth: s.duckDepth } : {}),
        // G2fix: a looping music clip (export: `-stream_loop -1` + atrim duration=durMs).
        ...(s.loop && s.durMs != null ? { loop: true } : {}),
        ...(s.pan ? { pan: s.pan } : {}),
      })
    }
    return { cues, durationsMs, peaks, beatsMs, bpm }
  }, [buffers, sfx])
}
