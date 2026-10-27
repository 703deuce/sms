'use client'

import { useMemo } from 'react'
import { ListTree } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import { formatScriptTimecode } from '@/lib/clips/script-editor/sync-playhead'
import { cn } from '@/lib/utils'

export function ScriptMarkerListPopover({
  document,
  playheadOutMs,
  durationMs,
  onSeek,
}: {
  document: ScriptDocumentV1
  playheadOutMs: number
  durationMs: number
  onSeek: (outMs: number) => void
}) {
  const markers = useMemo(() => [...(document.markers ?? [])].sort((a, b) => a.outMs - b.outMs), [document.markers])

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" title="Markers (M)" data-testid="marker-list-button">
            <ListTree className="size-4" />
          </Button>
        }
      />
      <PopoverContent align="start" side="top" className="w-[272px] p-1">
        <button
          type="button"
          className="flex h-8 w-full items-center justify-between rounded-md px-2 text-[13px] hover:bg-accent"
          onClick={() => onSeek(0)}
        >
          <span>Beginning of composition</span>
          <span className="font-mono text-xs text-muted-foreground">Home</span>
        </button>
        {markers.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">Add markers with / in the script</p>
        )}
        {markers.map((m) => {
          const active = playheadOutMs >= m.outMs && playheadOutMs < (markers.find((x) => x.outMs > m.outMs)?.outMs ?? durationMs)
          return (
            <button
              key={m.id}
              type="button"
              className={cn(
                'flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-[13px] hover:bg-accent',
                active && 'bg-accent',
              )}
              onClick={() => onSeek(m.outMs)}
            >
              <span className="truncate">{m.label ?? 'Marker'}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatScriptTimecode(m.outMs)}</span>
            </button>
          )
        })}
        <button
          type="button"
          className="flex h-8 w-full items-center justify-between rounded-md px-2 text-[13px] hover:bg-accent"
          onClick={() => onSeek(durationMs)}
        >
          <span>End of composition</span>
          <span className="font-mono text-xs text-muted-foreground">End</span>
        </button>
      </PopoverContent>
    </Popover>
  )
}
