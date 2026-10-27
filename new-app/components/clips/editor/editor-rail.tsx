'use client'

import { useCallback, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Captions,
  Clapperboard,
  Image as ImageIcon,
  Languages,
  LayoutPanelTop,
  Music2,
  Palette,
  Sparkles,
  FileText,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type EditorPanelId =
  | 'producer'
  | 'transcript'
  | 'layout'
  | 'captions'
  | 'broll'
  | 'audio'
  | 'thumbnail'
  | 'dub'
  | 'brand'

export const EDITOR_RAIL_ITEMS: {
  id: EditorPanelId
  label: string
  icon: LucideIcon
  tone?: string
}[] = [
  { id: 'producer', label: 'AI Producer', icon: Sparkles, tone: 'text-lane-ai' },
  { id: 'transcript', label: 'Script', icon: FileText },
  { id: 'layout', label: 'Layout', icon: LayoutPanelTop, tone: 'text-lane-broll' },
  { id: 'captions', label: 'Captions', icon: Captions, tone: 'text-lane-caption' },
  { id: 'broll', label: 'B-roll', icon: Clapperboard, tone: 'text-lane-broll' },
  { id: 'audio', label: 'Audio', icon: Music2, tone: 'text-lane-music' },
  { id: 'thumbnail', label: 'Cover', icon: ImageIcon, tone: 'text-lane-brand' },
  { id: 'dub', label: 'Dub', icon: Languages, tone: 'text-lane-voice' },
  { id: 'brand', label: 'Brand', icon: Palette, tone: 'text-lane-brand' },
]

export function editorRailIcon(id: EditorPanelId) {
  return EDITOR_RAIL_ITEMS.find((r) => r.id === id)?.icon ?? FileText
}

export function EditorRail({
  active,
  onChange,
  variant = 'vertical',
}: {
  active: EditorPanelId
  onChange: (id: EditorPanelId) => void
  variant?: 'vertical' | 'horizontal'
}) {
  const navRef = useRef<HTMLElement>(null)
  const horizontal = variant === 'horizontal'

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (horizontal) return
      const idx = EDITOR_RAIL_ITEMS.findIndex((r) => r.id === active)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = EDITOR_RAIL_ITEMS[Math.min(EDITOR_RAIL_ITEMS.length - 1, idx + 1)]
        if (next) onChange(next.id)
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = EDITOR_RAIL_ITEMS[Math.max(0, idx - 1)]
        if (prev) onChange(prev.id)
      }
    },
    [active, horizontal, onChange],
  )

  return (
    <nav
      ref={navRef}
      data-testid="editor-rail"
      aria-label="Editor tools"
      onKeyDown={onKeyDown}
      className={cn(
        horizontal
          ? 'flex flex-row gap-1'
          : 'hidden w-14 shrink-0 flex-col items-center gap-1 border-l border-border bg-sidebar py-2 lg:flex',
      )}
    >
      {EDITOR_RAIL_ITEMS.map(({ id, label, icon: Icon, tone }) => {
        const isActive = active === id
        const btn = (
          <button
            type="button"
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            tabIndex={0}
            onClick={() => onChange(id)}
            className={cn(
              'relative grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive &&
                !horizontal &&
                'bg-accent text-foreground before:absolute before:inset-y-2 before:-left-2 before:w-[3px] before:rounded-full before:bg-brand-gradient',
              isActive && horizontal && 'bg-accent text-foreground',
            )}
          >
            <Icon className={cn('size-5', isActive && tone)} aria-hidden />
          </button>
        )
        if (horizontal) return <span key={id}>{btn}</span>
        return (
          <Tooltip key={id}>
            <TooltipTrigger render={btn} />
            <TooltipContent side="left">{label}</TooltipContent>
          </Tooltip>
        )
      })}
    </nav>
  )
}
