'use client'

import { Button } from '@/components/ui/button'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import { createId } from '@/lib/supabase/id'

export function ScriptElementsPanel({
  document,
  activeWordId,
  onPatchOverlays,
}: {
  document: ScriptDocumentV1
  activeWordId: string | null
  onPatchOverlays: (overlays: NonNullable<ScriptDocumentV1['overlays']>) => void
}) {
  const overlays = document.overlays ?? []

  const addTextPlaceholder = () => {
    const anchor = activeWordId ?? document.keptWordIds[0]
    if (!anchor) return
    const next = [
      ...overlays,
      {
        id: createId('ovl'),
        anchorWordId: anchor,
        mediaAssetId: 'text:placeholder',
        durMs: 3000,
        layer: overlays.length,
        label: 'Title text',
      },
    ]
    onPatchOverlays(next)
  }

  const remove = (id: string) => {
    onPatchOverlays(overlays.filter((o) => o.id !== id))
  }

  return (
    <div className="flex flex-col gap-3 p-3 text-sm" data-testid="script-elements-panel">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold">Canvas layers</p>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addTextPlaceholder}>
          Add text
        </Button>
      </div>
      {overlays.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Overlays anchor to words and appear on the timeline layer strip. Add B-roll from Media.
        </p>
      ) : (
        <ul className="space-y-2">
          {overlays.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{o.label || o.mediaAssetId}</p>
                <p className="text-[10px] text-muted-foreground tabular-nums">{(o.durMs / 1000).toFixed(1)}s · layer {o.layer ?? 0}</p>
              </div>
              <Button type="button" size="sm" variant="ghost" className="h-6 px-1 text-[10px]" onClick={() => remove(o.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
