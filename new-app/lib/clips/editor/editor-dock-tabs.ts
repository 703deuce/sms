'use client'

import type { LucideIcon } from 'lucide-react'
import { SlidersHorizontal } from 'lucide-react'
import type { EditorPanelId } from '@/components/clips/editor/editor-rail'
import { editorRailGroups, type EditorRailGroupId } from '@/lib/clips/editor/editor-rail-navigation'

/** 8th dock tab (Timeline view): Properties — counted in strip fit, not a rail group. */
export const EDITOR_DOCK_PROPERTIES = {
  panelId: 'inspector' as EditorPanelId,
  label: 'Properties',
  icon: SlidersHorizontal,
}

export type EditorDockLeadingTab = {
  panelId: EditorPanelId
  label: string
  icon: LucideIcon
}

export type EditorDockTabEntry =
  | { kind: 'leading'; panelId: EditorPanelId; label: string; icon: LucideIcon }
  | { kind: 'group'; groupId: EditorRailGroupId; label: string; icon: LucideIcon }
  | { kind: 'properties'; panelId: EditorPanelId; label: string; icon: LucideIcon }

export function buildEditorDockTabEntries(opts: {
  leading?: EditorDockLeadingTab[]
  includeProperties?: boolean
  hiddenPanelIds?: Set<string>
  aiExtras?: boolean
}): EditorDockTabEntry[] {
  const hidden = opts.hiddenPanelIds ?? new Set<string>()
  const groups = editorRailGroups(opts.aiExtras).filter((g) => g.tabs.some((t) => !hidden.has(t.id)))
  const out: EditorDockTabEntry[] = []
  for (const t of opts.leading ?? []) {
    out.push({ kind: 'leading', panelId: t.panelId, label: t.label, icon: t.icon })
  }
  for (const g of groups) {
    out.push({ kind: 'group', groupId: g.id, label: g.label, icon: g.icon })
  }
  if (opts.includeProperties) {
    out.push({
      kind: 'properties',
      panelId: EDITOR_DOCK_PROPERTIES.panelId,
      label: EDITOR_DOCK_PROPERTIES.label,
      icon: EDITOR_DOCK_PROPERTIES.icon,
    })
  }
  return out
}
