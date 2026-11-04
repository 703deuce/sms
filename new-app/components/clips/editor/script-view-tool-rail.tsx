'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Captions, Eraser, FolderOpen, Layers, LayoutPanelTop, LayoutTemplate, Music2, SlidersHorizontal, Sparkles, Type } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { EditorPanelId } from '@/components/clips/editor/editor-rail'

/** Descript-style script view tool strip (far right). */
export type ScriptViewToolPanelId = Extract<
  EditorPanelId,
  'cleanup' | 'layout' | 'inspector' | 'captions' | 'text' | 'audio' | 'color' | 'media' | 'layers' | 'templates'
>

export const SCRIPT_VIEW_TOOL_PANELS: { id: ScriptViewToolPanelId; label: string; icon: LucideIcon }[] = [
  { id: 'cleanup', label: 'Clean up', icon: Eraser },
  { id: 'layout', label: 'Layout', icon: LayoutPanelTop },
  { id: 'inspector', label: 'Properties', icon: SlidersHorizontal },
  { id: 'captions', label: 'Captions', icon: Captions },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'audio', label: 'Audio', icon: Music2 },
  { id: 'color', label: 'Effects', icon: Sparkles },
  { id: 'media', label: 'Media', icon: FolderOpen },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
]

export const SCRIPT_VIEW_DRAWER_WIDTH_PX = 340
export const SCRIPT_VIEW_TOOL_RAIL_WIDTH_PX = 56

export function ScriptViewToolRail({
  active,
  onToggle,
  className,
}: {
  active: ScriptViewToolPanelId | null
  onToggle: (id: ScriptViewToolPanelId) => void
  className?: string
}) {
  return (
    <nav
      className={cn(
        'flex w-14 shrink-0 flex-col items-center gap-1 border-l border-border bg-card py-2',
        className,
      )}
      aria-label="Script tools"
      data-testid="script-view-tool-rail"
    >
      {SCRIPT_VIEW_TOOL_PANELS.map(({ id, label, icon: Icon }) => {
        const on = active === id
        return (
          <Tooltip key={id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  data-testid={`script-tool-${id}`}
                  aria-label={label}
                  aria-pressed={on}
                  className={cn(
                    'flex size-11 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] font-medium leading-none transition-colors',
                    on ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  onClick={() => onToggle(id)}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className="max-w-[3.25rem] truncate px-0.5">{label}</span>
                </button>
              }
            />
            <TooltipContent side="left">{label}</TooltipContent>
          </Tooltip>
        )
      })}
    </nav>
  )
}

export function ScriptViewToolDrawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <aside
      className="flex h-full min-h-0 w-[clamp(280px,38%,340px)] shrink-0 flex-col overflow-hidden border-l border-border bg-card"
      data-testid="script-view-tool-drawer"
      aria-label={title}
    >
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </aside>
  )
}
