'use client'

import { useCallback, useMemo, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Captions, Clapperboard, Eraser, Image as ImageIcon, Languages, LayoutPanelTop, Layers, Music2, Palette, Sparkles, FileText, Type, LayoutTemplate, SwatchBook, FolderOpen, SlidersHorizontal, Megaphone } from 'lucide-react'
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
  | 'media'
  | 'repurpose'
  | 'inspector'

/**
 * Clip editor rail, top to bottom. The launch items keep their positions; re-hooked tools are appended
 * below Audio (B-roll, Brand, Cover). Dub (paid AI voice) only with NEXT_PUBLIC_CLIP_EDITOR_AI_EXTRAS=1.
 * AI Producer stays off the rail (E4: ✨ top-bar pop-over). E4 appends Text, Templates, Color; E5 appends
 * Media (uploads, Rooms angles, multicam) last.
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
    'media',
    'repurpose',
    // G1a: selection-driven Properties inspector (canvas / timeline selection opens it).
    'inspector',
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
  { id: 'media', label: 'Media', icon: FolderOpen, tone: 'text-lane-broll' },
  { id: 'repurpose', label: 'Repurpose', icon: Megaphone, tone: 'text-lane-ai' },
  { id: 'inspector', label: 'Properties', icon: SlidersHorizontal },
]

/** Ordered by CLIP_EDITOR_RAIL_IDS (not ALL_EDITOR_RAIL_ITEMS) so existing items never move. */
export const EDITOR_RAIL_ITEMS = CLIP_EDITOR_RAIL_IDS.map((id) => ALL_EDITOR_RAIL_ITEMS.find((item) => item.id === id)).filter(
  (item): item is (typeof ALL_EDITOR_RAIL_ITEMS)[number] => Boolean(item),
)

const dubOnRail = CLIP_EDITOR_RAIL_IDS.includes('dub')

export const EDITOR_RAIL_GROUPS: { id: string; label: string; ids: EditorPanelId[] }[] = [
  { id: 'ai', label: 'AI', ids: dubOnRail ? ['repurpose', 'dub'] : ['repurpose'] },
  { id: 'edit', label: 'Edit', ids: ['transcript', 'cleanup', 'captions', 'text', 'layers'] },
  { id: 'media', label: 'Media', ids: ['media', 'broll', 'audio', 'thumbnail'] },
  { id: 'style', label: 'Style', ids: ['layout', 'templates', 'brand', 'color'] },
  { id: 'props', label: 'Properties', ids: ['inspector'] },
]

function shortRailLabel(label: string): string {
  if (label === 'AI Producer') return 'Producer'
  if (label === 'Properties') return 'Props'
  return label
}

const itemById = new Map(EDITOR_RAIL_ITEMS.map((item) => [item.id, item]))

export function editorRailIcon(id: EditorPanelId) {
  return EDITOR_RAIL_ITEMS.find((r) => r.id === id)?.icon ?? FileText
}

export function EditorRail({
  active,
  onChange,
  variant = 'vertical',
  hiddenIds = [],
}: {
  active: EditorPanelId
  onChange: (id: EditorPanelId) => void
  variant?: 'vertical' | 'horizontal'
  hiddenIds?: string[]
}) {
  const navRef = useRef<HTMLElement>(null)
  const horizontal = variant === 'horizontal'
  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds])

  const visibleItems = useMemo(
    () => EDITOR_RAIL_ITEMS.filter((item) => !hidden.has(item.id)),
    [hidden],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (horizontal) return
      const idx = visibleItems.findIndex((r) => r.id === active)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = visibleItems[Math.min(visibleItems.length - 1, idx + 1)]
        if (next) onChange(next.id)
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = visibleItems[Math.max(0, idx - 1)]
        if (prev) onChange(prev.id)
      }
    },
    [active, horizontal, onChange, visibleItems],
  )

  const renderButton = ({ id, label, icon: Icon, tone }: (typeof EDITOR_RAIL_ITEMS)[number], vertical: boolean) => {
    const isActive = active === id
    const btn = (
      <button
        type="button"
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        tabIndex={0}
        onClick={() => onChange(id)}
        className={cn(
          vertical
            ? 'relative flex h-12 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            : 'relative grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive &&
            vertical &&
            'bg-accent text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary',
          isActive && !vertical && 'bg-accent text-foreground',
        )}
      >
        <Icon className={cn('size-5', isActive && tone)} aria-hidden />
        {vertical ? (
          <span className="max-w-full truncate text-[11px] leading-none">{shortRailLabel(label)}</span>
        ) : null}
      </button>
    )
    if (horizontal) return btn
    return (
      <Tooltip>
        <TooltipTrigger render={btn} />
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <nav
      ref={navRef}
      data-testid="editor-rail"
      aria-label="Editor tools"
      onKeyDown={onKeyDown}
      className={cn(
        horizontal
          ? 'flex flex-row gap-1'
          : 'hidden h-full w-16 shrink-0 flex-col items-center gap-0.5 overflow-y-auto rounded-lg border border-border bg-card py-2 [scrollbar-width:thin] lg:flex',
      )}
    >
      {horizontal
        ? visibleItems.map((item) => <span key={item.id}>{renderButton(item, false)}</span>)
        : EDITOR_RAIL_GROUPS.map((group, gi) => {
            const groupItems = group.ids.map((id) => itemById.get(id)).filter((item): item is (typeof EDITOR_RAIL_ITEMS)[number] => Boolean(item) && !hidden.has(item.id))
            if (!groupItems.length) return null
            return (
              <div key={group.id} className="flex w-full flex-col items-center gap-0.5">
                {gi > 0 ? <div className="my-1 h-px w-8 bg-border" aria-hidden /> : null}
                {groupItems.map((item) => (
                  <span key={item.id}>{renderButton(item, true)}</span>
                ))}
              </div>
            )
          })}
    </nav>
  )
}
