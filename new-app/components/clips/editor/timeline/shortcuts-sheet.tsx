'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { shortcutGroups } from '@/lib/clips/editor/timeline-shortcuts'

/** G1b: keyboard shortcuts sheet (? / Ctrl+/), built from the same table as the key handler. */
export function TimelineShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        data-testid="timeline-shortcuts-sheet"
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-popover p-4 text-xs shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
          <button type="button" className="rounded p-1 hover:bg-muted" onClick={onClose} aria-label="Close shortcuts">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {shortcutGroups(mac).map((g) => (
            <section key={g.title}>
              <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{g.title}</h3>
              <ul className="space-y-1">
                {g.rows.map((r) => (
                  <li key={r.label} className="flex items-start justify-between gap-3">
                    <span>{r.label}</span>
                    <span className="flex shrink-0 gap-1">
                      {r.keys.map((k) => (
                        <kbd key={k} className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
