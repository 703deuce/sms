'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  editorPreviewStrip,
  editorPreviewStripCenter,
  editorPreviewStripSide,
  editorToolbarTextBtn,
} from '@/lib/clips/editor/editor-chrome-tokens'
import { cn } from '@/lib/utils'

/** Phase 1b: Record left · transport center · View menu right (§4 spacing). */
export function PreviewTransportStrip({
  recordSlot,
  transportSlot,
  viewMenuBody,
  viewSummary,
  compact = false,
  fullscreenSlot,
}: {
  recordSlot: ReactNode
  transportSlot: ReactNode
  viewMenuBody: ReactNode
  viewSummary: string
  /** Narrow preview column (~script split): wrap controls; icon fullscreen. */
  compact?: boolean
  fullscreenSlot?: ReactNode
}) {
  const viewMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className={editorToolbarTextBtn} data-testid="preview-view-menu" title="Preview view options">
            View
            <ChevronDown className="size-3 opacity-60" />
            <span className="hidden text-muted-foreground sm:inline">{viewSummary}</span>
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-56 p-2" data-testid="preview-view-menu-content">
        {viewMenuBody}
      </DropdownMenuContent>
    </DropdownMenu>
  )
  if (compact) {
    return (
      <div className={cn(editorPreviewStrip, 'flex-col items-stretch gap-2 py-2')} data-testid="preview-transport-strip">
        <div className="flex min-w-0 items-center gap-2">
          <div className={cn(editorPreviewStripSide, 'min-w-0 flex-[1_1_40%] justify-start')}>{recordSlot}</div>
          <div className={cn(editorPreviewStripCenter, 'min-w-0 flex-1 flex-wrap justify-center gap-1')}>
            {transportSlot}
            {fullscreenSlot}
          </div>
        </div>
        <div className="flex justify-end">{viewMenu}</div>
      </div>
    )
  }
  return (
    <div className={cn(editorPreviewStrip, 'flex-wrap gap-y-2')} data-testid="preview-transport-strip">
      <div className={cn(editorPreviewStripSide, 'justify-start')}>{recordSlot}</div>
      <div className={cn(editorPreviewStripCenter, 'min-w-0 max-w-full flex-wrap')}>
        {transportSlot}
        {fullscreenSlot}
      </div>
      <div className={cn(editorPreviewStripSide, 'justify-end')}>{viewMenu}</div>
    </div>
  )
}
