'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Sparkles } from 'lucide-react'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { T2vMusicLibraryTrack } from '@/lib/t2v/music-library-catalog'

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
  const music = doc.music ?? { volume: 0.25, duck: true }
  const [tracks, setTracks] = useState<T2vMusicLibraryTrack[]>([])
  const [prompt, setPrompt] = useState('Instrumental background music for a short explainer video')
  const [genBusy, setGenBusy] = useState(false)
  const [moodFilter, setMoodFilter] = useState<string | 'all'>('all')

  useEffect(() => {
    void fetch('/api/t2v/music/library')
      .then((r) => r.json())
      .then((b) => setTracks(b.data?.tracks ?? []))
      .catch(() => {})
  }, [])

  const filtered = tracks.filter((t) => moodFilter === 'all' || t.mood === moodFilter)

  const useTrack = async (t: T2vMusicLibraryTrack) => {
    if (!t.generationId) {
      toast.message('Track not generated yet — use Generate or run seed-t2v-music')
      return
    }
    const res = await fetch(`/api/t2v/drafts/${draftId}/music`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'use', generationId: t.generationId, label: t.title }),
    })
    const body = await res.json()
    if (!res.ok) {
      toast.error(body.error ?? 'use_failed')
      return
    }
    onChange(body.data.document as T2vDraftV1)
    toast.success(`Music: ${t.title}`)
  }

  const generate = async () => {
    setGenBusy(true)
    try {
      const res = await fetch(`/api/t2v/drafts/${draftId}/music`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', prompt }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'generate_failed')
      toast.success('Generating music — check back in a minute')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setGenBusy(false)
    }
  }

  return (
    <div className="space-y-4 overflow-y-auto p-4">
      <div className="flex flex-wrap gap-2">
        {MOODS.map((m) => (
          <button
            key={m}
            type="button"
            className={`rounded-full border px-3 py-1 text-xs ${moodFilter === m || music.label === m ? 'border-primary bg-primary/10' : 'border-border'}`}
            onClick={() => {
              setMoodFilter(m)
              onChange({ ...doc, music: { ...music, label: m } })
            }}
          >
            {m}
          </button>
        ))}
      </div>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
        {filtered.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1">
            <span>{t.title} · {t.mood} · {Math.floor(t.durationSec / 60)}:{String(t.durationSec % 60).padStart(2, '0')}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void useTrack(t)}>Use</Button>
          </li>
        ))}
      </ul>
      <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
        <Label>Generate music for this video</Label>
        <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <Button type="button" size="sm" disabled={genBusy || !draftId} onClick={() => void generate()}>
          {genBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
          Generate
        </Button>
      </div>
      <div>
        <Label>Volume ({Math.round(music.volume * 100)}%)</Label>
        <Slider
          className="mt-2"
          min={0}
          max={100}
          step={5}
          value={[Math.round(music.volume * 100)]}
          onValueChange={(vals) => {
            const v = Array.isArray(vals) ? vals[0] : vals
            onChange({ ...doc, music: { ...music, volume: Number(v) / 100 } })
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="t2v-duck">Duck under voice</Label>
        <Switch
          id="t2v-duck"
          checked={music.duck}
          onCheckedChange={(on) => onChange({ ...doc, music: { ...music, duck: on } })}
        />
      </div>
      {music.label ? <p className="text-xs text-muted-foreground">Current: {music.label}</p> : null}
    </div>
  )
}
