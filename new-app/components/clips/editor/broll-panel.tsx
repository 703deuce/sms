'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
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
  onBrollMedia,
}: {
  clipId: string
  edits: ClipEditsV2
  outputDurationMs: number
  playheadMs: number
  aiMeta?: { brollIdeas?: string[] } | null
  brollMedia: BrollMediaRow[]
  onMergeBroll: (items: BrollItem[], replace?: boolean) => void
  onRemoveBroll: (id: string) => void
  onBrollMedia: (rows: BrollMediaRow[]) => void
}) {
  const [mode, setMode] = useState<'stock' | 'ai'>('stock')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<{ atMs: number; durationS: number; prompt: string }[]>([])
  const [manualAi, setManualAi] = useState({
    prompt: aiMeta?.brollIdeas?.[0] || '',
    durationS: 3,
    resolution: '480p' as '480p' | '720p',
  })
  const [activeGen, setActiveGen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const gen = useGeneration(activeGen)

  const mediaById = useMemo(() => new Map(brollMedia.map((m) => [m.id, m])), [brollMedia])
  const defaultQuery = aiMeta?.brollIdeas?.[0] || ''

  const insertStock = async (providerId: string, startMs: number, endMs: number) => {
    const itemId = crypto.randomUUID()
    const data = await clipsFetch<{
      assetId: string
      url: string
      thumbUrl?: string
      previewUrl?: string
    }>(`/api/clips/clips/${clipId}/broll`, {
      method: 'POST',
      body: JSON.stringify({ providerId, startMs, endMs }),
    })
    onBrollMedia([
      {
        id: itemId,
        source: 'stock',
        startMs,
        endMs,
        url: data.url || data.previewUrl || null,
        thumbUrl: data.thumbUrl,
        assetId: data.assetId,
      },
    ])
    onMergeBroll([
      {
        id: itemId,
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
      const data = await clipsFetch<{
        items: BrollItem[]
        media?: BrollMediaRow[]
        message?: string
        count?: number
        attempted?: number
        placed?: number
      }>(`/api/clips/clips/${clipId}/broll/auto`, { method: 'POST', body: '{}' })
      const attempted = data.attempted ?? data.items?.length ?? 0
      const placed = data.placed ?? data.items?.length ?? 0
      if (!data.items?.length) {
        toast.error(data.message || 'No B-roll placements found')
        return
      }
      if (data.media?.length) onBrollMedia(data.media)
      onMergeBroll(data.items, true)
      if (attempted > placed) {
        toast.success(`Placed ${placed} of ${attempted}`)
      } else {
        toast.success(`Added ${placed} B-roll clip${placed === 1 ? '' : 's'}`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Auto B-roll failed')
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
      if (!data.suggestions?.length) {
        toast.error('No shot suggestions returned')
        return
      }
      setSuggestions(data.suggestions)
      setMode('ai')
      toast.success(`${data.suggestions.length} shot suggestion(s)`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Suggest shots failed')
    } finally {
      setBusy(false)
    }
  }

  const pendingAi = useRef<{ generationId: string; atMs: number; durationS: number; itemId: string } | null>(null)

  const startAi = async (s: { atMs: number; durationS: number; prompt: string; resolution?: '480p' | '720p' }) => {
    if (!s.prompt.trim()) {
      toast.error('Enter a prompt')
      return
    }
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
      pendingAi.current = {
        generationId: data.generationId,
        atMs: s.atMs,
        durationS: s.durationS,
        itemId: crypto.randomUUID(),
      }
      setActiveGen(data.generationId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI B-roll failed')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (gen.status !== 'READY' || !gen.downloadUrl || !activeGen || !pendingAi.current) return
    const p = pendingAi.current
    if (gen.error) {
      toast.error(gen.error)
      pendingAi.current = null
      setActiveGen(null)
      return
    }
    onBrollMedia([
      {
        id: p.itemId,
        source: 'ai',
        startMs: p.atMs,
        endMs: p.atMs + p.durationS * 1000,
        url: gen.downloadUrl,
        thumbUrl: gen.downloadUrl,
        generationId: activeGen,
      },
    ])
    onMergeBroll([
      {
        id: p.itemId,
        source: 'ai',
        generationId: activeGen,
        startMs: p.atMs,
        endMs: p.atMs + p.durationS * 1000,
      },
    ])
    pendingAi.current = null
    setActiveGen(null)
    toast.success('AI B-roll added')
  }, [gen.status, gen.downloadUrl, gen.error, activeGen, onMergeBroll, onBrollMedia])

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
                  {m?.thumbUrl ? (
                    <img src={m.thumbUrl} alt="" className="h-14 w-8 rounded object-cover" />
                  ) : m?.url && item.source === 'ai' ? (
                    <video src={m.url} muted playsInline preload="metadata" className="h-14 w-8 rounded object-cover" />
                  ) : (
                    <div className="h-14 w-8 rounded bg-muted" />
                  )}
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
            onInsert={(pid, a, b) => void insertStock(pid, a, b).catch((e) => toast.error(e instanceof Error ? e.message : 'Insert failed'))}
          />
        </>
      ) : (
        <>
          <Button size="sm" variant="outline" onClick={() => void suggest()} disabled={busy}>Suggest shots</Button>
          {gen.status === 'RUNNING' && <p className="text-xs text-muted-foreground">Generating AI B-roll…</p>}
          {suggestions.map((s, i) => (
            <AiBrollCard
              key={i}
              prompt={s.prompt}
              durationS={s.durationS}
              resolution="480p"
              atMs={s.atMs}
              costUsd={kieVideoCostUsd(s.durationS, '480p')}
              onChange={(p) =>
                setSuggestions((prev) => prev.map((row, j) => (j === i ? { ...row, ...p } : row)))
              }
              onGenerate={() => void startAi({ ...s, resolution: '480p' })}
              busy={busy || gen.status === 'RUNNING'}
            />
          ))}
          <AiBrollCard
            prompt={manualAi.prompt}
            durationS={manualAi.durationS}
            resolution={manualAi.resolution}
            atMs={playheadMs}
            costUsd={kieVideoCostUsd(manualAi.durationS, manualAi.resolution)}
            onChange={(p) => setManualAi((m) => ({ ...m, ...p }))}
            onGenerate={() => void startAi({ ...manualAi, atMs: playheadMs })}
            busy={busy || gen.status === 'RUNNING'}
          />
          {!suggestions.length && (
            <p className="text-sm text-muted-foreground">Generate AI B-roll (9:16) at the playhead, or suggest shots first.</p>
          )}
        </>
      )}
    </div>
  )
}
