'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Sparkles, Upload } from 'lucide-react'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useGeneration } from '@/components/clips/editor/use-generation'
import { DEFAULT_MUSIC_VOLUME, musicCostUsd } from '@/lib/clips/audio'
import { uploadClipFile } from '@/lib/clips/upload'
import type { T2vProjectMusicRow } from '@/lib/t2v/music-types'
import { estimateSceneMs } from '@/lib/t2v/estimate'

const MOODS = ['Upbeat', 'Calm', 'Corporate', 'Cinematic', 'Inspiring', 'Playful', 'Dramatic', 'Lo-fi'] as const

export function T2vPanelMusic({
  draftId,
  doc,
  onChange,
}: {
  draftId: string
  doc: T2vDraftV1
  onChange: (next: T2vDraftV1) => void
}) {
  const music = doc.music?.disabled ? null : (doc.music ?? { volume: DEFAULT_MUSIC_VOLUME, duck: true })
  const [tracks, setTracks] = useState<T2vProjectMusicRow[]>([])
  const [prompt, setPrompt] = useState('')
  const [genBusy, setGenBusy] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const activeGen = music?.generationId ?? null
  const musicGen = useGeneration(activeGen)
  const attachRef = useRef<string | null>(null)

  const refreshMeta = useCallback(async () => {
    const res = await fetch(`/api/t2v/drafts/${draftId}/music`)
    const body = await res.json()
    if (!res.ok) return
    setTracks(body.data?.tracks ?? [])
    if (!prompt && body.data?.suggestedPrompt) setPrompt(body.data.suggestedPrompt)
  }, [draftId, prompt])

  useEffect(() => {
    void refreshMeta()
  }, [refreshMeta])

  const attachGeneration = useCallback(
    async (generationId: string, label?: string) => {
      const res = await fetch(`/api/t2v/drafts/${draftId}/music`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'use', generationId, label }),
      })
      const body = await res.json()
      if (!res.ok) {
        toast.error(body.error ?? 'use_failed')
        return
      }
      onChange(body.data.document as T2vDraftV1)
      toast.success('Music attached')
      void refreshMeta()
    },
    [draftId, onChange, refreshMeta],
  )

  useEffect(() => {
    if (!activeGen || musicGen.status !== 'READY') return
    if (attachRef.current === activeGen) return
    attachRef.current = activeGen
    void attachGeneration(activeGen)
  }, [activeGen, musicGen.status, attachGeneration])

  const generate = async (mood?: string) => {
    setGenBusy(true)
    try {
      const res = await fetch(`/api/t2v/drafts/${draftId}/music`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', prompt: prompt || undefined, mood }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'generate_failed')
      if (body.data?.document) onChange(body.data.document as T2vDraftV1)
      toast.success('Generating music…')
      void refreshMeta()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setGenBusy(false)
    }
  }

  const clearMusic = async () => {
    const res = await fetch(`/api/t2v/drafts/${draftId}/music`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear' }),
    })
    const body = await res.json()
    if (!res.ok) {
      toast.error(body.error ?? 'clear_failed')
      return
    }
    onChange(body.data.document as T2vDraftV1)
    toast.message('No background music')
  }

  const onUpload = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'audio/mpeg,audio/mp3,audio/wav,audio/x-m4a'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      setUploadBusy(true)
      void uploadClipFile(file, (p) => {
        if (p.state === 'error') {
          setUploadBusy(false)
          toast.error(p.error ?? 'Upload failed')
        }
      })
        .then(async ({ uploadId }) => {
          if (!uploadId) throw new Error('upload_failed')
          const res = await fetch(`/api/t2v/drafts/${draftId}/music`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'upload', uploadId }),
          })
          const body = await res.json()
          if (!res.ok) throw new Error(body.error ?? 'upload_failed')
          onChange(body.data.document as T2vDraftV1)
          toast.success('Uploaded music attached')
          void refreshMeta()
        })
        .catch(() => toast.error('Upload failed'))
        .finally(() => setUploadBusy(false))
    }
    input.click()
  }

  const lengthMs = doc.scenes.reduce((n, s) => n + estimateSceneMs(s), 0) || 60_000
  const estCost = musicCostUsd(lengthMs)

  return (
    <div className="space-y-4 overflow-y-auto p-4">
      <div className="rounded-lg border border-border p-3 text-sm">
        <p className="font-medium">Current track</p>
        {music?.disabled || !music ? (
          <p className="text-muted-foreground">No music</p>
        ) : (
          <p className="text-muted-foreground">
            {music.label ?? 'Music'} ·{' '}
            {musicGen.running ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> {musicGen.status ?? '…'}
              </span>
            ) : (
              musicGen.status ?? 'ready'
            )}
          </p>
        )}
        {musicGen.downloadUrl ? (
          <audio className="mt-2 w-full" controls src={musicGen.downloadUrl} preload="none" />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {MOODS.map((m) => (
          <button
            key={m}
            type="button"
            className={`rounded-full border px-3 py-1 text-xs ${music?.label === m ? 'border-primary bg-primary/10' : 'border-border'}`}
            onClick={() => {
              setPrompt(`${m.toLowerCase()} instrumental background music`)
              void generate(m)
            }}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
        <Label>Generate (ElevenLabs)</Label>
        <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the bed…" />
        <p className="text-xs text-muted-foreground">Est. length follows your storyboard · ~${estCost.toFixed(2)} tracked</p>
        <Button type="button" size="sm" disabled={genBusy || musicGen.running} onClick={() => void generate()}>
          {genBusy || musicGen.running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
          Generate
        </Button>
      </div>

      {tracks.length ? (
        <div>
          <Label>Earlier for this project</Label>
          <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-sm">
            {tracks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1">
                <span className="truncate">{t.prompt.slice(0, 48)} · {t.status}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={t.status !== 'READY'}
                  onClick={() => void attachGeneration(t.id, t.prompt.slice(0, 48))}
                >
                  Use
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <Label>Volume ({Math.round((music?.volume ?? DEFAULT_MUSIC_VOLUME) * 100)}%)</Label>
        <Slider
          className="mt-2"
          min={0}
          max={100}
          step={5}
          value={[Math.round((music?.volume ?? DEFAULT_MUSIC_VOLUME) * 100)]}
          onValueChange={(vals) => {
            const v = Array.isArray(vals) ? vals[0] : vals
            const base = doc.music ?? { volume: DEFAULT_MUSIC_VOLUME, duck: true }
            onChange({ ...doc, music: { ...base, disabled: false, volume: Number(v) / 100 } })
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="t2v-duck">Duck under voice</Label>
        <Switch
          id="t2v-duck"
          checked={music?.duck ?? true}
          onCheckedChange={(on) => {
            const base = doc.music ?? { volume: DEFAULT_MUSIC_VOLUME, duck: true }
            onChange({ ...doc, music: { ...base, disabled: false, duck: on } })
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={uploadBusy} onClick={onUpload}>
          {uploadBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
          Upload track
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => void clearMusic()}>
          No music
        </Button>
      </div>
    </div>
  )
}
