'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type PaletteCommand = { id: string; label: string; keys?: string; keywords?: string; group: string; run: () => void; disabled?: boolean }

/** Case-insensitive fuzzy-ish match: every query word must appear in label / group / keys. */
export function filterPaletteCommands<T extends Pick<PaletteCommand, 'label' | 'group' | 'keys' | 'keywords'>>(cmds: readonly T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return [...cmds]
  return cmds.filter((c) => {
    const hay = `${c.label} ${c.group} ${c.keys ?? ''} ${c.keywords ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** TC1 (TL-54): Ctrl/Cmd+K command palette — every timeline command by name. */
export function CommandPalette({ open, commands, onClose }: { open: boolean; commands: PaletteCommand[]; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const shown = useMemo(() => filterPaletteCommands(commands, q), [commands, q])
  useEffect(() => {
    if (!open) return
    setQ('')
    setI(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])
  if (!open) return null
  const run = (c: PaletteCommand | undefined) => {
    if (!c || c.disabled) return
    onClose()
    c.run()
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[15vh]" onPointerDown={onClose} data-testid="command-palette">
      <div className="w-[min(520px,92vw)] overflow-hidden rounded-lg border border-border bg-popover text-sm shadow-2xl" onPointerDown={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setI(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              onClose()
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setI((v) => Math.min(shown.length - 1, v + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setI((v) => Math.max(0, v - 1))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              run(shown[i])
            }
            e.stopPropagation()
          }}
          placeholder="Type a command…"
          aria-label="Search commands"
          className="w-full border-b border-border bg-transparent px-3 py-2 outline-none"
          data-testid="command-palette-input"
        />
        <div className="max-h-[50vh] overflow-y-auto py-1" role="listbox">
          {shown.length ? (
            shown.map((c, n) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={n === i}
                disabled={c.disabled}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left disabled:opacity-40 ${n === i ? 'bg-muted' : ''}`}
                onMouseEnter={() => setI(n)}
                onClick={() => run(c)}
                data-testid="command-palette-item"
              >
                <span className="w-16 shrink-0 text-[11px] uppercase text-muted-foreground">{c.group}</span>
                <span className="flex-1">{c.label}</span>
                {c.keys ? <kbd className="rounded border border-border px-1 text-[11px] text-muted-foreground">{c.keys}</kbd> : null}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-muted-foreground">No matching command</p>
          )}
        </div>
      </div>
    </div>
  )
}
