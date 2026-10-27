'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGeneration } from '@/components/clips/editor/use-generation'
import { StudioSoundControls } from '@/components/script-editor/studio-sound-controls'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  DEFAULT_STUDIO_SOUND_MIX,
  musicCostUsd,
  normalizeAudioEdits,
  SFX_PRESETS,
  type ClipStudioSound,
} from '@/lib/clips/audio'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'
import { clipEditorAiExtrasEnabled } from '@/lib/clips/clip-editor-feature-flags'
import { toast } from 'sonner'

export function AudioPanel({
  clipId,
  edits,
  outputDurationMs,
  playheadMs,
  onSuggestMusic,
  onAttachMusic,
  onPatchMusic,
  onRemoveMusic,
  onAddSfx,
  onUpdateSfx,
  onRemoveSfx,
  onPatchStudioSound,
  onStartStudioSound,
}: {
  clipId: string
  edits: ClipEditsV2
  outputDurationMs: number
  playheadMs: number
  onSuggestMusic: (prompt: string) => void
  onAttachMusic: (generationId: string) => void
  onPatchMusic: (patch: { volume?: number; duckDepth?: number }) => void
  onRemoveMusic: () => void
  onAddSfx: (generationId: string, atMs: number) => void
  onUpdateSfx: (generationId: string, patch: { atMs?: number; volume?: number }) => void
  onRemoveSfx: (generationId: string) => void
  onPatchStudioSound: (studio: ClipStudioSound | null) => void
  onStartStudioSound?: () => void
}) {
  const [prompt, setPrompt] = useState('')
  const [instrumental, setInstrumental] = useState(true)
  const [busy, setBusy] = useState(false)
  const [customSfx, setCustomSfx] = useState('')
  const [activeGen, setActiveGen] = useState<string | null>(null)
  const gen = useGeneration(activeGen)
  const audioNorm = useMemo(() => normalizeAudioEdits(edits.audio), [edits.audio])
  const studio = audioNorm.studioSound
  const studioGen = useGeneration(studio?.generationId ?? null)
  const studioEnqueueRef = useRef(false)
  const studioReadyToastRef = useRef<string | null>(null)
  const sawStudioRunningRef = useRef(false)
  const music = audioNorm.music
  const musicGen = useGeneration(music?.generationId ?? null)
  const aiExtras = clipEditorAiExtrasEnabled()

  const cost = musicCostUsd(outputDurationMs)

  const enqueueStudioSound = useCallback(async () => {
    const { generationId } = await clipsFetch<{ generationId: string }>(
      `/api/clips/clips/${clipId}/studio-sound`,
      { method: 'POST', body: '{}' },
    )
    onPatchStudioSound({
      enabled: true,
      generationId,
      mix: studio?.mix ?? DEFAULT_STUDIO_SOUND_MIX,
    })
  }, [clipId, onPatchStudioSound, studio?.mix])

  useEffect(() => {
    if (studioGen.running) sawStudioRunningRef.current = true
  }, [studioGen.running])

  useEffect(() => {
    if (studioGen.status !== 'READY' || !studio?.enabled || !studio.generationId) return
    if (!sawStudioRunningRef.current) return
    if (studioReadyToastRef.current === studio.generationId) return
    studioReadyToastRef.current = studio.generationId
    sawStudioRunningRef.current = false
    toast.success('Studio Sound ready for preview')
  }, [studio?.enabled, studio?.generationId, studioGen.status])

  const suggest = async () => {
    setBusy(true)
    try {
      const data = await clipsFetch<{ prompt: string }>(`/api/clips/clips/${clipId}/music/suggest`, {
        method: 'POST',
        body: '{}',
      })
      setPrompt(data.prompt)
      onSuggestMusic(data.prompt)
    } finally {
      setBusy(false)
    }
  }

  const generateMusic = async () => {
    if (!prompt.trim()) return
    setBusy(true)
    try {
      const data = await clipsFetch<{ generationId: string }>(`/api/clips/clips/${clipId}/music`, {
        method: 'POST',
        body: JSON.stringify({ prompt, instrumental }),
      })
      setActiveGen(data.generationId)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (gen.failed && activeGen) {
      setActiveGen(null)
      return
    }
    if (gen.status === 'READY' && activeGen) {
      onAttachMusic(activeGen)
      setActiveGen(null)
    }
  }, [gen.status, gen.failed, activeGen, onAttachMusic])

  const placeSfx = async (presetId?: string, promptText?: string) => {
    setBusy(true)
    try {
      const data = await clipsFetch<{ generationId: string }>(`/api/clips/clips/${clipId}/sfx`, {
        method: 'POST',
        body: JSON.stringify({ presetId, prompt: promptText }),
      })
      onAddSfx(data.generationId, playheadMs)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 p-3 text-sm" data-testid="clip-audio-panel">
      <StudioSoundControls
        studio={
          studio
            ? {
                enabled: studio.enabled,
                mix: studio.mix ?? DEFAULT_STUDIO_SOUND_MIX,
                generationId: studio.generationId,
              }
            : null
        }
        studioGen={studioGen}
        defaultMix={DEFAULT_STUDIO_SOUND_MIX}
        onChange={(next) => {
          if (!next.enabled) {
            studioEnqueueRef.current = false
            onPatchStudioSound(
              studio
                ? { enabled: false, generationId: studio.generationId, mix: next.mix }
                : null,
            )
            return
          }
          const priorId = (next.generationId ?? studio?.generationId ?? '').trim()
          onPatchStudioSound({
            enabled: true,
            mix: next.mix,
            generationId: priorId,
          })
          if (!priorId || studioGen.failed) {
            studioEnqueueRef.current = false
            if (onStartStudioSound) {
              onStartStudioSound()
            } else {
              void enqueueStudioSound().catch(() => {
                studioEnqueueRef.current = false
                toast.error('Could not start Studio Sound')
              })
            }
          }
        }}
        onRetryEnqueue={() => {
          studioEnqueueRef.current = false
          void enqueueStudioSound()
        }}
      />
      {aiExtras ? (
      <section className="space-y-2">
        <h3 className="font-medium">Music</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void suggest()}>Suggest</Button>
          <div className="flex items-center gap-2">
            <Switch
              id="music-instrumental"
              checked={instrumental}
              onCheckedChange={(v) => setInstrumental(v === true)}
            />
            <Label htmlFor="music-instrumental" className="text-xs font-normal">
              Instrumental
            </Label>
          </div>
        </div>
        <textarea
          className="w-full min-h-[72px] rounded border border-border bg-background p-2 text-xs"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Music prompt…"
        />
        <p className="text-xs text-muted-foreground">About ${cost.toFixed(2)} for this clip</p>
        <Button size="sm" disabled={busy || !prompt.trim()} onClick={() => void generateMusic()}>
          Generate
        </Button>
        {activeGen && !gen.failed && (
          <p className="text-xs text-muted-foreground">Generating… {gen.status}</p>
        )}
        {activeGen && gen.failed && (
          <p className="text-xs text-destructive">{gen.error || 'Music generation failed'}</p>
        )}
        {music && (
          <div className="space-y-2 rounded border border-border p-2">
            <p className="text-xs">Status: {musicGen.status || '—'}</p>
            <label className="block space-y-2 text-xs">
              <span>Volume {Math.round((music.volume ?? 0.25) * 100)}%</span>
              <Slider
                min={0}
                max={100}
                value={[Math.round((music.volume ?? 0.25) * 100)]}
                onValueChange={(v) => {
                  const n = Array.isArray(v) ? v[0] : v
                  onPatchMusic({ volume: (typeof n === 'number' ? n : 25) / 100 })
                }}
              />
            </label>
            <label className="block space-y-2 text-xs">
              <span>Duck depth {Math.round((music.duckDepth ?? 0.7) * 100)}%</span>
              <Slider
                min={0}
                max={100}
                value={[Math.round((music.duckDepth ?? 0.7) * 100)]}
                onValueChange={(v) => {
                  const n = Array.isArray(v) ? v[0] : v
                  onPatchMusic({ duckDepth: (typeof n === 'number' ? n : 70) / 100 })
                }}
              />
            </label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onRemoveMusic}>Remove</Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void generateMusic()}>Regenerate</Button>
            </div>
          </div>
        )}
      </section>
      ) : null}

      {aiExtras ? (
      <section className="space-y-2">
        <h3 className="font-medium">Sound effects</h3>
        <div className="flex flex-wrap gap-1">
          {SFX_PRESETS.map((p) => (
            <Button key={p.id} size="sm" variant="secondary" disabled={busy} onClick={() => void placeSfx(p.id)}>
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-border px-2 py-1 text-xs"
            value={customSfx}
            onChange={(e) => setCustomSfx(e.target.value)}
            placeholder="Custom SFX prompt"
          />
          <Button size="sm" disabled={busy || !customSfx.trim()} onClick={() => void placeSfx(undefined, customSfx)}>
            Add
          </Button>
        </div>
        <ul className="space-y-1 text-xs">
          {(edits.audio?.sfx || []).map((s) => (
            <li key={s.generationId} className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1">
              <span>
                {Math.floor(s.atMs / 1000)}s · vol {Math.round((s.volume ?? 0.8) * 100)}%
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => onUpdateSfx(s.generationId, { atMs: playheadMs })}>
                  Move to playhead
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onRemoveSfx(s.generationId)}>×</Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      ) : null}
    </div>
  )
}
