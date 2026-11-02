'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AiBrollCard } from '@/components/clips/editor/ai-broll-card'
import { StockBrollPicker } from '@/components/clips/editor/stock-broll-picker'
import { useGeneration } from '@/components/clips/editor/use-generation'
import { Button } from '@/components/ui/button'
import { toIntMs, type BrollItem } from '@/lib/clips/broll'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'
import type { BrollMediaRow } from '@/lib/server/clips/broll-media'
import { aiBrollCredits } from '@/lib/clips/credit-cost'
import { corsMediaProps } from '@/components/clips/editor/g4/media-cors'
import { brollPanelThumb } from '@/lib/clips/editor/broll-thumb'

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
  onSetBroll,
  onRemoveBroll,
  onBrollMedia,
  onFlushEdits,
  onAcceptBrollSuggestions,
  uploadSlot,
}: {
  clipId: string
  edits: ClipEditsV2
  outputDurationMs: number
  playheadMs: number
  aiMeta?: { brollIdeas?: string[] } | null
  brollMedia: BrollMediaRow[]
  onMergeBroll: (items: BrollItem[], replace?: boolean) => void
  onSetBroll?: (items: BrollItem[]) => void
  onRemoveBroll: (id: string) => void
  onBrollMedia: (rows: BrollMediaRow[]) => void
  onFlushEdits?: () => void
  onAcceptBrollSuggestions?: (items: BrollItem[]) => void
  /** E5: "Upload" tab — the project media library (same uploads as the Media panel). */
  uploadSlot?: React.ReactNode
}) {
  const [mode, setMode] = useState<'stock' | 'ai' | 'upload'>('stock')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingAuto, setPendingAuto] = useState<BrollItem[]>([])
  const [pendingRejected, setPendingRejected] = useState<{ item: BrollItem; reason: string }[]>([])
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

  const insertStock = async (providerId: string, rawStartMs: number, rawEndMs: number) => {
    // E1fix: the playhead is fractional ms; the API and worker store integer ms.
    const startMs = toIntMs(rawStartMs)
    const endMs = Math.max(startMs, toIntMs(rawEndMs))
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
        placement: 'manual',
      },
    ])
  }

  const autoBroll = async () => {
    setBusy(true)
    try {
      const data = await clipsFetch<{
        items: BrollItem[]
        mergedBroll?: BrollItem[]
        media?: BrollMediaRow[]
        message?: string
        count?: number
        attempted?: number
        placed?: number
        queriesUsed?: string[]
        rejected?: { item: BrollItem; reason: string }[]
        suggestOnly?: boolean
      }>(`/api/clips/clips/${clipId}/broll/auto`, {
        method: 'POST',
        body: JSON.stringify({ suggestOnly: true }),
      })
      if (!data.items?.length) {
        toast.error(data.message || 'No B-roll suggestions')
        setPendingAuto([])
        setPendingRejected(data.rejected ?? [])
        return
      }
      if (data.media?.length) onBrollMedia(data.media)
      setPendingAuto(data.items)
      setPendingRejected(data.rejected ?? [])
      toast.success(`${data.items.length} suggestion(s) — accept to place on timeline`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Auto B-roll failed')
    } finally {
      setBusy(false)
    }
  }

  const acceptPending = () => {
    if (!pendingAuto.length) return
    if (onAcceptBrollSuggestions) {
      onAcceptBrollSuggestions(pendingAuto)
    } else {
      onMergeBroll(pendingAuto)
    }
    setPendingAuto([])
    onFlushEdits?.()
    toast.success('B-roll placed on timeline')
  }

  const acceptOne = (item: BrollItem) => {
    if (onAcceptBrollSuggestions) {
      onAcceptBrollSuggestions([item])
    } else {
      onMergeBroll([item])
    }
    setPendingAuto((prev) => prev.filter((x) => x.id !== item.id))
    onFlushEdits?.()
    toast.success('B-roll placed on timeline')
  }

  const rejectOne = (item: BrollItem) => {
    setPendingAuto((prev) => prev.filter((x) => x.id !== item.id))
    toast.message('Suggestion dismissed')
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
          atMs: toIntMs(s.atMs),
          durationS: s.durationS,
          resolution: s.resolution || '480p',
        }),
      })
      pendingAi.current = {
        generationId: data.generationId,
        atMs: toIntMs(s.atMs),
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
    if (gen.failed && activeGen) {
      pendingAi.current = null
      setActiveGen(null)
      return
    }
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
        {uploadSlot ? (
          <Button variant={mode === 'upload' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('upload')} data-testid="broll-tab-upload">Upload</Button>
        ) : null}
      </div>

      {mode === 'upload' && uploadSlot ? (
        <div data-testid="broll-upload-tab">{uploadSlot}</div>
      ) : mode === 'stock' ? (
        <>
          <Button size="sm" onClick={() => void autoBroll()} disabled={busy} data-testid="broll-auto-suggest">
            {busy ? 'Suggesting B-roll…' : 'Suggest auto B-roll'}
          </Button>
          {pendingAuto.length ? (
            <div className="space-y-2 rounded-md border border-dashed p-2 text-xs" data-testid="broll-pending-suggestions">
              <p className="font-medium">{pendingAuto.length} pending — nothing on timeline until you accept</p>
              <ul className="max-h-32 space-y-1 overflow-y-auto">
                {pendingAuto.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 tabular-nums text-muted-foreground"
                    data-testid={`broll-pending-${item.id}`}
                  >
                    <span className="min-w-0 flex-1">
                      {msLabel(item.startMs)}–{msLabel(item.endMs)}
                    </span>
                    <Button size="xs" variant="secondary" onClick={() => acceptOne(item)} data-testid={`broll-accept-${item.id}`}>
                      Accept
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => rejectOne(item)} data-testid={`broll-reject-${item.id}`}>
                      Reject
                    </Button>
                  </li>
                ))}
              </ul>
              {pendingRejected.length ? (
                <p className="text-[10px] text-muted-foreground">{pendingRejected.length} skipped (60 s repeat rule)</p>
              ) : null}
              <div className="flex gap-2">
                <Button size="sm" onClick={acceptPending} data-testid="broll-accept-suggestions">
                  Accept all
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPendingAuto([])}>
                  Dismiss
                </Button>
              </div>
            </div>
          ) : null}
          <ul className="space-y-2">
            {(edits.broll || []).map((item) => {
              const m = mediaById.get(item.id)
              const thumb = brollPanelThumb(item, m)
              return (
                <li key={item.id} className="flex gap-2 rounded border p-2 text-xs">
                  {thumb.kind === 'img' && thumb.src ? (
                    <img {...corsMediaProps(thumb.src)} src={thumb.src} alt="" className="h-14 w-8 rounded object-cover" data-testid="broll-panel-thumb" />
                  ) : thumb.kind === 'video' && thumb.src ? (
                    <video {...corsMediaProps(thumb.src)} src={thumb.src} muted playsInline preload="metadata" className="h-14 w-8 rounded object-cover" data-testid="broll-panel-thumb" />
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
                    ) : item.source === 'upload' ? (
                      <span className="text-muted-foreground">{item.still || m?.mediaType === 'image' ? 'Image' : 'Upload'}</span>
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
              credits={aiBrollCredits()}
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
            credits={aiBrollCredits()}
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
