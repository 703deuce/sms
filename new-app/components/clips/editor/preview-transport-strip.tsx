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
  // TIMELINE_LAYOUT4: compact = the same single row, just tighter padding (no second View row).
  if (compact) {
    return (
      <div className={cn(editorPreviewStrip, 'flex-nowrap gap-2 py-1')} data-testid="preview-transport-strip" data-rows="1">
        <div className={cn(editorPreviewStripSide, 'min-w-0 shrink justify-start')}>{recordSlot}</div>
        <div className={cn(editorPreviewStripCenter, 'min-w-0 flex-1 flex-nowrap justify-center gap-1 overflow-x-auto [scrollbar-width:none] [&>*]:flex-nowrap')}>
          {transportSlot}
        </div>
        <div className={cn(editorPreviewStripSide, 'shrink-0 justify-end gap-1')} data-testid="preview-strip-right">
          {fullscreenSlot}
          {viewMenu}
        </div>
      </div>
    )
  }
  return (
    <div className={cn(editorPreviewStrip, 'flex-nowrap gap-2')} data-testid="preview-transport-strip" data-rows="1">
      <div className={cn(editorPreviewStripSide, 'min-w-0 shrink justify-start')}>{recordSlot}</div>
      <div className={cn(editorPreviewStripCenter, 'min-w-0 flex-1 flex-nowrap justify-center overflow-x-auto [scrollbar-width:none] [&>*]:flex-nowrap')}>
        {transportSlot}
      </div>
      <div className={cn(editorPreviewStripSide, 'shrink-0 justify-end gap-1')} data-testid="preview-strip-right">
        {fullscreenSlot}
        {viewMenu}
      </div>
    </div>
  )
}
