'use client'

import { useRef } from 'react'
import { AUDIO_FADE_MAX_MS, DEFAULT_DUCK_DEPTH, DEFAULT_MUSIC_FADE_IN_MS, DEFAULT_MUSIC_FADE_OUT_MS, DEFAULT_MUSIC_VOLUME, DEFAULT_SFX_VOLUME } from '@/lib/clips/audio'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { SliderRow } from '@/components/clips/editor/e4/slider-row'
import { fitClipToLength, fitMusicToLength, maxFadeMs, patchAudioClip, type AudioClipPatch } from '@/lib/clips/editor/audio-clip'
import { AUDIO_KIND_LABEL, type AudioClipKind } from '@/lib/clips/editor/audio-kind'
import { coalescePush, type CoalesceBurst } from '@/lib/clips/editor/undo-coalesce'

const pct = (v: number) => `${Math.round(v * 100)}%`
const sec = (ms: number) => (ms / 1000).toFixed(1)

/**
 * G2: selection inspector for the music bed or one audio clip (SFX lane / audio tracks) —
 * volume, fade in / out, ducking under the voice, and (music) loop + one-click "Fit to length".
 * Manual only: nothing here calls a paid service.
 */
export function AudioClipInspector({
  edits,
  lane,
  id,
  kind,
  lenMs,
  durationMs,
  mediaMs,
  bpm,
  readOnly = false,
  onCommit,
}: {
  edits: ClipEditsV2
  lane: 'music' | 'sfx'
  id: string
  /** G2fix: what the clip is — 'music' (bed or a Music N clip) gets Loop / Fit to length / BPM. */
  kind?: AudioClipKind
  /** G2fix: the clip's timeline length (fade limits; the length a clip loops to). */
  lenMs?: number
  /** Output length of the video (Fit to length). */
  durationMs: number
  /** Music media length when decoded (null = unknown). */
  mediaMs?: number | null
  /** Detected tempo (display only). */
  bpm?: number | null
  readOnly?: boolean
  onCommit: (next: ClipEditsV2, pushHistory?: boolean) => void
}) {
  const burst = useRef<CoalesceBurst | null>(null)
  const music = lane === 'music' ? edits.audio?.music : null
  const cue = lane === 'sfx' ? edits.audio?.sfx.find((s) => s.generationId === id) : null
  if (!music && !cue) return null
  // G2fix: a song on a Music N track has the same controls as the music bed.
  const isMusic = Boolean(music) || kind === 'music'
  const volume = music ? music.volume ?? DEFAULT_MUSIC_VOLUME : cue!.volume ?? DEFAULT_SFX_VOLUME
  const fadeIn = music ? music.fadeInMs ?? DEFAULT_MUSIC_FADE_IN_MS : cue!.fadeInMs ?? 0
  const fadeOut = music ? music.fadeOutMs ?? DEFAULT_MUSIC_FADE_OUT_MS : cue!.fadeOutMs ?? 0
  const pan = music ? music.pan ?? 0 : cue!.pan ?? 0
  // Ducking: the bed always has a depth (0 = off); a clip is ducked only when it stores one (music
  // clips get it when placed, plain SFX / audio never by default).
  const duck = music ? music.duckDepth ?? DEFAULT_DUCK_DEPTH : cue!.duckDepth
  const ducked = music ? (duck ?? 0) > 0 : duck != null && duck > 0
  const loop = Boolean(music ? music.loop : cue!.loop)
  const fadeMaxS = (lenMs != null && lenMs > 0 ? maxFadeMs(lenMs) : AUDIO_FADE_MAX_MS) / 1000
  const scope = `${lane}:${id}`
  const commitPatch = (p: AudioClipPatch, key: string) => {
    const before = lane === 'music' ? JSON.stringify(edits.audio?.music) : JSON.stringify(cue)
    const next = patchAudioClip(edits, lane, id, p)
    if (!next) return
    const now = Date.now()
    const k = `${scope}:${key}`
    const push = coalescePush(burst.current, k, now, before)
    burst.current = { key: k, at: now, sig: lane === 'music' ? JSON.stringify(next.audio?.music) : JSON.stringify(next.audio?.sfx.find((s) => s.generationId === id)) }
    onCommit(next, push)
  }
  const patch = (p: AudioClipPatch) => commitPatch(p, Object.keys(p)[0] ?? 'patch')
  const panLabel = (v: number) => {
    if (v === 0) return 'C'
    if (v < 0) return `L${Math.abs(v)}`
    return `R${v}`
  }
  const label = 'text-[11px] text-muted-foreground'
  const num =
    'h-6 w-14 rounded border border-border bg-background px-1 text-[11px] tabular-nums disabled:opacity-50'
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-card/60 px-2 py-1 text-[11px]"
      data-testid="audio-clip-inspector"
      data-lane={lane}
      data-kind={isMusic ? 'music' : kind ?? 'sfx'}
    >
      <span className="font-medium">{isMusic ? 'Music' : kind ? AUDIO_KIND_LABEL[kind] : 'Audio clip'}</span>
      <label className="flex items-center gap-1">
        <span className={label}>Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          disabled={readOnly}
          aria-label="Clip volume"
          data-testid="audio-clip-volume"
          className="h-3 w-20"
          onChange={(e) => patch({ volume: Number(e.target.value) / 100 })}
        />
        <span className="w-8 tabular-nums">{pct(volume)}</span>
      </label>
      <div className="w-36">
        <SliderRow
          label="Pan"
          value={pan}
          min={-100}
          max={100}
          step={1}
          disabled={readOnly}
          format={panLabel}
          onCommit={(v) => commitPatch({ pan: v }, 'pan')}
          testId="audio-clip-pan"
        />
      </div>
      <label className="flex items-center gap-1">
        <span className={label}>Fade in (s)</span>
        <input
          type="number"
          min={0}
          max={fadeMaxS}
          step={0.1}
          value={sec(fadeIn)}
          disabled={readOnly}
          aria-label="Fade in seconds"
          data-testid="audio-clip-fade-in"
          className={num}
          onChange={(e) => commitPatch({ fadeInMs: Number(e.target.value) * 1000 }, 'fadeInMs')}
        />
      </label>
      <label className="flex items-center gap-1">
        <span className={label}>Fade out (s)</span>
        <input
          type="number"
          min={0}
          max={fadeMaxS}
          step={0.1}
          value={sec(fadeOut)}
          disabled={readOnly}
          aria-label="Fade out seconds"
          data-testid="audio-clip-fade-out"
          className={num}
          onChange={(e) => commitPatch({ fadeOutMs: Number(e.target.value) * 1000 }, 'fadeOutMs')}
        />
      </label>
      <label className="flex items-center gap-1" title="Lower this clip while someone is speaking (preview + export)">
        <input
          type="checkbox"
          checked={ducked}
          disabled={readOnly}
          aria-label="Duck under voice"
          data-testid="audio-clip-duck"
          onChange={(e) => patch({ duckDepth: e.target.checked ? DEFAULT_DUCK_DEPTH : music ? 0 : null })}
        />
        <span className={label}>Duck under voice</span>
      </label>
      {ducked ? (
        <label className="flex items-center gap-1">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((duck ?? 0) * 100)}
            disabled={readOnly}
            aria-label="Duck depth"
            data-testid="audio-clip-duck-depth"
            className="h-3 w-16"
            onChange={(e) => patch({ duckDepth: Number(e.target.value) / 100 })}
          />
          <span className="w-8 tabular-nums">{pct(duck ?? 0)}</span>
        </label>
      ) : null}
      {isMusic ? (
        <>
          <label className="flex items-center gap-1" title="Repeat the song to fill its timeline window">
            <input
              type="checkbox"
              checked={loop}
              disabled={readOnly}
              aria-label="Loop music"
              data-testid="audio-clip-loop"
              onChange={(e) => patch({ loop: e.target.checked, ...(lenMs != null ? { durMs: lenMs } : {}) })}
            />
            <span className={label}>Loop</span>
          </label>
          <button
            type="button"
            className="h-6 rounded border border-border px-2 hover:bg-muted disabled:opacity-50"
            disabled={readOnly}
            data-testid="audio-clip-fit"
            title="Music from 0 to the end of the video: trims a long song, loops a short one, fades out over the last 2 s"
            onClick={() => {
              const next = music ? fitMusicToLength(edits, durationMs, mediaMs ?? null) : fitClipToLength(edits, id, durationMs, mediaMs ?? null)
              if (next) onCommit(next)
            }}
          >
            Fit to length
          </button>
          {bpm ? (
            <span className={label} data-testid="audio-clip-bpm">
              ~{Math.round(bpm)} BPM
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
