'use client'

import { useEffect, useRef } from 'react'
import type { ClipEditsAudio } from '@/lib/clips/audio'
import { buildCaptionWords } from '@/lib/clips/caption-words'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { normalizeEditSpeed } from '@/lib/clips/edits'
import { musicWindow } from '@/lib/clips/editor/clip-timeline'
import { findTrack, trackValueAt, volumeAt } from '@/lib/clips/editor/keyframes'
import type { SourceWord } from '@/lib/clips/source-words'
import { audioFxActive, buildFxChain, fxPlanKey, trackFxFor, webAudioPlan } from '@/lib/clips/editor/track-fx'
import { trackIdOf } from '@/lib/clips/editor/tracks'
import { connectChannel, useTrackFxLufs } from '@/components/clips/editor/use-track-fx-lufs'

type SfxCue = { buffer: AudioBuffer; atMs: number; volume: number; generationId: string; inMs?: number; durMs?: number; channel?: 'L' | 'R' }

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
  musicRate,
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
  /** E4: music element rate while per-item speeds play (global × item speed). Omitted = unchanged. */
  musicRate?: number
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

  // G1c track FX: one Web Audio chain per track key (voice / music / audio tracks).
  const lufsGains = useTrackFxLufs({ edits, sfxCues, musicUrl, outputDurationMs })
  const chainsRef = useRef(new Map<string, { key: string; input: AudioNode; nodes: AudioNode[] }>())
  const fxKeyRef = useRef('')
  /** Input node for a track key: its chain when active, else the destination. */
  const fxInput = (ctx: AudioContext, key: string): AudioNode => {
    const fx = trackFxFor(edits, key)
    if (!audioFxActive(fx)) return ctx.destination
    const gain = lufsGains[key] ?? null
    const k = fxPlanKey(fx, gain)
    const cur = chainsRef.current.get(key)
    if (cur && cur.key === k) return cur.input
    if (cur) for (const n of cur.nodes) n.disconnect()
    const chain = buildFxChain(ctx, webAudioPlan(fx, gain))
    chain.output.connect(ctx.destination)
    chainsRef.current.set(key, { key: k, input: chain.input, nodes: chain.nodes })
    return chain.input
  }
  const route = (which: 'voice' | 'music') => {
    const ctx = ctxRef.current
    const tail = which === 'voice' ? voiceGainRef.current : musicEnvRef.current
    if (!ctx || !tail) return
    tail.disconnect()
    tail.connect(fxInput(ctx, which))
  }
  const routeRef = useRef(route)
  routeRef.current = route
  const ensureVoiceGraph = () => {
    const video = videoRef.current
    if (ctxRef.current && elementSourceRef.current) return
    if (!video) return
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    elementSourceRef.current = ctxRef.current.createMediaElementSource(video)
    voiceGainRef.current = ctxRef.current.createGain()
    elementSourceRef.current.connect(voiceGainRef.current)
    routeRef.current('voice')
  }
  const voiceFxOn = audioFxActive(trackFxFor(edits, 'voice'))
  const fxKey = JSON.stringify(edits.trackFx ?? []) + JSON.stringify(lufsGains)
  useEffect(() => {
    // The main sound only goes through Web Audio when it needs to (music bed or a Voice chain).
    if (voiceFxOn) ensureVoiceGraph()
    if (fxKeyRef.current === fxKey) return
    fxKeyRef.current = fxKey
    routeRef.current('voice')
    routeRef.current('music')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fxKey captures the chains
  }, [fxKey, voiceFxOn])

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
      ensureVoiceGraph()
      const ctx = ctxRef.current!
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
        routeRef.current('music')
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
    if (musicRate != null && Number.isFinite(musicRate) && music.playbackRate !== musicRate) music.playbackRate = musicRate
    if (playing && win && inWin) {
      void ctx.resume()
      const target = (outputMs - win.startMs + win.inMs) / 1000
      if (music.paused || Math.abs(music.currentTime - target) > 0.3) music.currentTime = target
      if (music.paused) void music.play().catch(() => {})
    } else {
      music.pause()
    }
  }, [playing, outputMs, audio?.music, videoRef, outputDurationMs, musicRate])

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
  // G1b3: + the SFX volume envelopes (`sfx:<id>` keyframes), so editing one re-schedules.
  const sfxEnvKey = JSON.stringify((edits.keyframes ?? []).filter((k) => k.target.startsWith('sfx:')))
  const sfxKey = sfxCues.map((c) => `${c.generationId}:${c.atMs}:${c.volume}:${c.inMs ?? 0}:${c.durMs ?? ''}:${c.channel ?? ''}`).join('|') + sfxEnvKey + fxKey
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
      // G1b3: in-point / length (detached audio).
      const inS = (cue.inMs ?? 0) / 1000
      const playS = Math.max(0, Math.min(cue.buffer.duration - inS, cue.durMs != null ? cue.durMs / 1000 : Infinity))
      const endMs = cue.atMs + playS * 1000
      if (endMs <= fromMs || playS <= 0) continue
      const src = ctx.createBufferSource()
      src.buffer = cue.buffer
      const g = ctx.createGain()
      g.gain.value = cue.volume
      // G1b3: SFX envelope — sampled every 20 ms of the cue as linear ramps (any ease matches the
      // export's per-frame volume expression to within a ramp step).
      const env = findTrack(edits, `sfx:${cue.generationId}`, 'volume')
      if (env && (env.points.length || env.value != null)) {
        const lenMs = cue.buffer.duration * 1000
        const local0 = Math.max(0, fromMs - cue.atMs)
        const t0 = ctx.currentTime + Math.max(0, cue.atMs - fromMs) / 1000 / rate
        const at = (local: number) => t0 + (local - local0) / 1000 / rate
        g.gain.setValueAtTime(cue.volume * (trackValueAt(env, 'volume', local0) / 100), ctx.currentTime)
        for (let l = local0 + 20, n = 0; l <= lenMs && n < 2000; l += 20, n++) {
          g.gain.linearRampToValueAtTime(cue.volume * (trackValueAt(env, 'volume', l) / 100), at(l))
        }
      }
      // G1c: split-stereo channel pick, then the cue's audio-track chain (bus).
      connectChannel(ctx, src, cue.buffer, cue.channel, g)
      g.connect(fxInput(ctx, trackIdOf(edits, 'audio', cue.generationId)))
      if (cue.atMs >= fromMs) src.start(ctx.currentTime + (cue.atMs - fromMs) / 1000 / rate, inS, playS)
      else src.start(ctx.currentTime, inS + (fromMs - cue.atMs) / 1000, playS - (fromMs - cue.atMs) / 1000)
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
      chainsRef.current.clear()
    }
  }, [])
}

export type { SfxCue, ClipEditsAudio }
