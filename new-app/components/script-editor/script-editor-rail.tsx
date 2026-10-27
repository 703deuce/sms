'use client'

import { Captions, Clapperboard, FolderOpen, Layers, LayoutTemplate, SlidersHorizontal, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ScriptSideTab =
  | 'project'
  | 'properties'
  | 'layouts'
  | 'elements'
  | 'captions'
  | 'media'
  | 'edit'

const ITEMS: { id: ScriptSideTab; label: string; icon: typeof SlidersHorizontal }[] = [
  { id: 'project', label: 'Project', icon: FolderOpen },
  { id: 'edit', label: 'Edit tools', icon: Wand2 },
  { id: 'properties', label: 'Properties', icon: SlidersHorizontal },
  { id: 'elements', label: 'Elements', icon: Layers },
  { id: 'layouts', label: 'Layouts', icon: LayoutTemplate },
  { id: 'captions', label: 'Captions', icon: Captions },
  { id: 'media', label: 'Media', icon: Clapperboard },
]

export function ScriptEditorRail({
  active,
  open,
  onToggle,
}: {
  active: ScriptSideTab | null
  open: boolean
  onToggle: (tab: ScriptSideTab) => void
}) {
  return (
    <nav
      className="flex w-20 shrink-0 flex-col items-center gap-1 border-l border-border bg-muted/20 py-2"
      aria-label="Editor panels"
      data-testid="script-editor-rail"
    >
      {ITEMS.map(({ id, label, icon: Icon }) => {
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
              'flex h-[60px] w-[72px] flex-col items-center justify-center gap-1 rounded-[10px] text-muted-foreground transition-colors',
              isOn ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
            )}
          >
            <Icon className="size-[18px]" aria-hidden />
            <span className="text-[10px] font-medium leading-tight">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
