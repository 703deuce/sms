'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Redo2, Undo2 } from 'lucide-react'

export function EditorTopBar({
  backHref,
  title,
  onTitleChange,
  saveState,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExport,
  producerStrip,
}: {
  backHref: string
  title: string
  onTitleChange: (t: string) => void
  saveState: 'saved' | 'saving' | 'dirty'
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onExport: () => void
  producerStrip?: { changeCount: number; onUndo: () => void } | null
}) {
  const saveLabel = saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? 'Unsaved' : 'Saved'

  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
      <Button size="sm" variant="ghost" render={<Link href={backHref} />}>
        <ArrowLeft className="size-4" />
        Back
      </Button>
      <input
        className="min-w-[160px] flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm font-medium"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
      />
      <span className="text-xs text-muted-foreground">{saveLabel}</span>
      {producerStrip && producerStrip.changeCount > 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs">
          <span>{producerStrip.changeCount} producer change{producerStrip.changeCount === 1 ? '' : 's'}</span>
          <Button size="sm" variant="outline" onClick={producerStrip.onUndo}>Undo</Button>
        </div>
      ) : null}
      <Button size="sm" variant="outline" disabled={!canUndo} onClick={onUndo}>
        <Undo2 className="size-4" />
      </Button>
      <Button size="sm" variant="outline" disabled={!canRedo} onClick={onRedo}>
        <Redo2 className="size-4" />
      </Button>
      <Button size="sm" variant="outline" disabled title="Coming soon">AI Producer</Button>
      <Button size="sm" onClick={onExport}>Export</Button>
    </header>
  )
}
