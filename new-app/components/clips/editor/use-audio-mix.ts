'use client'

import { useEffect, useRef } from 'react'
import type { ClipEditsAudio } from '@/lib/clips/audio'
import { buildCaptionWords } from '@/lib/clips/caption-words'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'

type SfxCue = { buffer: AudioBuffer; atMs: number; volume: number; generationId: string }

export function useAudioMix({
  videoRef,
  edits,
  words,
  musicUrl,
  dubUrl,
  useDubAudio,
  sfxCues,
  outputMs,
  playing,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>
  edits: ClipEditsV2
  words: SourceWord[]
  musicUrl: string | null
  dubUrl?: string | null
  useDubAudio?: boolean
  sfxCues: SfxCue[]
  outputMs: number
  playing: boolean
}) {
  const ctxRef = useRef<AudioContext | null>(null)
  const dubRef = useRef<HTMLAudioElement | null>(null)
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const musicGainRef = useRef<GainNode | null>(null)
  const elementSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const scheduledRef = useRef(false)
  const lastSfxKeyRef = useRef('')

  const audio = edits.audio

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = Boolean(useDubAudio)
  }, [useDubAudio, videoRef])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !useDubAudio || !dubUrl) return
    if (!dubRef.current) {
      dubRef.current = new Audio()
      dubRef.current.crossOrigin = 'anonymous'
    }
    const el = dubRef.current
    el.src = dubUrl
    return () => {
      el.pause()
    }
  }, [dubUrl, useDubAudio, videoRef])

  useEffect(() => {
    const dub = dubRef.current
    if (!useDubAudio || !dub || !dubUrl) return
    if (playing) {
      dub.currentTime = outputMs / 1000
      void dub.play().catch(() => {})
    } else {
      dub.pause()
    }
  }, [playing, outputMs, dubUrl, useDubAudio])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !audio?.music || !musicUrl) return

    let cancelled = false
    const setup = async () => {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext()
        elementSourceRef.current = ctxRef.current.createMediaElementSource(video)
        elementSourceRef.current.connect(ctxRef.current.destination)
      }
      const ctx = ctxRef.current
      if (!musicRef.current) {
        musicRef.current = new Audio()
        musicRef.current.crossOrigin = 'anonymous'
      }
      const el = musicRef.current
      el.src = musicUrl
      await el.play().catch(() => {})
      el.pause()
      el.currentTime = 0

      if (!musicGainRef.current) {
        musicGainRef.current = ctx.createGain()
        const track = ctx.createMediaElementSource(el)
        track.connect(musicGainRef.current)
        musicGainRef.current.connect(ctx.destination)
      }

      const capWords = buildCaptionWords(words, edits)
      const volume = audio.music?.volume ?? 0.25
      const duckDepth = audio.music?.duckDepth ?? 0.7
      const duckGain = volume * (1 - duckDepth)
      const gain = musicGainRef.current
      const now = ctx.currentTime
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(volume, now)
      for (const w of capWords) {
        const start = w.s_ms / 1000
        const end = w.e_ms / 1000
        gain.gain.setTargetAtTime(duckGain, start, 0.02)
        gain.gain.setTargetAtTime(volume, end, 0.3)
      }
      scheduledRef.current = true
    }
    void setup()
    return () => {
      cancelled = true
    }
  }, [audio?.music, edits, musicUrl, videoRef, words])

  useEffect(() => {
    const video = videoRef.current
    const music = musicRef.current
    const ctx = ctxRef.current
    if (!video || !music || !ctx || !audio?.music) return
    if (playing) {
      void ctx.resume()
      music.currentTime = outputMs / 1000
      void music.play().catch(() => {})
    } else {
      music.pause()
    }
  }, [playing, outputMs, audio?.music, videoRef])

  useEffect(() => {
    const ctx = ctxRef.current
    if (!ctx || !playing) return
    const key = sfxCues.map((c) => `${c.generationId}:${c.atMs}`).join('|')
    if (key === lastSfxKeyRef.current) return
    lastSfxKeyRef.current = key
    for (const cue of sfxCues) {
      const src = ctx.createBufferSource()
      src.buffer = cue.buffer
      const g = ctx.createGain()
      g.gain.value = cue.volume
      src.connect(g)
      g.connect(ctx.destination)
      const delay = Math.max(0, cue.atMs - outputMs) / 1000
      src.start(ctx.currentTime + delay)
    }
  }, [sfxCues, playing, outputMs])

  useEffect(() => {
    return () => {
      void ctxRef.current?.close()
      ctxRef.current = null
      musicRef.current = null
      dubRef.current = null
      musicGainRef.current = null
      elementSourceRef.current = null
    }
  }, [])
}

export type { SfxCue, ClipEditsAudio }
