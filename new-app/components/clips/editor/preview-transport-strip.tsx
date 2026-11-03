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
}: {
  recordSlot: ReactNode
  transportSlot: ReactNode
  viewMenuBody: ReactNode
  viewSummary: string
}) {
  return (
    <div className={editorPreviewStrip} data-testid="preview-transport-strip">
      <div className={cn(editorPreviewStripSide, 'justify-start')}>{recordSlot}</div>
      <div className={editorPreviewStripCenter}>{transportSlot}</div>
      <div className={cn(editorPreviewStripSide, 'justify-end')}>
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
      </div>
    </div>
  )
}
