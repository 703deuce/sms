'use client'

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Captions, Eraser, FileText, FolderOpen, Image as ImageIcon, Languages, LayoutPanelTop, Layers, LayoutTemplate, Megaphone, MoreHorizontal, Music2, Palette, SlidersHorizontal, Sparkles, SwatchBook, Type, Clapperboard } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { clipEditorAiExtrasEnabled } from '@/lib/clips/clip-editor-feature-flags'
import {
  clipEditorLeftPanelIds,
  editorRailGroups,
  panelToRailGroup,
  readRailGroupTab,
  type EditorRailGroupId,
} from '@/lib/clips/editor/editor-rail-navigation'
import {
  buildEditorDockTabEntries,
  type EditorDockLeadingTab,
  type EditorDockTabEntry,
} from '@/lib/clips/editor/editor-dock-tabs'

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

/** Left-column panels (legacy helper — prefer editorRailGroups). */
export function clipEditorRailIds(aiExtras: boolean = clipEditorAiExtrasEnabled()): EditorPanelId[] {
  return clipEditorLeftPanelIds(aiExtras)
}

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
  { id: 'color', label: 'Effects', icon: SwatchBook, tone: 'text-lane-broll' },
  { id: 'media', label: 'Media', icon: FolderOpen, tone: 'text-lane-broll' },
  { id: 'repurpose', label: 'Repurpose', icon: Megaphone, tone: 'text-lane-ai' },
  { id: 'inspector', label: 'Properties', icon: SlidersHorizontal },
]

export const EDITOR_RAIL_ITEMS = ALL_EDITOR_RAIL_ITEMS.filter((item) =>
  clipEditorLeftPanelIds(true).includes(item.id),
)

/** @deprecated Phase 2 uses editorRailGroups — kept for tests referencing group shape. */
export const EDITOR_RAIL_GROUPS: { id: string; label: string; ids: EditorPanelId[] }[] = editorRailGroups().map((g) => ({
  id: g.id,
  label: g.label,
  ids: g.tabs.map((t) => t.id),
}))

const itemById = new Map(ALL_EDITOR_RAIL_ITEMS.map((item) => [item.id, item]))

export function editorRailIcon(id: EditorPanelId) {
  const group = panelToRailGroup(id)
  if (group) return group.icon
  return itemById.get(id)?.icon ?? FileText
}

const DOCK_TAB_PX = 78
const DOCK_TAB_COMPACT_PX = 44
const DOCK_MORE_PX = 52

