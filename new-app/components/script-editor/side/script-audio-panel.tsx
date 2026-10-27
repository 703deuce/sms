'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGeneration } from '@/components/clips/editor/use-generation'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  DEFAULT_DUCK_DEPTH,
  DEFAULT_MUSIC_VOLUME,
  musicCostUsd,
  normalizeAudioEdits,
  SFX_PRESETS,
  type ClipEditsAudio,
} from '@/lib/clips/audio'
import { StudioSoundControls } from '@/components/script-editor/studio-sound-controls'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import { clipsFetch } from '@/lib/clips-api'
import { toast } from 'sonner'

export function ScriptAudioPanel({
  compositionId,
  document,
  outputDurationMs,
  playheadOutMs,
  onPatchAudio,
  onPatchAudioFx,
}: {
  compositionId: string
  document: ScriptDocumentV1
  outputDurationMs: number
  playheadOutMs: number
  onPatchAudio: (audio: ClipEditsAudio | null) => void
  onPatchAudioFx: (fx: ScriptDocumentV1['audioFx'] | null) => void
}) {
  const audio = useMemo(() => normalizeAudioEdits(document.audio ?? { music: null, sfx: [] }), [document.audio])
  const studio = document.audioFx?.studioSound
  const studioGen = useGeneration(studio?.assetId ?? null)
  const enqueueRef = useRef(false)
  const [prompt, setPrompt] = useState('')
  const [instrumental, setInstrumental] = useState(true)
  const [busy, setBusy] = useState(false)
  const [activeGen, setActiveGen] = useState<string | null>(null)
  const gen = useGeneration(activeGen)
  const musicGen = useGeneration(audio.music?.generationId ?? null)

  const cost = musicCostUsd(outputDurationMs)

  const attachMusic = useCallback(
    (generationId: string) => {
      onPatchAudio({
        music: {
          generationId,
          volume: audio.music?.volume ?? DEFAULT_MUSIC_VOLUME,
          duckDepth: audio.music?.duckDepth ?? DEFAULT_DUCK_DEPTH,
        },
        sfx: audio.sfx,
      })
      toast.success('Music attached to composition')
    },
    [audio.music?.duckDepth, audio.music?.volume, audio.sfx, onPatchAudio],
  )

  const enqueueStudioSound = useCallback(async () => {
    const { generationId } = await clipsFetch<{ generationId: string }>(
      `/api/clips/compositions/${compositionId}/studio-sound`,
      { method: 'POST', body: '{}' },
    )
    onPatchAudioFx({
      ...document.audioFx,
      studioSound: { enabled: true, mix: studio?.mix ?? 0.8, assetId: generationId },
    })
  }, [compositionId, document.audioFx, onPatchAudioFx, studio?.mix])

  useEffect(() => {
    if (!studio?.enabled) {
      enqueueRef.current = false
      return
    }
    if (studio.assetId && (studioGen.status === 'READY' || studioGen.status === 'FAILED')) return
    if (studio.assetId && studioGen.running) return
    if (!studio.assetId && !enqueueRef.current) {
      enqueueRef.current = true
      void enqueueStudioSound().catch(() => {
        enqueueRef.current = false
        toast.error('Could not start Studio Sound')
      })
    }
  }, [studio?.enabled, studio?.assetId, studioGen.running, studioGen.status, enqueueStudioSound])

  useEffect(() => {
    if (studioGen.status === 'READY' && studio?.enabled) {
      toast.success('Studio Sound applied')
    }
  }, [studioGen.status, studio?.enabled])

  useEffect(() => {
    if (gen.failed && activeGen) {
      setActiveGen(null)
      toast.error('Music generation failed')
      return
    }
    if (gen.status === 'READY' && activeGen) {
      attachMusic(activeGen)
      setActiveGen(null)
    }
  }, [gen.status, gen.failed, activeGen, attachMusic])

  const suggest = async () => {
    setBusy(true)
    try {
      const data = await clipsFetch<{ prompt: string }>(
        `/api/clips/compositions/${compositionId}/music/suggest`,
        { method: 'POST', body: '{}' },
      )
      setPrompt(data.prompt)
    } finally {
      setBusy(false)
    }
  }

  const generateMusic = async () => {
    if (!prompt.trim()) return
    setBusy(true)
    try {
      const data = await clipsFetch<{ generationId: string }>(`/api/clips/compositions/${compositionId}/music`, {
        method: 'POST',
        body: JSON.stringify({ prompt, instrumental }),
      })
      setActiveGen(data.generationId)
    } finally {
      setBusy(false)
    }
  }

  const placeSfx = async (presetId?: string, promptText?: string) => {
    setBusy(true)
    try {
      const data = await clipsFetch<{ generationId: string }>(`/api/clips/compositions/${compositionId}/sfx`, {
        method: 'POST',
        body: JSON.stringify({ presetId, prompt: promptText }),
      })
      onPatchAudio({
        music: audio.music,
        sfx: [...audio.sfx, { generationId: data.generationId, atMs: Math.round(playheadOutMs), volume: 0.8 }],
      })
      toast.success('SFX placed at playhead')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-3 text-sm" data-testid="script-audio-panel">
      <StudioSoundControls
        studio={
          studio
            ? {
                enabled: studio.enabled,
                mix: studio.mix ?? 0.8,
                generationId: studio.assetId ?? null,
              }
            : null
        }
        studioGen={studioGen}
        defaultMix={0.8}
        onChange={(next) => {
          onPatchAudioFx({
            ...document.audioFx,
            studioSound: {
              enabled: next.enabled,
              mix: next.mix,
              assetId: next.generationId ?? studio?.assetId ?? null,
            },
          })
        }}
        onRetryEnqueue={() => {
          enqueueRef.current = false
          void enqueueStudioSound().catch(() => toast.error('Could not start Studio Sound'))
        }}
      />

      <div className="rounded-[10px] border border-border bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-[13px] font-semibold">Room tone</Label>
          <Switch
            checked={document.audioFx?.roomTone ?? false}
            onCheckedChange={(roomTone) =>
              onPatchAudioFx({
                ...document.audioFx,
                roomTone,
              })
            }
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Loops a quiet 2s bed under timeline gaps on export (−6 dB).
        </p>
      </div>

      <div className="rounded-[10px] border border-border bg-muted/20 p-3">
        <p className="text-[13px] font-semibold">Auto-level</p>
        <p className="mt-1 text-xs text-muted-foreground">Target loudness on export (−16 LUFS default).</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {([-16, -14, -18] as const).map((lufs) => (
            <Button
              key={lufs}
              type="button"
              size="sm"
              variant={document.audioFx?.loudnessLufs === lufs ? 'default' : 'outline'}
              className="h-7 text-[10px]"
              onClick={() =>
                onPatchAudioFx({
                  ...document.audioFx,
                  loudnessLufs: lufs,
                })
              }
            >
              {lufs} LUFS
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={document.audioFx?.loudnessLufs == null ? 'default' : 'outline'}
            className="h-7 text-[10px]"
            onClick={() => onPatchAudioFx({ ...document.audioFx, loudnessLufs: null })}
          >
            Off
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold">Music</p>
        <textarea
          className="mb-2 min-h-[72px] w-full rounded-lg border border-input bg-muted/30 px-2 py-1.5 text-xs"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe instrumental bed…"
        />
        <div className="mb-2 flex items-center gap-2">
          <Switch id="instr" checked={instrumental} onCheckedChange={setInstrumental} />
          <Label htmlFor="instr" className="text-xs">Instrumental</Label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void suggest()}>
            Suggest
          </Button>
          <Button type="button" size="sm" disabled={busy || !prompt.trim()} onClick={() => void generateMusic()}>
            Generate (~${cost.toFixed(2)})
          </Button>
          {audio.music && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onPatchAudio({ music: null, sfx: audio.sfx })}>
              Remove
            </Button>
          )}
        </div>
        {audio.music && (
          <p className="mt-2 text-xs text-muted-foreground">
            Track: {musicGen.status || '…'} · vol {(audio.music.volume ?? DEFAULT_MUSIC_VOLUME).toFixed(2)}
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold">SFX at playhead</p>
        <div className="flex flex-wrap gap-1">
          {SFX_PRESETS.slice(0, 6).map((p) => (
            <Button key={p.id} type="button" size="sm" variant="outline" className="h-7 text-[10px]" disabled={busy} onClick={() => void placeSfx(p.id)}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
