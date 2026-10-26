'use client'

import { useState } from 'react'
import { LayoutEditorDialog } from '@/components/streamer/layout-editor-dialog'

export function StreamerLayoutPill({
  projectId,
  layout,
}: {
  projectId: string
  layout: Record<string, unknown> | null
}) {
  const [open, setOpen] = useState(false)
  const l = layout as { layout?: string; confidence?: number; source?: string } | null
  const label =
    l?.layout === 'stack'
      ? `Facecam + gameplay (${l.source === 'manual' ? 'preset' : 'auto'}${l.confidence != null ? `, ${Math.round(l.confidence * 100)}%` : ''})`
      : l?.layout === 'gameplay'
        ? 'Gameplay only'
        : 'Layout: auto'
  return (
    <>
      <button
        type="button"
        className="inline-flex rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      <LayoutEditorDialog projectId={projectId} open={open} onOpenChange={setOpen} initialLayout={layout} />
    </>
  )
}
