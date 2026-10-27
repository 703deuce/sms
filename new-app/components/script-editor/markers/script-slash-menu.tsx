'use client'

import { useEffect, useRef } from 'react'
import { Bookmark } from 'lucide-react'

export function ScriptSlashMenu({
  open,
  x,
  y,
  onAddMarker,
  onClose,
}: {
  open: boolean
  x: number
  y: number
  onAddMarker: () => void
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
      className="fixed z-50 w-[220px] rounded-lg border border-border bg-popover p-1 shadow-lg"
      style={{ left: x, top: y }}
      role="menu"
      data-testid="script-slash-menu"
    >
      <button
        type="button"
        role="menuitem"
        className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent"
        onClick={() => {
          onAddMarker()
          onClose()
        }}
      >
        <Bookmark className="size-4 text-muted-foreground" aria-hidden />
        Add marker
      </button>
    </div>
  )
}
