import type { LucideIcon } from 'lucide-react'
import {
  Captions,
  FileText,
  FolderOpen,
  Layers,
  LayoutTemplate,
  Music2,
  Type,
  Wand2,
} from 'lucide-react'
import type { EditorPanelId } from '@/components/clips/editor/editor-rail'
import { clipEditorAiExtrasEnabled } from '@/lib/clips/clip-editor-feature-flags'

export type EditorRailGroupId =
  | 'script'
  | 'captions'
  | 'text'
  | 'media'
  | 'audio'
  | 'effects'
  | 'layers'
  | 'templates'

export type EditorRailGroupSpec = {
  id: EditorRailGroupId
  label: string
  icon: LucideIcon
  tabs: { id: EditorPanelId; tabLabel: string }[]
}

const LS_PREFIX = 'transovo.editor.railTab.'

export function editorRailGroups(aiExtras: boolean = clipEditorAiExtrasEnabled()): EditorRailGroupSpec[] {
  return [
    {
      id: 'script',
      label: 'Script',
      icon: FileText,
      tabs: [
        { id: 'transcript', tabLabel: 'Script' },
        { id: 'cleanup', tabLabel: 'Cleanup' },
      ],
    },
    { id: 'captions', label: 'Captions', icon: Captions, tabs: [{ id: 'captions', tabLabel: 'Captions' }] },
    { id: 'text', label: 'Text', icon: Type, tabs: [{ id: 'text', tabLabel: 'Text' }] },
    {
      id: 'media',
      label: 'Media',
      icon: FolderOpen,
      tabs: [
        { id: 'media', tabLabel: 'Media' },
        { id: 'broll', tabLabel: 'B-roll' },
        { id: 'thumbnail', tabLabel: 'Cover' },
      ],
    },
    {
      id: 'audio',
      label: 'Audio',
      icon: Music2,
      tabs: [
        { id: 'audio', tabLabel: 'Audio' },
        ...(aiExtras ? ([{ id: 'dub' as EditorPanelId, tabLabel: 'Dub' }] as const) : []),
      ],
    },
    {
      id: 'effects',
      label: 'Effects',
      icon: Wand2,
      tabs: [
        { id: 'color', tabLabel: 'Color' },
        { id: 'layout', tabLabel: 'Polish' },
      ],
    },
    { id: 'layers', label: 'Layers', icon: Layers, tabs: [{ id: 'layers', tabLabel: 'Layers' }] },
    {
      id: 'templates',
      label: 'Templates',
      icon: LayoutTemplate,
      tabs: [
        { id: 'templates', tabLabel: 'Templates' },
        { id: 'brand', tabLabel: 'Brand' },
      ],
    },
  ]
}

const PANEL_ALIASES: Partial<Record<EditorPanelId, EditorPanelId>> = {
  producer: 'transcript',
}

export function normalizeEditorPanelId(id: EditorPanelId): EditorPanelId {
  return PANEL_ALIASES[id] ?? id
}

export function panelToRailGroup(panel: EditorPanelId, aiExtras?: boolean): EditorRailGroupSpec | null {
  const id = normalizeEditorPanelId(panel)
  if (id === 'repurpose' || id === 'inspector' || id === 'producer') return null
  return editorRailGroups(aiExtras).find((g) => g.tabs.some((t) => t.id === id)) ?? null
}

export function readRailGroupTab(groupId: EditorRailGroupId, fallback: EditorPanelId): EditorPanelId {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${groupId}`)
    if (raw) return raw as EditorPanelId
  } catch {
    /* private mode */
  }
  return fallback
}

export function writeRailGroupTab(groupId: EditorRailGroupId, panelId: EditorPanelId) {
  try {
    localStorage.setItem(`${LS_PREFIX}${groupId}`, panelId)
  } catch {
    /* private mode */
  }
}

/** Map legacy inventory rail labels to a panel id (opens the right group tab). */
export const INVENTORY_RAIL_LABEL_TO_PANEL: Record<string, EditorPanelId> = {
  Script: 'transcript',
  Cleanup: 'cleanup',
  Captions: 'captions',
  Text: 'text',
  Media: 'media',
  'B-roll': 'broll',
  Cover: 'thumbnail',
  Audio: 'audio',
  Dub: 'dub',
  Color: 'color',
  Polish: 'layout',
  Layers: 'layers',
  Templates: 'templates',
  Brand: 'brand',
  Repurpose: 'repurpose',
  Properties: 'inspector',
}

export function railGroupIcon(id: EditorRailGroupId): LucideIcon {
  return editorRailGroups().find((g) => g.id === id)?.icon ?? FileText
}

/** Panels still mounted in the left column (not top bar / right column only). */
export function clipEditorLeftPanelIds(aiExtras: boolean = clipEditorAiExtrasEnabled()): EditorPanelId[] {
  const tabs = editorRailGroups(aiExtras).flatMap((g) => g.tabs.map((t) => t.id))
  return [...tabs, 'repurpose']
}

export function clipEditorRailGroupIds(): EditorRailGroupId[] {
  return editorRailGroups().map((g) => g.id)
}
