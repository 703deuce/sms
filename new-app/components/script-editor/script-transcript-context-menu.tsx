'use client'

import { useEffect, useRef } from 'react'

export function ScriptTranscriptContextMenu({
  open,
  x,
  y,
  canRestore,
  canIgnore,
  onRestore,
  onIgnore,
  onClose,
}: {
  open: boolean
  x: number
  y: number
  canRestore: boolean
  canIgnore: boolean
  onRestore: () => void
  onIgnore: () => void
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
      className="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover py-1 text-sm shadow-md"
      style={{ left: x, top: y }}
      role="menu"
    >
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
