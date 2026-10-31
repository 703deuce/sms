'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { musicWindow } from '@/lib/clips/editor/clip-timeline'
import { audioFxActive, buildFxChain, integratedLufs, lufsGainDb, webAudioPlan, type TrackFx } from '@/lib/clips/editor/track-fx'
import { trackIdOf } from '@/lib/clips/editor/tracks'
import type { SfxCue } from '@/components/clips/editor/use-audio-mix'

const FS = 48_000
const MAX_MEASURE_S = 600

/** Route a buffer source through a split-stereo channel pick (mono media: its only channel). */
export function connectChannel(ctx: BaseAudioContext, src: AudioNode, buffer: AudioBuffer, channel: 'L' | 'R' | undefined, to: AudioNode) {
  if (!channel) {
    src.connect(to)
    return
  }
  const split = ctx.createChannelSplitter(2)
  src.connect(split)
  split.connect(to, channel === 'R' && buffer.numberOfChannels > 1 ? 1 : 0)
}

async function measure(len: number, place: (ctx: OfflineAudioContext, into: AudioNode) => void, fx: TrackFx): Promise<number | null> {
  if (typeof OfflineAudioContext === 'undefined' || len <= 0.4) return null
  const ctx = new OfflineAudioContext(2, Math.ceil(Math.min(MAX_MEASURE_S, len) * FS), FS)
  const chain = buildFxChain(ctx, webAudioPlan(fx, null, 'pre'))
  chain.output.connect(ctx.destination)
  place(ctx, chain.input)
  const out = await ctx.startRendering()
  return integratedLufs([out.getChannelData(0), out.getChannelData(1)], FS)
}

/**
 * G1c: measured loudness → LUFS-target gain per track key, from the same pre-gain chain the
 * export measures with loudnorm. Audio tracks: their decoded SFX at their times. Music: the bed
 * inside its window. Voice: export-only (the main sound is not decoded in the browser).
 */
export function useTrackFxLufs({
  edits,
  sfxCues,
  musicUrl,
  outputDurationMs,
}: {
  edits: ClipEditsV2
  sfxCues: SfxCue[]
  musicUrl: string | null
  outputDurationMs?: number
}): Record<string, number | null> {
  const [gains, setGains] = useState<Record<string, number | null>>({})
  const wanted = useMemo(() => (edits.trackFx ?? []).filter((f) => audioFxActive(f) && f.lufs != null && f.track !== 'voice'), [edits.trackFx])
  const key = JSON.stringify(wanted) + '|' + sfxCues.map((c) => `${c.generationId}:${c.atMs}:${c.volume}:${c.inMs ?? 0}:${c.durMs ?? ''}:${c.channel ?? ''}`).join(',') + '|' + (musicUrl ?? '') + JSON.stringify(edits.audio?.music ?? null)
  useEffect(() => {
    if (!wanted.length) {
      setGains({})
      return
    }
    let alive = true
    void (async () => {
      const next: Record<string, number | null> = {}
      for (const fx of wanted) {
        try {
          if (fx.track === 'music') {
            const m = edits.audio?.music
            const win = m ? musicWindow(m, outputDurationMs ?? Number.MAX_SAFE_INTEGER) : null
            if (!m || !win || !musicUrl) continue
            const ab = await (await fetch(musicUrl)).arrayBuffer()
            const buf = await new OfflineAudioContext(2, 1, FS).decodeAudioData(ab)
            const len = Math.min(buf.duration - win.inMs / 1000, (win.endMs - win.startMs) / 1000)
            next.music = lufsGainDb(
              await measure(len, (ctx, into) => {
                const src = ctx.createBufferSource()
                src.buffer = buf
                const g = ctx.createGain()
                g.gain.value = m.volume ?? 0.25
                src.connect(g)
                g.connect(into)
                src.start(0, win.inMs / 1000, len)
              }, fx),
              fx.lufs,
            )
          } else {
            const cues = sfxCues.filter((c) => trackIdOf(edits, 'audio', c.generationId) === fx.track)
            if (!cues.length) continue
            const end = Math.max(...cues.map((c) => c.atMs / 1000 + Math.min(c.buffer.duration - (c.inMs ?? 0) / 1000, c.durMs != null ? c.durMs / 1000 : Infinity)))
            next[fx.track] = lufsGainDb(
              await measure(end, (ctx, into) => {
                for (const c of cues) {
                  const src = ctx.createBufferSource()
                  src.buffer = c.buffer
                  const g = ctx.createGain()
                  g.gain.value = c.volume
                  connectChannel(ctx, src, c.buffer, c.channel, g)
                  g.connect(into)
                  const inS = (c.inMs ?? 0) / 1000
                  const playS = Math.max(0, Math.min(c.buffer.duration - inS, c.durMs != null ? c.durMs / 1000 : Infinity))
                  src.start(c.atMs / 1000, inS, playS)
                }
              }, fx),
              fx.lufs,
            )
          }
        } catch {
          /* preview-only: the export measures on its own */
        }
      }
      if (alive) setGains(next)
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures every input
  }, [key])
  return gains
}
