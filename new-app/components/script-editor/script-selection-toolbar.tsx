'use client'

import { Button } from '@/components/ui/button'

/** §A3 selection toolbar — floats above transcript selection (not a new panel). */
export function ScriptSelectionToolbar({
  anchorRect,
  canDelete,
  canIgnore,
  canRestore,
  canReplaceGap,
  onDelete,
  onIgnore,
  onRestore,
  onReplaceGap,
}: {
  anchorRect: DOMRect | null
  canDelete: boolean
  canIgnore: boolean
  canRestore: boolean
  canReplaceGap: boolean
  onDelete: () => void
  onIgnore: () => void
  onRestore: () => void
  onReplaceGap: () => void
}) {
  if (!anchorRect || (!canDelete && !canIgnore && !canRestore && !canReplaceGap)) return null

  const top = Math.max(8, anchorRect.top - 40)
  const left = anchorRect.left + anchorRect.width / 2

  return (
    <div
      className="pointer-events-auto fixed z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-border bg-popover px-1 py-0.5 text-xs shadow-md"
      style={{ top, left }}
      role="toolbar"
      aria-label="Selection actions"
    >
      {canDelete && (
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={onDelete}>
          Delete
        </Button>
      )}
      {canIgnore && (
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={onIgnore}>
          Ignore
        </Button>
      )}
      {canReplaceGap && (
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={onReplaceGap}>
          Replace with gap
        </Button>
      )}
      {canRestore && (
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={onRestore}>
          Restore
        </Button>
      )}
    </div>
  )
}
