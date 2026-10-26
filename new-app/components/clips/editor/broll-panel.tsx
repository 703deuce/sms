'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AiBrollCard } from '@/components/clips/editor/ai-broll-card'
import { StockBrollPicker } from '@/components/clips/editor/stock-broll-picker'
import { useGeneration } from '@/components/clips/editor/use-generation'
import { Button } from '@/components/ui/button'
import type { BrollItem } from '@/lib/clips/broll'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'
import type { BrollMediaRow } from '@/lib/server/clips/broll-media'
import { kieVideoCostUsd } from '@/lib/clips/kie-cost'

function msLabel(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function BrollPanel({
  clipId,
  edits,
  outputDurationMs,
  playheadMs,
  aiMeta,
  brollMedia,
  onMergeBroll,
  onRemoveBroll,
}: {
  clipId: string
  edits: ClipEditsV2
  outputDurationMs: number
  playheadMs: number
  aiMeta?: { brollIdeas?: string[] } | null
  brollMedia: BrollMediaRow[]
  onMergeBroll: (items: BrollItem[], replace?: boolean) => void
  onRemoveBroll: (id: string) => void
}) {
  const [mode, setMode] = useState<'stock' | 'ai'>('stock')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<{ atMs: number; durationS: number; prompt: string }[]>([])
  const [activeGen, setActiveGen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const gen = useGeneration(activeGen)

  const mediaById = useMemo(() => new Map(brollMedia.map((m) => [m.id, m])), [brollMedia])
  const defaultQuery = aiMeta?.brollIdeas?.[0] || ''

  const insertStock = async (providerId: string, startMs: number, endMs: number) => {
    const data = await clipsFetch<{ assetId: string; url: string }>(`/api/clips/clips/${clipId}/broll`, {
      method: 'POST',
      body: JSON.stringify({ providerId, startMs, endMs }),
    })
    onMergeBroll([
      {
        id: crypto.randomUUID(),
        source: 'stock',
        assetId: data.assetId,
        startMs,
        endMs,
      },
    ])
  }

  const autoBroll = async () => {
    setBusy(true)
    try {
      const data = await clipsFetch<{ items: BrollItem[] }>(`/api/clips/clips/${clipId}/broll/auto`, {
        method: 'POST',
        body: '{}',
      })
      onMergeBroll(data.items, true)
    } finally {
      setBusy(false)
    }
  }

  const suggest = async () => {
    setBusy(true)
    try {
      const data = await clipsFetch<{ suggestions: { atMs: number; durationS: number; prompt: string }[] }>(
        `/api/clips/clips/${clipId}/broll/ai/suggest`,
        { method: 'POST', body: '{}' },
      )
      setSuggestions(data.suggestions)
      setMode('ai')
    } finally {
      setBusy(false)
    }
  }

  const pendingAi = useRef<{ generationId: string; atMs: number; durationS: number } | null>(null)

  const startAi = async (s: { atMs: number; durationS: number; prompt: string; resolution?: '480p' | '720p' }) => {
    setBusy(true)
    try {
      const data = await clipsFetch<{ generationId: string }>(`/api/clips/clips/${clipId}/broll/ai`, {
        method: 'POST',
        body: JSON.stringify({
          prompt: s.prompt,
          atMs: s.atMs,
          durationS: s.durationS,
          resolution: s.resolution || '480p',
        }),
      })
      pendingAi.current = { generationId: data.generationId, atMs: s.atMs, durationS: s.durationS }
      setActiveGen(data.generationId)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (gen.status !== 'READY' || !activeGen || !pendingAi.current) return
    const p = pendingAi.current
    onMergeBroll([
      {
        id: crypto.randomUUID(),
        source: 'ai',
        generationId: activeGen,
        startMs: p.atMs,
        endMs: p.atMs + p.durationS * 1000,
      },
    ])
    pendingAi.current = null
    setActiveGen(null)
  }, [gen.status, activeGen, onMergeBroll])

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex gap-1 rounded-md border border-border p-1">
        <Button variant={mode === 'stock' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('stock')}>Stock</Button>
        <Button variant={mode === 'ai' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('ai')}>AI</Button>
      </div>

      {mode === 'stock' ? (
        <>
          <Button size="sm" onClick={() => void autoBroll()} disabled={busy}>Auto B-roll</Button>
          <ul className="space-y-2">
            {(edits.broll || []).map((item) => {
              const m = mediaById.get(item.id)
              return (
                <li key={item.id} className="flex gap-2 rounded border p-2 text-xs">
                  {m?.thumbUrl ? <img src={m.thumbUrl} alt="" className="h-14 w-8 rounded object-cover" /> : <div className="h-14 w-8 rounded bg-muted" />}
                  <div className="min-w-0 flex-1">
                    <div>{msLabel(item.startMs)}–{msLabel(item.endMs)}</div>
                    {m?.author && m.pageUrl ? (
                      <a href={m.pageUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                        Video by {m.author} on Pixabay
                      </a>
                    ) : item.source === 'ai' ? (
                      <span className="text-muted-foreground">AI shot</span>
                    ) : null}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onRemoveBroll(item.id)}>Remove</Button>
                </li>
              )
            })}
          </ul>
          <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>Add B-roll</Button>
          <StockBrollPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            defaultQuery={defaultQuery}
            clipEndMs={outputDurationMs}
            playheadMs={playheadMs}
            onInsert={(pid, a, b) => void insertStock(pid, a, b)}
          />
        </>
      ) : (
        <>
          <Button size="sm" variant="outline" onClick={() => void suggest()} disabled={busy}>Suggest shots</Button>
          {suggestions.map((s, i) => (
            <AiBrollCard
              key={i}
              prompt={s.prompt}
              durationS={s.durationS}
              resolution="480p"
              atMs={s.atMs}
              costUsd={kieVideoCostUsd(s.durationS, '480p')}
              onChange={(p) =>
                setSuggestions((prev) =>
                  prev.map((row, j) => (j === i ? { ...row, ...p } : row)),
                )
              }
              onGenerate={() => void startAi({ ...s, resolution: '480p' })}
              busy={busy || gen.status === 'RUNNING'}
            />
          ))}
          {!suggestions.length && (
            <p className="text-sm text-muted-foreground">Suggest shots to generate AI B-roll with Kie Wan 3.0.</p>
          )}
        </>
      )}
    </div>
  )
}
