'use client'

import { Captions, SlidersHorizontal, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ScriptSideTab = 'properties' | 'captions' | 'edit'

export function ScriptEditorRail({
  active,
  open,
  onToggle,
}: {
  active: ScriptSideTab | null
  open: boolean
  onToggle: (tab: ScriptSideTab) => void
}) {
  const items: { id: ScriptSideTab; label: string; icon: typeof SlidersHorizontal }[] = [
    { id: 'properties', label: 'Properties', icon: SlidersHorizontal },
    { id: 'captions', label: 'Captions', icon: Captions },
    { id: 'edit', label: 'Edit tools', icon: Wand2 },
  ]

  return (
    <nav
      className="flex w-11 shrink-0 flex-col items-center gap-1 border-l border-border bg-muted/20 py-2"
      aria-label="Editor panels"
    >
      {items.map(({ id, label, icon: Icon }) => {
        const isOn = open && active === id
        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={isOn}
            onClick={() => onToggle(id)}
            className={cn(
              'flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors',
              isOn ? 'bg-primary/15 text-primary' : 'hover:bg-muted',
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        )
      })}
    </nav>
  )
}
