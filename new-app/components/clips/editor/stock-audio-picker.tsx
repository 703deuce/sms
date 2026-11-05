'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { toast } from 'sonner'

type Hit = {
  id: string
  title: string
  kind: 'music' | 'sfx'
  license: 'elevenlabs' | 'cc0'
  durationS: number
  tags: string[]
  mood?: string
  genre?: string
  bpm?: number
  previewUrl: string
}

type Preset = {
  id: string
  title: string
  mood: string
  genre: string
  lengthS: number
  prompt: string
}

export function StockAudioPicker({
  clipId,
  kind,
  playheadMs,
  hasMusicBed,
  onGeneratePreset,
  uploadLibraryFiles: _uploadLibraryFiles,
  onMusicUploaded,
  onSfxUploaded,
}: {
  clipId: string
  kind: 'music' | 'sfx'
  playheadMs: number
  hasMusicBed: boolean
  onGeneratePreset: (prompt: string, lengthS: number) => void
  uploadLibraryFiles?: (files: File[]) => Promise<ProjectMediaItem[]>
  onMusicUploaded: (uploadId: string) => void
  onSfxUploaded: (uploadId: string, atMs: number) => void
}) {
  const [q, setQ] = useState('')
  const [mood, setMood] = useState('')
  const [genre, setGenre] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [available, setAvailable] = useState(true)
  const [busy, setBusy] = useState(false)

  const search = async () => {
    setBusy(true)
    try {
      const params = new URLSearchParams({ kind, q })
      if (mood) params.set('mood', mood)
      if (genre) params.set('genre', genre)
      const data = await clipsFetch<{ available: boolean; hits: Hit[]; presets?: Preset[] }>(
        `/api/clips/stock-audio/search?${params}`,
      )
      setHits(data.hits ?? [])
      setAvailable(data.available !== false)
      setPresets(kind === 'music' ? data.presets ?? [] : [])
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void search()
  }, [kind])

  const addHit = async (hit: Hit) => {
    setBusy(true)
    toast.loading(`Adding ${hit.title}…`, { id: 'stock-audio-attach' })
    try {
      const data = await clipsFetch<{ uploadId: string }>(`/api/clips/clips/${clipId}/stock-audio/attach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockId: hit.id }),
      })
      const uploadId = data.uploadId
      if (!uploadId) throw new Error('Attach failed')
      if (hit.kind === 'music') onMusicUploaded(uploadId)
      else onSfxUploaded(uploadId, playheadMs)
      toast.dismiss('stock-audio-attach')
      if (hit.kind === 'music') toast.success(`Added ${hit.title} to Music`)
      else {
        const secs = Math.max(0, Math.floor(playheadMs / 1000))
        const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
        toast.success(`Added to SFX at ${time}`, { description: hit.title })
      }
    } catch (e) {
      toast.dismiss('stock-audio-attach')
      toast.error(e instanceof Error ? e.message : 'Could not add audio')
    } finally {
      setBusy(false)
    }
  }

  const moods = useMemo(() => [...new Set(presets.map((p) => p.mood))], [presets])

  return (
    <div className="space-y-2" data-testid="stock-audio-picker">
      {kind === 'sfx' ? (
        <span
          className="inline-flex rounded border border-border/80 bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
          data-testid="stock-sfx-license-badge"
        >
          CC0 · Kenney
        </span>
      ) : null}
      <div className="flex flex-wrap gap-1">
        <input
          className="min-w-0 flex-1 rounded border border-border px-2 py-1 text-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={kind === 'sfx' ? 'Search SFX…' : 'Search music…'}
          data-testid="stock-audio-search"
        />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void search()}>
          Search
        </Button>
      </div>
      {kind === 'music' ? (
        <p className="text-[11px] text-muted-foreground">Browse CC0 instrumental loops (no credits), or generate a custom track below.</p>
      ) : null}
      <ul className="max-h-48 space-y-1 overflow-y-auto">
          {hits.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between gap-2 rounded border border-border/60 px-2 py-1 text-[11px]"
              data-testid="stock-audio-hit"
            >
              <div className="min-w-0 flex-1">
                <div className="break-words font-medium" title={h.title}>{h.title}</div>
                <div className="text-muted-foreground">
                  {h.mood ? `${h.mood} · ` : ''}
                  {h.genre ? `${h.genre} · ` : ''}
                  {h.durationS > 0 ? `${h.durationS}s` : 'Loop'} {h.bpm ? `· ${h.bpm} BPM` : ''}
                </div>
                <span className="text-[11px]">{h.license === 'cc0' ? 'CC0' : 'AI-generated'}</span>
              </div>
              <div className="flex shrink-0 gap-1">
                <audio src={h.previewUrl} controls preload="none" className="h-7 w-24 min-w-0 sm:w-32" aria-label={`Preview ${h.title}`} />
                <Button size="xs" disabled={busy} data-testid="stock-audio-add" onClick={() => void addHit(h)}>
                  {busy ? 'Adding…' : 'Add'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      {kind === 'music' && presets.length > 0 ? (
        <div className="grid max-h-48 gap-2 overflow-y-auto" data-testid="stock-audio-generation-presets">
          <p className="text-[11px] font-medium text-muted-foreground">Generate more music (credits)</p>
          {presets.slice(0, 12).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs" data-testid="stock-audio-preset">
              <span>
                {p.title} · {p.lengthS}s
              </span>
              <Button size="xs" variant="outline" onClick={() => onGeneratePreset(p.prompt, p.lengthS)}>
                Generate
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {kind === 'music' && available && moods.length ? (
        <div className="flex flex-wrap gap-1">
          {moods.slice(0, 6).map((m) => (
            <Button key={m} size="xs" variant={mood === m ? 'default' : 'outline'} onClick={() => setMood(m === mood ? '' : m)}>
              {m}
            </Button>
          ))}
        </div>
      ) : null}
      {kind === 'music' && hasMusicBed ? (
        <p className="text-[11px] text-muted-foreground">Music bed exists — new music adds as SFX at the playhead.</p>
      ) : null}
    </div>
  )
}
