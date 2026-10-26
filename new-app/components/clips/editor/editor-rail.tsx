'use client'

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

const RAIL: { id: EditorPanelId; label: string; icon: LucideIcon; tone?: string }[] = [
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

export function EditorRail({
  active,
  onChange,
}: {
  active: EditorPanelId
  onChange: (id: EditorPanelId) => void
}) {
  return (
    <nav
      data-testid="editor-rail"
      className="hidden w-12 shrink-0 flex-col gap-1 border-r border-border bg-sidebar py-2 lg:flex"
      aria-label="Editor tools"
    >
      {RAIL.map(({ id, label, icon: Icon, tone }) => (
        <Tooltip key={id}>
          <TooltipTrigger
            type="button"
            aria-label={label}
            aria-current={active === id ? 'page' : undefined}
            onClick={() => onChange(id)}
            className={cn(
              'relative grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active === id &&
                'bg-accent text-foreground before:absolute before:inset-y-2 before:-left-2 before:w-[3px] before:rounded-full before:bg-brand-gradient',
            )}
          >
            <Icon className={cn('size-5', active === id && tone)} aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      ))}
    </nav>
  )
}
