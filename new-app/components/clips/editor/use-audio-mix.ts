'use client'

import { useEffect, useRef, useState } from 'react'
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
import { audioGraphSafe } from '@/components/clips/editor/g4/media-cors'
import { clipGainAt, clipHasGainCurve, musicFadeAt, musicMediaMsAt } from '@/lib/clips/editor/audio-clip'
import { panGains } from '@/lib/clips/audio'

/** G2: densest gain-curve step and most ramp points per scheduled clip. */
const CURVE_STEP_MS = 20
const CURVE_MAX_POINTS = 3000

function balancePan(ctx: AudioContext, pan: number): { input: AudioNode; output: AudioNode; nodes: AudioNode[] } {
  const [gl, gr] = panGains(pan)
  const split = ctx.createChannelSplitter(2)
  const merge = ctx.createChannelMerger(2)
  const gL = ctx.createGain()
  const gR = ctx.createGain()
  gL.gain.value = gl
  gR.gain.value = gr
  split.connect(gL, 0)
  split.connect(gR, 0)
  gL.connect(merge, 0, 0)
  gR.connect(merge, 0, 1)
  return { input: split, output: merge, nodes: [split, gL, gR, merge] }
}

/** F5: one master gain for music, SFX and routed Voice. Direct video
 * fallback uses exactly the same level. */
export function previewMasterGain(volumePct: number, muted: boolean): number {
  if (muted) return 0
  return Math.max(0, Math.min(1, volumePct / 100))
}

/** F1: always mute the source's direct output when voice is muted, dub is
 * replacing it, or a same-origin FX decoder is providing its audio. */
export function previewSourceMuted(voiceMuted: boolean, playerMuted: boolean, useDub: boolean, proxied: boolean): boolean {
  return voiceMuted || playerMuted || useDub || proxied
}

/** A fixed same-origin media route for preview FX when signed sources lack CORS.
 * The route verifies clip workspace ownership and never takes arbitrary URLs. */
export function voiceFxPreviewUrl(clipId: string, mediaKind: string | null | undefined): string | null {
  if (!['proxy', 'segment', 'source', 'preview'].includes(mediaKind ?? '') || !clipId) return null
  return `/api/clips/clips/${encodeURIComponent(clipId)}/bg-matte-media?kind=${mediaKind}`
}

type SfxCue = {
  buffer: AudioBuffer
  atMs: number
  volume: number
  generationId: string
  inMs?: number
  durMs?: number
  channel?: 'L' | 'R'
  /** G2: clip fades / ducking under the voice. */
  fadeInMs?: number
  fadeOutMs?: number
  duckDepth?: number
  /** G2fix: loop the buffer to fill durMs (music clips). */
  loop?: boolean
  pan?: number
}

