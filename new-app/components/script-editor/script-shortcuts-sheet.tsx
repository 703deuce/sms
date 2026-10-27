'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { DESCRIPT_SHORTCUT_ROWS } from '@/lib/clips/script-editor/descript-shortcuts'

export function ScriptShortcutsSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return DESCRIPT_SHORTCUT_ROWS
    return DESCRIPT_SHORTCUT_ROWS.filter(
      (r) =>
        r.action.toLowerCase().includes(needle) ||
        r.mac.toLowerCase().includes(needle) ||
        r.win.toLowerCase().includes(needle),
    )
  }, [q])

  useEffect(() => {
    if (!open) setQ('')
  }, [open])

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md" data-testid="script-shortcuts-sheet">
        <SheetHeader>
          <SheetTitle>Keyboard shortcuts</SheetTitle>
        </SheetHeader>
        <Input
          placeholder="Search shortcuts…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mt-3"
          data-testid="script-shortcuts-search"
        />
        <ul className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto text-sm">
          {filtered.map((r) => (
            <li key={r.action} className="flex gap-2 border-b border-border/60 pb-2">
              <span className="min-w-0 flex-1">{r.action}</span>
              <kbd className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {isMac ? r.mac : r.win}
              </kbd>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
