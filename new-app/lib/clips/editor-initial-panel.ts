/**
 * Additive initial-panel helper for the clip editor.
 * `?tab=captions` (or any known EditorPanelId) selects that panel on init.
 * When the param is absent or unknown, the default stays transcript.
 */
import type { EditorPanelId } from '../../components/clips/editor/editor-rail'

export const EDITOR_DEFAULT_PANEL: EditorPanelId = 'transcript'

const EDITOR_PANELS: readonly EditorPanelId[] = [
  'producer',
  'transcript',
  'cleanup',
  'layout',
  'layers',
  'captions',
  'broll',
  'audio',
  'thumbnail',
  'dub',
  'brand',
  'text',
  'motion',
  'templates',
  'color',
  'media',
  'repurpose',
  'inspector',
]

export function editorPanelFromSearchParam(tab: string | null | undefined): EditorPanelId {
  if (tab && (EDITOR_PANELS as readonly string[]).includes(tab)) return tab as EditorPanelId
  return EDITOR_DEFAULT_PANEL
}
