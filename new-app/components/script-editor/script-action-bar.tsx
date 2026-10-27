'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type ScriptAction = {
  id: string
  label: string
  keywords?: string
  run: () => void
}

export function ScriptActionBar({
  open,
  onOpenChange,
  actions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  actions: ScriptAction[]
}) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return actions
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(needle) ||
        (a.keywords ?? '').toLowerCase().includes(needle),
    )
  }, [actions, q])

  useEffect(() => {
    if (!open) {
      setQ('')
      setIdx(0)
    }
  }, [open])

  useEffect(() => {
    setIdx(0)
  }, [q])

  const run = (action: ScriptAction) => {
    onOpenChange(false)
    action.run()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 p-0 sm:max-w-md" data-testid="script-action-bar">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-sm">Actions</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-2">
          <Input
            autoFocus
            placeholder="Search actions…"
            value={q}
            data-testid="script-action-bar-input"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIdx((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIdx((i) => Math.max(0, i - 1))
              }
              if (e.key === 'Enter' && filtered[idx]) {
                e.preventDefault()
                run(filtered[idx])
              }
            }}
          />
        </div>
        <ul className="max-h-[min(50vh,320px)] overflow-y-auto border-t border-border pb-2">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">No matching actions</li>
          )}
          {filtered.map((a, i) => (
            <li key={a.id}>
              <button
                type="button"
                className={cn(
                  'flex w-full px-4 py-2.5 text-left text-sm hover:bg-muted/60',
                  i === idx && 'bg-muted/80',
                )}
                onClick={() => run(a)}
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
