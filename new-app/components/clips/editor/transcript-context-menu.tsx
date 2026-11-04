'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export type TranscriptContextMenuItem = {
  id: string
  label: string
  shortcut?: string
  disabled?: boolean
  onClick: () => void
  testId?: string
}

export function TranscriptContextMenu({
  x,
  y,
  items,
  sections,
  onClose,
}: {
  x: number
  y: number
  items: TranscriptContextMenuItem[]
  /** Optional labeled blocks (e.g. Camera angles). */
  sections?: { label: string; items: TranscriptContextMenuItem[] }[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
  }, [onClose])

  const run = (item: TranscriptContextMenuItem) => {
    if (item.disabled) return
    item.onClick()
    onClose()
  }

  const row = (item: TranscriptContextMenuItem) => (
    <button
      key={item.id}
      type="button"
      role="menuitem"
      disabled={item.disabled}
      data-testid={item.testId ?? `transcript-ctx-${item.id}`}
      className={cn(
        'flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40',
      )}
      onClick={() => run(item)}
    >
      <span className="min-w-0 flex-1">{item.label}</span>
      {item.shortcut ? (
        <span className="shrink-0 pl-2 text-[10px] tabular-nums text-muted-foreground">{item.shortcut}</span>
      ) : null}
    </button>
  )

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[220px] max-w-[min(280px,calc(100vw-16px))] rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg"
      style={{ left: x, top: y }}
      role="menu"
      aria-label="Transcript selection"
      data-testid="transcript-ctx-menu"
    >
      {items.map(row)}
      {sections?.map((sec) => (
        <div key={sec.label} className="border-t border-border pt-1 mt-1">
          <p className="px-2 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{sec.label}</p>
          {sec.items.map(row)}
        </div>
      ))}
    </div>
  )
}