export function EditorRail({
  active,
  onChange,
  onSelectGroup,
  variant = 'vertical',
  hiddenIds = [],
  /** Script tab (or other) before rail groups — included in dock strip fit. */
  leadingTabs = [],
  /** 8th tab: Properties (fit + overflow). */
  includePropertiesTab = false,
  /** Timeline view: focus right Properties column instead of opening inspector panel. */
  onPropertiesTab,
}: {
  active: EditorPanelId
  onChange: (id: EditorPanelId) => void
  /** When set, group clicks resolve last-used tab per group. */
  onSelectGroup?: (groupId: EditorRailGroupId) => void
  variant?: 'vertical' | 'horizontal' | 'tabs'
  hiddenIds?: string[]
  leadingTabs?: EditorDockLeadingTab[]
  includePropertiesTab?: boolean
  onPropertiesTab?: () => void
}) {
  const navRef = useRef<HTMLElement>(null)
  const horizontal = variant === 'horizontal'
  /** TIMELINE_LAYOUT5: CapCut-style short icon+label strip across the top of the tools card. */
  const tabs = variant === 'tabs'
  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds])
  const groups = useMemo(() => editorRailGroups(), [])
  const activeGroupId = panelToRailGroup(active)?.id ?? null

  const visibleGroups = useMemo(() => groups.filter((g) => g.tabs.some((t) => !hidden.has(t.id))), [groups, hidden])

  const dockEntries = useMemo(
    () =>
      tabs
        ? buildEditorDockTabEntries({
            leading: leadingTabs,
            includeProperties: includePropertiesTab,
            hiddenPanelIds: hidden,
          })
        : [],
    [tabs, leadingTabs, includePropertiesTab, hidden],
  )

  const stripOuterRef = useRef<HTMLDivElement>(null)
  const [inlineTabCount, setInlineTabCount] = useState(() => dockEntries.length)
  const [compactTabs, setCompactTabs] = useState(false)

  useLayoutEffect(() => {
    if (!tabs) return
    const el = stripOuterRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      if (w <= 0 || dockEntries.length === 0) return
      const compact = w / dockEntries.length < 68
      const tabPx = compact ? DOCK_TAB_COMPACT_PX : DOCK_TAB_PX
      setCompactTabs(compact)
      const allFit = dockEntries.length * tabPx <= w
      if (allFit) {
        setInlineTabCount(dockEntries.length)
        return
      }
      const withMore = Math.max(1, Math.floor((w - DOCK_MORE_PX) / tabPx))
      setInlineTabCount(Math.min(withMore, dockEntries.length))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [tabs, dockEntries.length])

  const inlineEntries = tabs ? dockEntries.slice(0, inlineTabCount) : []
  const overflowEntries = tabs ? dockEntries.slice(inlineTabCount) : []

  const pickGroup = useCallback(
    (groupId: EditorRailGroupId) => {
      if (onSelectGroup) {
        onSelectGroup(groupId)
        return
      }
      const group = groups.find((g) => g.id === groupId)
      if (!group) return
      const fallback = group.tabs[0]!.id
      onChange(readRailGroupTab(groupId, fallback))
    },
    [groups, onChange, onSelectGroup],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (horizontal) return
      const idx = visibleGroups.findIndex((g) => g.id === activeGroupId)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = visibleGroups[Math.min(visibleGroups.length - 1, idx + 1)]
        if (next) pickGroup(next.id)
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prev = visibleGroups[Math.max(0, idx - 1)]
        if (prev) pickGroup(prev.id)
      }
    },
    [activeGroupId, horizontal, pickGroup, visibleGroups],
  )

  const inlineGroups = tabs ? visibleGroups : visibleGroups
  const overflowGroups = tabs ? [] : []

  const entryActive = (entry: EditorDockTabEntry) => {
    if (entry.kind === 'leading' || entry.kind === 'properties') return active === entry.panelId
    return activeGroupId === entry.groupId
  }

  const overflowActive = overflowEntries.some((e) => entryActive(e))

  const activateEntry = (entry: EditorDockTabEntry) => {
    if (entry.kind === 'leading') {
      onChange(entry.panelId)
      return
    }
    if (entry.kind === 'properties') {
      if (onPropertiesTab) onPropertiesTab()
      else onChange(entry.panelId)
      return
    }
    pickGroup(entry.groupId)
  }

  const renderDockTabButton = (entry: EditorDockTabEntry) => {
    const isActive = entryActive(entry)
    const Icon = entry.icon
    const btn = (
      <button
        type="button"
        aria-label={entry.label}
        aria-current={isActive ? 'page' : undefined}
        tabIndex={0}
        data-testid={
          entry.kind === 'group'
            ? `editor-rail-group-${entry.groupId}`
            : entry.kind === 'properties'
              ? 'timeline-dock-properties'
              : `editor-rail-leading-${entry.panelId}`
        }
        onClick={() => activateEntry(entry)}
        className={cn(
          'relative flex h-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          compactTabs ? 'w-11' : 'w-[4.875rem]',
          isActive && 'bg-accent text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary',
        )}
      >
        <Icon className="size-[1.125rem]" aria-hidden />
        {!compactTabs ? (
          <span className="max-w-full truncate text-[0.6875rem] font-medium leading-none">{entry.label}</span>
        ) : null}
      </button>
    )
    return compactTabs ? (
      <Tooltip>
        <TooltipTrigger render={btn} />
        <TooltipContent side="bottom">{entry.label}</TooltipContent>
      </Tooltip>
    ) : (
      btn
    )
  }

  const renderGroupButton = (group: (typeof groups)[number], vertical: boolean) => {
    const isActive = activeGroupId === group.id
    const Icon = group.icon
    const btn = (
      <button
        type="button"
        aria-label={group.label}
        aria-current={isActive ? 'page' : undefined}
        tabIndex={0}
        data-testid={`editor-rail-group-${group.id}`}
        onClick={() => pickGroup(group.id)}
        className={cn(
          tabs
            ? 'relative flex h-11 w-[4.875rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            : vertical
            ? 'relative flex h-12 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            : 'relative grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive && tabs && 'text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary',
          isActive &&
            vertical &&
            !tabs &&
            'bg-accent text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary',
          isActive && !vertical && 'bg-accent text-foreground',
        )}
      >
        <Icon className={tabs ? 'size-[1.125rem]' : 'size-5'} aria-hidden />
        {vertical || tabs ? (
          <span className={cn('max-w-full truncate leading-none', tabs ? 'text-[0.6875rem] font-medium' : 'text-[11px]')}>{group.label}</span>
        ) : null}
      </button>
    )
    if (horizontal) return btn
    return (
      <Tooltip>
        <TooltipTrigger render={btn} />
        <TooltipContent side="right">{group.label}</TooltipContent>
      </Tooltip>
    )
  }

  if (tabs) {
    return (
      <div ref={stripOuterRef} className="flex min-w-0 flex-1 items-stretch gap-0" data-testid="editor-dock-tab-strip">
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <nav
            ref={navRef}
            data-testid="editor-rail"
            aria-label="Editor tools"
            className="flex min-w-0 flex-1 flex-row flex-nowrap items-stretch overflow-hidden"
          >
            {inlineEntries.map((entry) => (
              <div key={entry.kind === 'group' ? entry.groupId : entry.panelId} className="flex shrink-0">
                {renderDockTabButton(entry)}
              </div>
            ))}
          </nav>
        </div>
        {overflowEntries.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className={cn(
                    'relative flex h-11 w-[3.25rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-muted-foreground hover:bg-accent hover:text-foreground',
                    overflowActive && 'bg-accent text-foreground',
                  )}
                  data-testid="editor-rail-more-tabs"
                  aria-label="More tools"
                >
                  <MoreHorizontal className="size-[1.125rem]" aria-hidden />
                  <span className="text-[0.6875rem] font-medium leading-none">More</span>
                </button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-40">
              {overflowEntries.map((entry) => (
                <DropdownMenuItem
                  key={entry.kind === 'group' ? entry.groupId : entry.panelId}
                  data-testid={
                    entry.kind === 'group'
                      ? `editor-rail-group-${entry.groupId}`
                      : entry.kind === 'properties'
                        ? 'timeline-dock-properties'
                        : `editor-rail-leading-${entry.panelId}`
                  }
                  onClick={() => activateEntry(entry)}
                  className={entryActive(entry) ? 'bg-accent' : undefined}
                >
                  {entry.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn(tabs && 'flex min-w-0 flex-1 items-stretch overflow-hidden')}>
    <nav
      ref={navRef}
      data-testid="editor-rail"
      aria-label="Editor tools"
      onKeyDown={onKeyDown}
      className={cn(
        tabs
          ? 'flex min-w-0 flex-row flex-nowrap items-stretch gap-0 overflow-hidden'
          : horizontal
          ? 'flex flex-row gap-1'
          : 'hidden h-full w-16 shrink-0 flex-col items-center gap-0.5 overflow-y-auto rounded-lg border border-border bg-card py-2 [scrollbar-width:thin] lg:flex',
      )}
    >
      {inlineGroups.map((group, gi) => (
        <div key={group.id} className="flex w-full flex-col items-center gap-0.5">
          {gi > 0 && !horizontal ? <div className="my-1 h-px w-8 bg-border" aria-hidden /> : null}
          {renderGroupButton(group, !horizontal)}
        </div>
      ))}
    </nav>
    </div>
  )
}
