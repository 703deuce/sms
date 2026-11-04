'use client'

import { useCallback, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  clampScriptSplitPct,
  SCRIPT_SPLIT_MIN_PX_TRANSCRIPT,
  SCRIPT_SPLIT_MIN_PX_PREVIEW,
} from '@/lib/clips/editor/use-script-view-split'

export function ScriptViewMainSplit({
  transcriptPct,
  onTranscriptPctChange,
  transcript,
  preview,
  className,
  minTranscriptPx = SCRIPT_SPLIT_MIN_PX_TRANSCRIPT,
  minPreviewPx = SCRIPT_SPLIT_MIN_PX_PREVIEW,
}: {
  transcriptPct: number
  onTranscriptPctChange: (pct: number) => void
  transcript: ReactNode
  preview: ReactNode
  className?: string
  minTranscriptPx?: number
  minPreviewPx?: number
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startPct: number; width: number } | null>(null)

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const root = rootRef.current
      if (!root) return
      const width = root.getBoundingClientRect().width
      if (width <= 0) return
      dragRef.current = { startX: e.clientX, startPct: transcriptPct, width }
      const onMove = (ev: PointerEvent) => {
        const st = dragRef.current
        if (!st) return
        const delta = (ev.clientX - st.startX) / st.width
        onTranscriptPctChange(clampScriptSplitPct(st.startPct + delta))
      }
      const onUp = () => {
        dragRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [onTranscriptPctChange, transcriptPct],
  )

  const pct = clampScriptSplitPct(transcriptPct)
  const previewPct = 1 - pct

  return (
    <div
      ref={rootRef}
      className={cn('flex h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden rounded-lg', className)}
      data-testid="script-view-main-split"
    >
      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-l-lg border border-border bg-card"
        style={{
          flex: `${pct} 1 ${minTranscriptPx}px`,
        }}
        data-testid="script-view-transcript-pane"
      >
        {transcript}
      </div>
      <button
        type="button"
        aria-label="Resize script and preview"
        data-testid="script-view-split-handle"
        className={cn(
          'relative z-10 w-1.5 shrink-0 cursor-col-resize touch-none',
          'bg-border/80 hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
        onPointerDown={onHandlePointerDown}
      />
      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-r-lg bg-panel"
        style={{
          flex: `${previewPct} 1 ${minPreviewPx}px`,
          minWidth: minPreviewPx,
        }}
        data-testid="script-view-preview-pane"
      >
        {preview}
      </div>
    </div>
  )
}
