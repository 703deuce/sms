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
  normalizeAudioEdits,
  SFX_PRESETS,
  type ClipStudioSound,
} from '@/lib/clips/audio'
import { isSpeechLevelingEnabled, speechLevelingPatch } from '@/lib/clips/speech-leveling'
import { normalizeEditSpeed } from '@/lib/clips/edits'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'
import { creditsLabel, musicCredits } from '@/lib/clips/credit-cost'
import { clipEditorAiExtrasEnabled } from '@/lib/clips/clip-editor-feature-flags'
import { toast } from 'sonner'
import { StockAudioPicker } from '@/components/clips/editor/stock-audio-picker'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { TextVoiceoverSection } from '@/components/clips/editor/text-voiceover-section'
import type { ClipAudioSfx } from '@/lib/clips/edits'

export function AudioPanel({
  clipId,
  edits,
  outputDurationMs,
  playheadMs,
  playheadSourceMs,
  onSuggestMusic,
  onAttachMusic,
  onPatchMusic,
  onRemoveMusic,
  onAddSfx,
  onUpdateSfx,
  onRemoveSfx,
  onPatchStudioSound,
  onStartStudioSound,
  studioSlow,
  onRetryStudioPoll,
  onPatchExportAudio,
  uploadLibraryFiles,
  textVoiceover,
  addVoiceoverSfx,
}: {
  clipId: string
  edits: ClipEditsV2
  outputDurationMs: number
  playheadMs: number
  playheadSourceMs?: number
  onSuggestMusic: (prompt: string) => void
  onAttachMusic: (generationId: string) => void
  onPatchMusic: (patch: { volume?: number; duckDepth?: number }) => void
  onRemoveMusic: () => void
  onAddSfx: (generationId: string, atMs: number) => void
  onUpdateSfx: (generationId: string, patch: { atMs?: number; volume?: number }) => void
  onRemoveSfx: (generationId: string) => void
  onPatchStudioSound: (studio: ClipStudioSound | null) => void
  onStartStudioSound?: () => void
  studioSlow?: boolean
  onRetryStudioPoll?: () => void
  onPatchExportAudio?: (
    patch: Pick<ClipEditsV2, 'loudnessLufs' | 'speed' | 'speechLevelingEnabled'> & {
      speed?: ClipEditsV2['speed'] | null
    },
  ) => void
  uploadLibraryFiles?: (files: File[]) => Promise<ProjectMediaItem[]>
  /** Selected plain text item — stock TTS (same as Text panel). */
  textVoiceover?: { text: string; atMs: number } | null
  addVoiceoverSfx?: (item: ClipAudioSfx) => void
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

  const [previewGenId, setPreviewGenId] = useState<string | null>(null)
  const previewGen = useGeneration(previewGenId)
  const [previewBusy, setPreviewBusy] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  const previewStudio10s = useCallback(async () => {
    const start = Math.max(0, Math.round(playheadSourceMs ?? playheadMs))
    setPreviewBusy(true)
    try {
      const data = await clipsFetch<{ generationId: string }>(
        `/api/clips/clips/${clipId}/studio-sound`,
        {
          method: 'POST',
          body: JSON.stringify({ previewOnly: true, windowStartMs: start, windowDurationMs: 10_000 }),
        },
      )
      setPreviewGenId(data.generationId)
    } catch {
      toast.error('Could not start Studio Sound preview')
      setPreviewBusy(false)
    }
  }, [clipId, playheadMs, playheadSourceMs])

  useEffect(() => {
    if (previewGen.status !== 'READY' || !previewGen.downloadUrl) return
    setPreviewBusy(false)
    previewAudioRef.current?.pause()
    const audio = new Audio(previewGen.downloadUrl)
    audio.volume = Math.max(0, Math.min(1, studio?.mix ?? DEFAULT_STUDIO_SOUND_MIX))
    previewAudioRef.current = audio
    void audio.play().catch(() => toast.error('Could not play preview'))
    toast.message('10s Studio Sound preview')
  }, [previewGen.status, previewGen.downloadUrl, studio?.mix])

  useEffect(() => {
    if (previewGen.failed) {
      setPreviewBusy(false)
      toast.error('Studio Sound preview failed')
    }
  }, [previewGen.failed])

  const credits = musicCredits()

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
      <section className="space-y-2 rounded-md border border-border p-3" data-testid="clip-export-audio">
        <h3 className="font-medium">Export audio</h3>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm">Level speech volume</p>
            <p className="text-xs text-muted-foreground">
              Evens out loud and quiet parts (−14 LUFS, TikTok/Shorts standard)
            </p>
          </div>
          <Switch
            checked={isSpeechLevelingEnabled(edits)}
            onCheckedChange={(on) => {
              onPatchExportAudio?.(speechLevelingPatch(on))
            }}
            aria-label="Level speech volume"
          />
        </div>
        {isSpeechLevelingEnabled(edits) ? (
          <p className="text-xs text-muted-foreground">Applied on export</p>
        ) : null}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Speed</p>
          <div className="flex flex-wrap gap-1">
            {([1, 1.1, 1.25, 1.5] as const).map((s) => {
              const active =
                s === 1 ? normalizeEditSpeed(edits.speed) === undefined : edits.speed === s
              return (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  className="h-7 min-w-[3rem] px-2"
                  onClick={() =>
                    onPatchExportAudio?.({ speed: s === 1 ? null : s })
                  }
                >
                  {s === 1 ? '1×' : `${s}×`}
                </Button>
              )
            })}
          </div>
        </div>
      </section>
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
        onPreview10s={() => void previewStudio10s()}
        previewBusy={previewBusy || previewGen.running}
      />
      {studioSlow ? (
        <div
          className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground"
          data-testid="studio-sound-slow"
        >
          <p>Studio Sound is still processing — it will apply when ready.</p>
          {onRetryStudioPoll ? (
            <Button type="button" size="sm" variant="outline" className="mt-2 h-7" onClick={onRetryStudioPoll}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}
      {textVoiceover && uploadLibraryFiles && addVoiceoverSfx ? (
        <section data-testid="audio-panel-voiceover">
          <TextVoiceoverSection
            clipId={clipId}
            text={textVoiceover.text}
            atMs={textVoiceover.atMs}
            uploadLibraryFiles={uploadLibraryFiles}
            addSfx={addVoiceoverSfx}
          />
        </section>
      ) : null}
      <section className="space-y-2 rounded-md border border-border p-2" data-testid="audio-library">
        <h3 className="font-medium">Library</h3>
        <StockAudioPicker
          kind="music"
          playheadMs={playheadMs}
          hasMusicBed={Boolean(music)}
          uploadLibraryFiles={uploadLibraryFiles}
          onGeneratePreset={(p) => {
            if (!aiExtras) {
              toast.message('AI music generation requires workspace AI extras')
              return
            }
            setPrompt(p)
            setBusy(true)
            void clipsFetch<{ generationId: string }>(`/api/clips/clips/${clipId}/music`, {
              method: 'POST',
              body: JSON.stringify({ prompt: p, instrumental: true }),
            })
              .then((data) => setActiveGen(data.generationId))
              .finally(() => setBusy(false))
          }}
          onMusicUploaded={(uploadId) => {
            if (!music) onAttachMusic(uploadId)
            else onAddSfx(uploadId, playheadMs)
          }}
          onSfxUploaded={(uploadId, atMs) => onAddSfx(uploadId, atMs)}
        />
        <StockAudioPicker
          kind="sfx"
          playheadMs={playheadMs}
          hasMusicBed={false}
          uploadLibraryFiles={uploadLibraryFiles}
          onGeneratePreset={() => {}}
          onMusicUploaded={() => {}}
          onSfxUploaded={(uploadId, atMs) => onAddSfx(uploadId, atMs)}
        />
      </section>
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
        <p className="text-xs text-muted-foreground">Uses {creditsLabel(credits)}</p>
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
