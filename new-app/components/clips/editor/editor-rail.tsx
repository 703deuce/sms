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

const RAIL: { id: EditorPanelId; label: string; icon: LucideIcon }[] = [
  { id: 'producer', label: 'Producer', icon: Sparkles },
  { id: 'transcript', label: 'Script', icon: FileText },
  { id: 'layout', label: 'Layout', icon: LayoutPanelTop },
  { id: 'captions', label: 'Captions', icon: Captions },
  { id: 'broll', label: 'B-roll', icon: Clapperboard },
  { id: 'audio', label: 'Audio', icon: Music2 },
  { id: 'thumbnail', label: 'Cover', icon: ImageIcon },
  { id: 'dub', label: 'Dub', icon: Languages },
  { id: 'brand', label: 'Brand', icon: Palette },
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
      className="flex w-12 shrink-0 flex-col gap-1 border-r border-border bg-card/40 p-1"
      aria-label="Editor panels"
    >
      {RAIL.map(({ id, label, icon: Icon }) => (
        <Tooltip key={id}>
          <TooltipTrigger
            type="button"
            aria-label={label}
            aria-current={active === id ? 'page' : undefined}
            onClick={() => onChange(id)}
            className={cn(
              'grid size-10 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              active === id && 'bg-primary/15 text-primary',
            )}
          >
            <Icon className="size-5" aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      ))}
    </nav>
  )
}
