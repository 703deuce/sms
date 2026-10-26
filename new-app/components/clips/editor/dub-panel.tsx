'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DUB_LANGUAGES, dubCostUsd } from '@/lib/clips/dub'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'
import { toast } from 'sonner'

type DubRow = {
  id: string
  targetLang: string
  status: string
  error?: string | null
  audioUrl: string | null
}

export function DubPanel({
  clipId,
  durationMs,
  edits,
  onEdits,
  dubs: itemsProp,
  onRefresh,
}: {
  clipId: string
  durationMs: number
  edits: ClipEditsV2
  onEdits: (edits: ClipEditsV2) => void
  dubs?: DubRow[]
  onRefresh?: () => void
}) {
  const [lang, setLang] = useState('es')
  const [busy, setBusy] = useState(false)
  const [itemsLocal, setItemsLocal] = useState<DubRow[]>([])

  const refresh = useCallback(async () => {
    const data = await clipsFetch<{ items: DubRow[] }>(`/api/clips/clips/${clipId}/dubs`)
    setItemsLocal(data.items)
    onRefresh?.()
  }, [clipId, onRefresh])

  useEffect(() => {
    if (itemsProp) return
    void refresh().catch(() => {})
    const t = setInterval(() => void refresh().catch(() => {}), 8000)
    return () => clearInterval(t)
  }, [refresh, itemsProp])

  const items = itemsProp ?? itemsLocal

  const generate = async () => {
    setBusy(true)
    try {
      await clipsFetch(`/api/clips/clips/${clipId}/dub`, {
        method: 'POST',
        body: JSON.stringify({ targetLang: lang }),
      })
      toast.success('Dub queued')
      void refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Dub failed')
    } finally {
      setBusy(false)
    }
  }

  const cost = dubCostUsd(durationMs)

  return (
    <div className="space-y-3 p-3 text-sm">
      <Label className="text-xs font-medium">Target language</Label>
      <Select value={lang} onValueChange={(v) => typeof v === 'string' && setLang(v)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DUB_LANGUAGES.map((l) => (
            <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">About ${cost.toFixed(2)} for this clip</p>
      <Button size="sm" disabled={busy} onClick={() => void generate()}>Generate dub</Button>
      <div className="space-y-2">
        {items.map((d) => (
          <div key={d.id} className="rounded border border-border p-2 text-xs">
            <p>{d.targetLang} · {d.status}</p>
            {d.error && <p className="text-destructive">{d.error}</p>}
            <div className="mt-2 flex gap-2">
              {d.status === 'READY' && (
                <Button
                  size="sm"
                  variant={edits.audioTrack === `dub:${d.id}` ? 'default' : 'outline'}
                  onClick={() => onEdits({ ...edits, audioTrack: `dub:${d.id}` })}
                >
                  Use for preview/export
                </Button>
              )}
              <Button
                size="sm"
                variant={edits.audioTrack === 'original' || !edits.audioTrack ? 'secondary' : 'ghost'}
                onClick={() => onEdits({ ...edits, audioTrack: 'original' })}
              >
                Original
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
