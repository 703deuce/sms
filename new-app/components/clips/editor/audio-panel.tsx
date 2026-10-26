'use client'

import { useEffect, useState } from 'react'
import { useGeneration } from '@/components/clips/editor/use-generation'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { musicCostUsd, SFX_PRESETS } from '@/lib/clips/audio'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'

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
}) {
  const [prompt, setPrompt] = useState('')
  const [instrumental, setInstrumental] = useState(true)
  const [busy, setBusy] = useState(false)
  const [customSfx, setCustomSfx] = useState('')
  const [activeGen, setActiveGen] = useState<string | null>(null)
  const gen = useGeneration(activeGen)
  const music = edits.audio?.music
  const musicGen = useGeneration(music?.generationId ?? null)

  const cost = musicCostUsd(outputDurationMs)

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
    <div className="space-y-4 p-3 text-sm">
      <section className="space-y-2">
        <h3 className="font-medium">Music</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void suggest()}>Suggest</Button>
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} />
            Instrumental
          </label>
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
    </div>
  )
}
