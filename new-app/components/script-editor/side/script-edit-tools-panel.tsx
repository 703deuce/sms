'use client'

import { Button } from '@/components/ui/button'
import type { FillerHit } from '@/lib/clips/script-editor/filler-hits'
import { formatScriptTimecode } from '@/lib/clips/script-editor/sync-playhead'
import { cn } from '@/lib/utils'

export function ScriptEditToolsPanel({
  fillerHits,
  activeHitId,
  rangeStartMs,
  onSelectHit,
  onOpenReview,
}: {
  fillerHits: FillerHit[]
  activeHitId: string | null
  rangeStartMs: number
  onSelectHit: (hit: FillerHit) => void
  onOpenReview: () => void
}) {
  return (
    <div className="flex flex-col gap-3 p-3" data-testid="script-edit-tools-panel">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Filler words</p>
        <Button type="button" size="sm" variant="outline" onClick={onOpenReview}>
          Review bar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{fillerHits.length} hits in composition</p>
      <ul className="max-h-[min(40vh,320px)] space-y-1 overflow-y-auto">
        {fillerHits.map((hit) => {
          const ctx = hit.word.text
          const active = hit.word.id === activeHitId
          return (
            <li key={hit.word.id}>
              <button
                type="button"
                onClick={() => onSelectHit(hit)}
                className={cn(
                  'w-full rounded-md border px-2 py-1.5 text-left text-xs',
                  active ? 'border-sky-500 bg-sky-500/10' : 'border-border hover:bg-muted/40',
                )}
              >
                <span className="font-medium text-sky-800 dark:text-sky-200">{ctx}</span>
                <span className="ml-2 text-muted-foreground">
                  {formatScriptTimecode(hit.word.t0Ms - rangeStartMs)}
                  {hit.word.fillerKind ? ` · ${hit.word.fillerKind}` : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
