'use client'

import { useEffect, useRef } from 'react'
import type { ClipEditsAudio } from '@/lib/clips/audio'
import { buildCaptionWords } from '@/lib/clips/caption-words'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { normalizeEditSpeed } from '@/lib/clips/edits'
import { musicWindow } from '@/lib/clips/editor/clip-timeline'
import { findTrack, volumeAt } from '@/lib/clips/editor/keyframes'
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
  outputDurationMs,
  voiceMuted = false,
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
  /** E2: output length, for the music window default end. */
  outputDurationMs?: number
  /** E2: Voice lane muted (speech / dub silent; music + SFX still play). */
  voiceMuted?: boolean
}) {
  const ctxRef = useRef<AudioContext | null>(null)
  const dubRef = useRef<HTMLAudioElement | null>(null)
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const musicGainRef = useRef<GainNode | null>(null)
  const elementSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  // E3: volume keyframes (Voice / Music lanes) — gain envelopes in series with the existing mix.
  const voiceGainRef = useRef<GainNode | null>(null)
  const musicEnvRef = useRef<GainNode | null>(null)
  const scheduledRef = useRef(false)
  const sfxNodesRef = useRef<AudioBufferSourceNode[]>([])
  const sfxAnchorRef = useRef<{ ctxT: number; outMs: number } | null>(null)
  const outputMsRef = useRef(outputMs)
  outputMsRef.current = outputMs
  const rate = normalizeEditSpeed(edits.speed) ?? 1

  const audio = edits.audio

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (useDubAudio || voiceMuted) {
      video.muted = true
    } else {
      video.muted = false
      if (video.volume <= 0) video.volume = 1
    }
  }, [useDubAudio, videoRef, voiceMuted])

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
    dub.muted = voiceMuted
    if (playing) {
      if (dub.paused || Math.abs(dub.currentTime - outputMs / 1000) > 0.3) dub.currentTime = outputMs / 1000
      void dub.play().catch(() => {})
    } else {
      dub.pause()
    }
  }, [playing, outputMs, dubUrl, useDubAudio, voiceMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !audio?.music || !musicUrl) return

    let cancelled = false
    const setup = async () => {
      if (!ctxRef.current) {
        ctxRef.current = new AudioContext()
        elementSourceRef.current = ctxRef.current.createMediaElementSource(video)
        voiceGainRef.current = ctxRef.current.createGain()
        elementSourceRef.current.connect(voiceGainRef.current)
        voiceGainRef.current.connect(ctxRef.current.destination)
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
        musicEnvRef.current = ctx.createGain()
        const track = ctx.createMediaElementSource(el)
        track.connect(musicGainRef.current)
        musicGainRef.current.connect(musicEnvRef.current)
        musicEnvRef.current.connect(ctx.destination)
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
    if (!video || !music || !ctx || !audio?.music) {
      music?.pause()
      return
    }
    // E2: the bed only plays inside its timeline window, from its media in-point.
    const win = musicWindow(audio.music, outputDurationMs ?? Number.MAX_SAFE_INTEGER)
    const inWin = Boolean(win && outputMs >= win.startMs && outputMs < win.endMs)
    if (playing && win && inWin) {
      void ctx.resume()
      const target = (outputMs - win.startMs + win.inMs) / 1000
      if (music.paused || Math.abs(music.currentTime - target) > 0.3) music.currentTime = target
      if (music.paused) void music.play().catch(() => {})
    } else {
      music.pause()
    }
  }, [playing, outputMs, audio?.music, videoRef, outputDurationMs])

  // E3: volume envelopes, evaluated with the same math as the export's `volume` expressions.
  const hasVoiceEnv = Boolean(findTrack(edits, 'voice', 'volume'))
  const hasMusicEnv = Boolean(findTrack(edits, 'music', 'volume'))
  useEffect(() => {
    const video = videoRef.current
    const voice = hasVoiceEnv ? volumeAt(edits, 'voice', outputMs) : 1
    if (voiceGainRef.current) {
      voiceGainRef.current.gain.value = voice
      if (video && hasVoiceEnv && video.volume !== 1) video.volume = 1
    } else if (video && (hasVoiceEnv || video.volume !== 1)) {
      video.volume = Math.max(0, Math.min(1, voice))
    }
    if (dubRef.current) dubRef.current.volume = Math.max(0, Math.min(1, voice))
    const env = musicEnvRef.current
    if (env) {
      const win = audio?.music ? musicWindow(audio.music, outputDurationMs ?? Number.MAX_SAFE_INTEGER) : null
      env.gain.value = hasMusicEnv && win ? volumeAt(edits, 'music', outputMs - win.startMs) : 1
    }
  }, [audio?.music, edits, hasMusicEnv, hasVoiceEnv, outputDurationMs, outputMs, videoRef])

  // E2: SFX play in preview at atMs (previously never scheduled). Re-scheduled on play / seek.
  const sfxKey = sfxCues.map((c) => `${c.generationId}:${c.atMs}:${c.volume}`).join('|')
  const stopSfx = () => {
    for (const n of sfxNodesRef.current) {
      try {
        n.stop()
      } catch {
        /* already stopped */
      }
    }
    sfxNodesRef.current = []
    sfxAnchorRef.current = null
  }
  const scheduleSfx = (fromMs: number) => {
    stopSfx()
    if (!sfxCues.length) return
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    const ctx = ctxRef.current
    void ctx.resume()
    for (const cue of sfxCues) {
      const endMs = cue.atMs + cue.buffer.duration * 1000
      if (endMs <= fromMs) continue
      const src = ctx.createBufferSource()
      src.buffer = cue.buffer
      const g = ctx.createGain()
      g.gain.value = cue.volume
      src.connect(g)
      g.connect(ctx.destination)
      if (cue.atMs >= fromMs) src.start(ctx.currentTime + (cue.atMs - fromMs) / 1000 / rate)
      else src.start(ctx.currentTime, (fromMs - cue.atMs) / 1000)
      sfxNodesRef.current.push(src)
    }
    sfxAnchorRef.current = { ctxT: ctx.currentTime, outMs: fromMs }
  }
  const scheduleRef = useRef(scheduleSfx)
  scheduleRef.current = scheduleSfx
  const stopRef = useRef(stopSfx)
  stopRef.current = stopSfx

  useEffect(() => {
    if (playing) scheduleRef.current(outputMsRef.current)
    else stopRef.current()
  }, [playing, sfxKey])

  useEffect(() => {
    const ctx = ctxRef.current
    const anchor = sfxAnchorRef.current
    if (!playing || !ctx || !anchor) return
    const expected = anchor.outMs + (ctx.currentTime - anchor.ctxT) * 1000 * rate
    if (Math.abs(outputMs - expected) > 350) scheduleRef.current(outputMs)
  }, [outputMs, playing, rate])

  useEffect(() => {
    return () => {
      stopRef.current()
      void ctxRef.current?.close()
      ctxRef.current = null
      musicRef.current = null
      dubRef.current = null
      musicGainRef.current = null
      musicEnvRef.current = null
      voiceGainRef.current = null
      elementSourceRef.current = null
    }
  }, [])
}

export type { SfxCue, ClipEditsAudio }