export function useAudioMix({
  clipId,
  mediaKind,
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
  playerMuted = false,
  playerVolume = 100,
  musicRate,
  meterOn = false,
}: {
  clipId: string
  mediaKind?: string | null
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
  /** F1/F5: master player controls affect every preview output route. */
  playerMuted?: boolean
  playerVolume?: number
  /** E4: music element rate while per-item speeds play (global × item speed). Omitted = unchanged. */
  musicRate?: number
  /** AU-30: route preview audio through master analysers when on. */
  meterOn?: boolean
}) {
  const ctxRef = useRef<AudioContext | null>(null)
  const dubRef = useRef<HTMLAudioElement | null>(null)
  const musicRef = useRef<HTMLAudioElement | null>(null)
  const musicGainRef = useRef<GainNode | null>(null)
  const musicPanRef = useRef<{ input: AudioNode; output: AudioNode; nodes: AudioNode[]; pan: number } | null>(null)
  const elementSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const fxVoiceRef = useRef<HTMLAudioElement | null>(null)
  const fxVoiceBrokenRef = useRef(false)
  // E3: volume keyframes (Voice / Music lanes) — gain envelopes in series with the existing mix.
  const voiceGainRef = useRef<GainNode | null>(null)
  const musicEnvRef = useRef<GainNode | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const meterAnalysersRef = useRef<[AnalyserNode, AnalyserNode] | null>(null)
  const [meterState, setMeterState] = useState<{ analysers: [AnalyserNode, AnalyserNode] | null; voiceMetered: boolean }>({
    analysers: null,
    voiceMetered: true,
  })
  const scheduledRef = useRef(false)
  const sfxNodesRef = useRef<AudioBufferSourceNode[]>([])
  const sfxAnchorRef = useRef<{ ctxT: number; outMs: number } | null>(null)
  const outputMsRef = useRef(outputMs)
  outputMsRef.current = outputMs
  const rate = normalizeEditSpeed(edits.speed) ?? 1

  const audio = edits.audio
  const fxVoiceUrl = voiceFxPreviewUrl(clipId, mediaKind)

  // G1c track FX: one Web Audio chain per track key (voice / music / audio tracks).
  const lufsGains = useTrackFxLufs({ edits, sfxCues, musicUrl, outputDurationMs })
  const chainsRef = useRef(new Map<string, { key: string; input: AudioNode; nodes: AudioNode[] }>())
  const fxKeyRef = useRef('')
  const mixDest = (ctx: AudioContext): AudioNode => {
    if (!masterRef.current) {
      const m = ctx.createGain()
      m.gain.value = previewMasterGain(playerVolume, playerMuted)
      m.connect(ctx.destination)
      masterRef.current = m
      const split = ctx.createChannelSplitter(2)
      m.connect(split)
      const aL = ctx.createAnalyser()
      const aR = ctx.createAnalyser()
      aL.fftSize = 1024
      aR.fftSize = 1024
      split.connect(aL, 0)
      split.connect(aR, 1)
      meterAnalysersRef.current = [aL, aR]
      setMeterState((s) => ({ ...s, analysers: [aL, aR] }))
    }
    return masterRef.current
  }
  /** Input node for a track key: its chain when active, else the destination. */
  const fxInput = (ctx: AudioContext, key: string): AudioNode => {
    const fx = trackFxFor(edits, key)
    if (!audioFxActive(fx)) return mixDest(ctx)
    const gain = lufsGains[key] ?? null
    const k = fxPlanKey(fx, gain)
    const cur = chainsRef.current.get(key)
    if (cur && cur.key === k) return cur.input
    if (cur) for (const n of cur.nodes) n.disconnect()
    const chain = buildFxChain(ctx, webAudioPlan(fx, gain))
    chain.output.connect(mixDest(ctx))
    chainsRef.current.set(key, { key: k, input: chain.input, nodes: chain.nodes })
    return chain.input
  }
  const route = (which: 'voice' | 'music') => {
    const ctx = ctxRef.current
    const tail = which === 'voice' ? voiceGainRef.current : musicEnvRef.current
    if (!ctx || !tail) return
    tail.disconnect()
    if (which === 'music') {
      if (musicPanRef.current) {
        for (const n of musicPanRef.current.nodes) n.disconnect()
        musicPanRef.current = null
      }
      const mp = audio?.music?.pan
      if (mp) {
        const pan = balancePan(ctx, mp)
        musicPanRef.current = { ...pan, pan: mp }
        tail.connect(pan.input)
        pan.output.connect(fxInput(ctx, 'music'))
        return
      }
    }
    tail.connect(fxInput(ctx, which))
  }
  const routeRef = useRef(route)
  routeRef.current = route
  const ensureVoiceGraph = () => {
    const video = videoRef.current
    if (ctxRef.current && elementSourceRef.current) return
    if (!video) return
    // G4cfix: wait until the load mode is settled (CORS or the plain fallback), then only route a
    // CORS-readable source through Web Audio — a no-CORS one would be silent; it plays plain instead.
    if (video.readyState < 1) {
      video.addEventListener('loadedmetadata', () => ensureVoiceGraphRef.current(), { once: true })
      return
    }
    const needsDedicatedSource = voicePreviewFxOn && Boolean(fxVoiceUrl)
    if (!needsDedicatedSource && !audioGraphSafe(video)) {
      video.dataset.g4audioPlain = '1'
      if (meterOn) setMeterState((s) => ({ ...s, voiceMetered: false }))
      return
    }
    if (meterOn) setMeterState((s) => ({ ...s, voiceMetered: true }))
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    mixDest(ctxRef.current)
    let audioInput: HTMLMediaElement = video
    if (needsDedicatedSource) {
      if (!fxVoiceRef.current) {
        const el = new Audio()
        el.preload = 'auto'
        // Same origin, same media bytes, same currentTime coordinate as the
        // visible video; Web Audio stays active even after its CORS fallback.
        el.src = fxVoiceUrl!
        el.addEventListener('error', () => {
          fxVoiceBrokenRef.current = true
          const activeVideo = videoRef.current
          if (activeVideo) activeVideo.muted = previewSourceMuted(voiceMuted, playerMuted, Boolean(useDubAudio), false)
        })
        fxVoiceRef.current = el
      }
      audioInput = fxVoiceRef.current
      video.muted = true
    }
    elementSourceRef.current = ctxRef.current.createMediaElementSource(audioInput)
    voiceGainRef.current = ctxRef.current.createGain()
    elementSourceRef.current.connect(voiceGainRef.current)
    routeRef.current('voice')
  }
  const ensureVoiceGraphRef = useRef(ensureVoiceGraph)
  ensureVoiceGraphRef.current = ensureVoiceGraph
  const voiceFx = trackFxFor(edits, 'voice')
  // Noise reduction and de-essing are export-only; don't create a second
  // audio decoder if there is no effect the browser can actually process.
  const voicePreviewFxOn = Boolean(voiceFx && webAudioPlan(voiceFx).length)
  const needVoiceGraph = voicePreviewFxOn || meterOn
  const fxKey = JSON.stringify(edits.trackFx ?? []) + JSON.stringify(lufsGains)
  useEffect(() => {
    const sound = fxVoiceRef.current
    if (!sound || !fxVoiceUrl) return
    if (sound.getAttribute('src') !== fxVoiceUrl) {
      sound.pause()
      sound.src = fxVoiceUrl
      fxVoiceBrokenRef.current = false
    }
  }, [fxVoiceUrl])
  useEffect(() => {
    // The main sound only goes through Web Audio when it needs to (music bed, Voice chain, or AU-30 meter).
    if (needVoiceGraph) ensureVoiceGraph()
    if (fxKeyRef.current === fxKey) return
    fxKeyRef.current = fxKey
    routeRef.current('voice')
    routeRef.current('music')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fxKey captures the chains
  }, [fxKey, needVoiceGraph, meterOn, audio?.music?.pan])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = previewSourceMuted(voiceMuted, playerMuted, Boolean(useDubAudio),
      Boolean(fxVoiceRef.current && !fxVoiceBrokenRef.current))
  }, [useDubAudio, videoRef, voiceMuted, playerMuted, outputMs])

  useEffect(() => {
    const sound = fxVoiceRef.current
    const picture = videoRef.current
    if (!sound || !picture || fxVoiceBrokenRef.current) return
    const shouldPlay = playing && !picture.paused && !useDubAudio && !voiceMuted && !playerMuted
    if (!shouldPlay) {
      if (!sound.paused) sound.pause()
      return
    }
    const target = picture.currentTime
    if (Math.abs(sound.currentTime - target) > 0.12) {
      try { sound.currentTime = target } catch { /* wait for media metadata */ }
    }
    if (sound.playbackRate !== picture.playbackRate) sound.playbackRate = picture.playbackRate
    if (sound.paused) {
      void ctxRef.current?.resume().catch(() => {})
      void sound.play().catch(() => {
        fxVoiceBrokenRef.current = true
        picture.muted = previewSourceMuted(voiceMuted, playerMuted, Boolean(useDubAudio), false)
      })
    }
  }, [playing, outputMs, videoRef, useDubAudio, voiceMuted, playerMuted])

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
    dub.muted = voiceMuted || playerMuted
    if (playing) {
      if (dub.paused || Math.abs(dub.currentTime - outputMs / 1000) > 0.3) dub.currentTime = outputMs / 1000
      void dub.play().catch(() => {})
    } else {
      dub.pause()
    }
  }, [playing, outputMs, dubUrl, useDubAudio, voiceMuted, playerMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !audio?.music || !musicUrl) return

    let cancelled = false
    const setup = async () => {
      ensureVoiceGraph()
      // G4cfix: the music bed still mixes when the voice plays plain (no-CORS source).
      if (!ctxRef.current) ctxRef.current = new AudioContext()
      const ctx = ctxRef.current
      mixDest(ctx)
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
    // G2: a looping bed ("Fit to length") wraps to the media start, like `-stream_loop -1`.
    const loop = Boolean(audio.music.loop)
    if (music.loop !== loop) music.loop = loop
    const mediaMs = Number.isFinite(music.duration) && music.duration > 0 ? music.duration * 1000 : null
    if (playing && win && inWin) {
      void ctx.resume()
      const target = (musicMediaMsAt(audio.music, outputMs, outputDurationMs ?? Number.MAX_SAFE_INTEGER, mediaMs) ?? 0) / 1000
      const drift = Math.abs(music.currentTime - target)
      const wrapped = mediaMs != null && loop ? Math.min(drift, mediaMs / 1000 - drift) : drift
      if (music.paused || wrapped > 0.3) music.currentTime = target
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
    const level = previewMasterGain(playerVolume, false)
    // The graph owns global master volume, so direct element volume stays at 1
    // for routed sources. Plain media (CORS fallback) needs the master level here.
    if (voiceGainRef.current) voiceGainRef.current.gain.value = voiceMuted || useDubAudio ? 0 : voice
    if (masterRef.current) masterRef.current.gain.value = previewMasterGain(playerVolume, playerMuted)
    if (video) {
      const plain = !elementSourceRef.current || fxVoiceBrokenRef.current
      const desiredVolume = plain ? voice * level : 1
      if (Math.abs(video.volume - desiredVolume) > 0.001) video.volume = desiredVolume
      const shouldMute = previewSourceMuted(voiceMuted, playerMuted, Boolean(useDubAudio),
        Boolean(fxVoiceRef.current && !fxVoiceBrokenRef.current))
      if (video.muted !== shouldMute) video.muted = shouldMute
    }
    if (dubRef.current) {
      dubRef.current.volume = Math.max(0, Math.min(1, voice * level))
      dubRef.current.muted = voiceMuted || playerMuted
    }
    const env = musicEnvRef.current
    if (env) {
      const win = audio?.music ? musicWindow(audio.music, outputDurationMs ?? Number.MAX_SAFE_INTEGER) : null
      const kf = hasMusicEnv && win ? volumeAt(edits, 'music', outputMs - win.startMs) : 1
      // G2: the export's music fades (afade in / out) now play in preview too.
      const fade = audio?.music && outputDurationMs ? musicFadeAt(audio.music, outputMs, outputDurationMs) : 1
      env.gain.value = kf * fade
    }
  }, [audio?.music, edits, hasMusicEnv, hasVoiceEnv, outputDurationMs, outputMs, videoRef, voiceMuted, playerMuted, playerVolume, useDubAudio])

  // E2: SFX play in preview at atMs (previously never scheduled). Re-scheduled on play / seek.
  // G1b3: + the SFX volume envelopes (`sfx:<id>` keyframes), so editing one re-schedules.
  const sfxEnvKey = JSON.stringify((edits.keyframes ?? []).filter((k) => k.target.startsWith('sfx:')))
  const anyDuck = sfxCues.some((c) => c.duckDepth != null)
  const sfxKey =
    sfxCues
      .map((c) => `${c.generationId}:${c.atMs}:${c.volume}:${c.inMs ?? 0}:${c.durMs ?? ''}:${c.channel ?? ''}:${c.fadeInMs ?? 0}:${c.fadeOutMs ?? 0}:${c.duckDepth ?? ''}:${c.loop ? 1 : 0}:${c.pan ?? 0}`)
      .join('|') +
    sfxEnvKey +
    fxKey +
    (anyDuck ? `#w${words.length}` : '')
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
  /** G2: the spoken words in OUTPUT ms (ducked clips dip under them). */
  const duckCaptionWords = () => buildCaptionWords(words, edits)
  const scheduleSfx = (fromMs: number) => {
    stopSfx()
    if (!sfxCues.length) return
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    const ctx = ctxRef.current
    mixDest(ctx)
    void ctx.resume()
    for (const cue of sfxCues) {
      // G1b3: in-point / length (detached audio).
      const inS = (cue.inMs ?? 0) / 1000
      // G2fix: a looping clip plays its whole durMs (the buffer repeats from 0, like `-stream_loop`).
      const looping = Boolean(cue.loop && cue.durMs != null && cue.buffer.duration > 0)
      const playS = looping
        ? Math.max(0, cue.durMs! / 1000)
        : Math.max(0, Math.min(cue.buffer.duration - inS, cue.durMs != null ? cue.durMs / 1000 : Infinity))
      const endMs = cue.atMs + playS * 1000
      if (endMs <= fromMs || playS <= 0) continue
      const src = ctx.createBufferSource()
      src.buffer = cue.buffer
      const g = ctx.createGain()
      g.gain.value = cue.volume
      // G1b3: SFX envelope — sampled every 20 ms of the cue as linear ramps (any ease matches the
      // export's per-frame volume expression to within a ramp step).
      const env = findTrack(edits, `sfx:${cue.generationId}`, 'volume')
      const hasEnv = Boolean(env && (env.points.length || env.value != null))
      if (hasEnv || clipHasGainCurve(cue)) {
        // G2: one curve = volume × envelope × fades × ducking (clipGainAt), on the clip's play length.
        const lenMs = playS * 1000
        const local0 = Math.max(0, fromMs - cue.atMs)
        const t0 = ctx.currentTime + Math.max(0, cue.atMs - fromMs) / 1000 / rate
        const at = (local: number) => t0 + (local - local0) / 1000 / rate
        const capWords = cue.duckDepth != null ? duckCaptionWords() : undefined
        const gainAt = (l: number) =>
          clipGainAt({ cue, localMs: l, lenMs, envPct: hasEnv ? trackValueAt(env!, 'volume', l) : undefined, words: capWords })
        const step = Math.max(CURVE_STEP_MS, (lenMs - local0) / CURVE_MAX_POINTS)
        g.gain.setValueAtTime(gainAt(local0), ctx.currentTime)
        for (let l = local0 + step, n = 0; l <= lenMs + 0.5 && n < CURVE_MAX_POINTS; l += step, n++) {
          g.gain.linearRampToValueAtTime(gainAt(Math.min(l, lenMs)), at(Math.min(l, lenMs)))
        }
      }
      // G1c: split-stereo channel pick, then the cue's audio-track chain (bus).
      connectChannel(ctx, src, cue.buffer, cue.channel, g)
      let tail: AudioNode = g
      if (cue.pan) {
        const pan = balancePan(ctx, cue.pan)
        g.connect(pan.input)
        tail = pan.output
      }
      tail.connect(fxInput(ctx, trackIdOf(edits, 'audio', cue.generationId)))
      if (looping) src.loop = true
      const offS = (s: number) => (looping ? s % cue.buffer.duration : s)
      if (cue.atMs >= fromMs) src.start(ctx.currentTime + (cue.atMs - fromMs) / 1000 / rate, offS(inS), playS)
      else src.start(ctx.currentTime, offS(inS + (fromMs - cue.atMs) / 1000), playS - (fromMs - cue.atMs) / 1000)
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
      fxVoiceRef.current?.pause()
      fxVoiceRef.current = null
      musicGainRef.current = null
      musicEnvRef.current = null
      voiceGainRef.current = null
      elementSourceRef.current = null
      chainsRef.current.clear()
      masterRef.current = null
      meterAnalysersRef.current = null
      setMeterState({ analysers: null, voiceMetered: true })
    }
  }, [])

  const meter = meterOn ? meterState : { analysers: null, voiceMetered: true }
  return {
    ...meter,
    voiceFxProxyActive: Boolean(fxVoiceRef.current && !fxVoiceBrokenRef.current),
    resumeAudio: () => ctxRef.current?.resume(),
  }
}

/** Test helper: SFX reschedule key (pan changes must invalidate). */
export function sfxMixKey(
  cues: Pick<SfxCue, 'generationId' | 'atMs' | 'volume' | 'inMs' | 'durMs' | 'channel' | 'fadeInMs' | 'fadeOutMs' | 'duckDepth' | 'loop' | 'pan'>[],
  sfxEnvKey: string,
  fxKey: string,
  anyDuck: boolean,
  wordsLen: number,
): string {
  return (
    cues
      .map(
        (c) =>
          `${c.generationId}:${c.atMs}:${c.volume}:${c.inMs ?? 0}:${c.durMs ?? ''}:${c.channel ?? ''}:${c.fadeInMs ?? 0}:${c.fadeOutMs ?? 0}:${c.duckDepth ?? ''}:${c.loop ? 1 : 0}:${c.pan ?? 0}`,
      )
      .join('|') +
    sfxEnvKey +
    fxKey +
    (anyDuck ? `#w${wordsLen}` : '')
  )
}

export type { SfxCue, ClipEditsAudio }
