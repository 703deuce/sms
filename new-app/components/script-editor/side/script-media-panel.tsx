'use client'

import { useMemo, useState } from 'react'
import { StockBrollPicker } from '@/components/clips/editor/stock-broll-picker'
import { Button } from '@/components/ui/button'
import type { BrollItem } from '@/lib/clips/broll'
import { BROLL_DEFAULT_SHOT_MS } from '@/lib/clips/broll'
import { mergeBrollItems } from '@/lib/clips/script-editor/composition-render-edits'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import { clipsFetch } from '@/lib/clips-api'
import { formatScriptTimecode } from '@/lib/clips/script-editor/sync-playhead'

export function ScriptMediaPanel({
  compositionId,
  document,
  outputDurationMs,
  playheadOutMs,
  onPatchBroll,
}: {
  compositionId: string
  document: ScriptDocumentV1
  outputDurationMs: number
  playheadOutMs: number
  onPatchBroll: (broll: BrollItem[]) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const broll = document.broll ?? []

  const insertStock = async (providerId: string, startMs: number, endMs: number) => {
    const data = await clipsFetch<{
      assetId: string
      url?: string
      thumbUrl?: string
    }>(`/api/clips/compositions/${compositionId}/broll/stock`, {
      method: 'POST',
      body: JSON.stringify({ providerId, startMs, endMs }),
    })
    const item: BrollItem = {
      id: crypto.randomUUID(),
      source: 'stock',
      assetId: data.assetId,
      startMs,
      endMs,
      placement: 'manual',
    }
    onPatchBroll(mergeBrollItems(broll, [item]))
    setPickerOpen(false)
  }

  const atPlayhead = useMemo(() => {
    const start = Math.max(0, Math.round(playheadOutMs))
    const end = Math.min(outputDurationMs, start + BROLL_DEFAULT_SHOT_MS)
    return { start, end }
  }, [playheadOutMs, outputDurationMs])

  return (
    <div className="flex flex-col gap-3 p-3" data-testid="script-media-panel">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Media & B-roll</p>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setPickerOpen(true)}>
          Stock search
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Reuses clipper Pixabay cache + worker <code className="text-[10px]">broll_render.py</code> on export.
      </p>
      <ul className="max-h-[40vh] space-y-1 overflow-y-auto text-xs">
        {broll.length === 0 && <li className="text-muted-foreground">No B-roll yet.</li>}
        {broll.map((item) => (
          <li key={item.id} className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
            <span>
              {item.source === 'stock' ? 'Stock' : 'AI'}{' '}
              {formatScriptTimecode(item.startMs)}–{formatScriptTimecode(item.endMs)}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-destructive"
              onClick={() => onPatchBroll(broll.filter((b) => b.id !== item.id))}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <StockBrollPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        defaultQuery=""
        clipEndMs={outputDurationMs}
        playheadMs={atPlayhead.start}
        onInsert={(providerId, startMs, endMs) => void insertStock(providerId, startMs, endMs)}
      />
    </div>
  )
}
