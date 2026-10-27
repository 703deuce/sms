'use client'

import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { formatGapChip } from '@/lib/clips/script-editor/filler-hits'

export function ScriptGapChipMenu({
  gapMs,
  targetGapSec,
  onShorten,
  onRemove,
  onKeep,
}: {
  gapMs: number
  targetGapSec: number
  onShorten: () => void
  onRemove: () => void
  onKeep: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="mr-1 inline rounded bg-muted px-1 text-[11px] text-muted-foreground hover:bg-amber-500/20"
        data-testid="script-gap-chip"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        {formatGapChip(gapMs)}
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start" data-testid="script-gap-chip-menu">
        <p className="mb-2 text-xs text-muted-foreground">Gap {formatGapChip(gapMs)}</p>
        <div className="flex flex-col gap-1">
          <Button type="button" size="sm" variant="outline" className="h-8 justify-start text-xs" onClick={() => { onShorten(); setOpen(false) }}>
            Shorten to {targetGapSec}s
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 justify-start text-xs" onClick={() => { onRemove(); setOpen(false) }}>
            Remove gap
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8 justify-start text-xs" onClick={() => { onKeep(); setOpen(false) }}>
            Keep
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
