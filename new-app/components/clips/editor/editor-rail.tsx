'use client'

import { useCallback, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Captions, Clapperboard, Eraser, Image as ImageIcon, Languages, LayoutPanelTop, Layers, Music2, Palette, Sparkles, FileText, Type, LayoutTemplate, SwatchBook } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { clipEditorAiExtrasEnabled } from '@/lib/clips/clip-editor-feature-flags'

export type EditorPanelId =
  | 'producer'
  | 'transcript'
  | 'cleanup'
  | 'layout'
  | 'layers'
  | 'captions'
  | 'broll'
  | 'audio'
  | 'thumbnail'
  | 'dub'
  | 'brand'
  | 'text'
  | 'templates'
  | 'color'

/**
 * Clip editor rail, top to bottom. The launch items keep their positions; re-hooked tools are appended
 * below Audio (B-roll, Brand, Cover). Dub (paid AI voice) only with NEXT_PUBLIC_CLIP_EDITOR_AI_EXTRAS=1.
 * AI Producer stays off the rail (E4: ✨ top-bar pop-over). E4 appends Text, Templates, Color last.
 */
export function clipEditorRailIds(aiExtras: boolean = clipEditorAiExtrasEnabled()): EditorPanelId[] {
  return [
    'transcript',
    'cleanup',
    'layout',
    'layers',
    'captions',
    'audio',
    'broll',
    'brand',
    'thumbnail',
    ...(aiExtras ? (['dub'] as EditorPanelId[]) : []),
    'text',
    'templates',
    'color',
  ]
}

const CLIP_EDITOR_RAIL_IDS: EditorPanelId[] = clipEditorRailIds()

const ALL_EDITOR_RAIL_ITEMS: {
  id: EditorPanelId
  label: string
  icon: LucideIcon
  tone?: string
}[] = [
  { id: 'producer', label: 'AI Producer', icon: Sparkles, tone: 'text-lane-ai' },
  { id: 'transcript', label: 'Script', icon: FileText },
  { id: 'cleanup', label: 'Cleanup', icon: Eraser, tone: 'text-lane-broll' },
  { id: 'layout', label: 'Polish', icon: LayoutPanelTop, tone: 'text-lane-broll' },
  { id: 'layers', label: 'Layers', icon: Layers, tone: 'text-lane-brand' },
  { id: 'captions', label: 'Captions', icon: Captions, tone: 'text-lane-caption' },
  { id: 'broll', label: 'B-roll', icon: Clapperboard, tone: 'text-lane-broll' },
  { id: 'audio', label: 'Audio', icon: Music2, tone: 'text-lane-music' },
  { id: 'thumbnail', label: 'Cover', icon: ImageIcon, tone: 'text-lane-brand' },
  { id: 'dub', label: 'Dub', icon: Languages, tone: 'text-lane-voice' },
  { id: 'brand', label: 'Brand', icon: Palette, tone: 'text-lane-brand' },
  { id: 'text', label: 'Text', icon: Type, tone: 'text-lane-caption' },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate, tone: 'text-lane-brand' },
  { id: 'color', label: 'Color', icon: SwatchBook, tone: 'text-lane-broll' },
]

/** Ordered by CLIP_EDITOR_RAIL_IDS (not ALL_EDITOR_RAIL_ITEMS) so existing items never move. */
export const EDITOR_RAIL_ITEMS = CLIP_EDITOR_RAIL_IDS.map((id) => ALL_EDITOR_RAIL_ITEMS.find((item) => item.id === id)).filter(
  (item): item is (typeof ALL_EDITOR_RAIL_ITEMS)[number] => Boolean(item),
)

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
