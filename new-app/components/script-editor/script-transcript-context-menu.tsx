'use client'

import { useEffect, useRef } from 'react'

export function ScriptTranscriptContextMenu({
  open,
  x,
  y,
  canRestore,
  canIgnore,
  canSymmetricTrimGap,
  onRestore,
  onIgnore,
  onSymmetricTrimGap,
  onClose,
}: {
  open: boolean
  x: number
  y: number
  canRestore: boolean
  canIgnore: boolean
  canSymmetricTrimGap: boolean
  onRestore: () => void
  onIgnore: () => void
  onSymmetricTrimGap: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[200px] rounded-md border border-border bg-popover py-1 text-sm shadow-md"
      style={{ left: x, top: y }}
      role="menu"
      data-testid="script-transcript-context-menu"
    >
      {canSymmetricTrimGap && (
        <button
          type="button"
          role="menuitem"
          className="flex w-full px-3 py-1.5 text-left hover:bg-muted"
          data-testid="symmetric-trim-gap"
          onClick={() => {
            onSymmetricTrimGap()
            onClose()
          }}
        >
          Symmetric trim gap (to 0.3s)
        </button>
      )}
      {canIgnore && (
        <button
          type="button"
          role="menuitem"
          className="flex w-full px-3 py-1.5 text-left hover:bg-muted"
          onClick={() => {
            onIgnore()
            onClose()
          }}
        >
          Ignore
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        disabled={!canRestore}
        className="flex w-full px-3 py-1.5 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        onClick={() => {
          if (!canRestore) return
          onRestore()
          onClose()
        }}
      >
        Restore cut
        <span className="ml-auto pl-3 text-xs text-muted-foreground">Shift+Enter</span>
      </button>
    </div>
  )
}
