import { fireEvent, within, type RenderResult } from '@testing-library/react'
import {
  INVENTORY_RAIL_LABEL_TO_PANEL,
  editorRailGroups,
  panelToRailGroup,
} from '@/lib/clips/editor/editor-rail-navigation'
import type { EditorPanelId } from '@/components/clips/editor/editor-rail'

export type InventoryDiscover = {
  kind: string
  label?: string
  openTestId?: string
  note?: string
}

export function openPanelId(ui: RenderResult, panelId: EditorPanelId) {
  if (panelId === 'repurpose') {
    fireEvent.click(ui.getByTestId('editor-repurpose-open'))
    return
  }
  if (panelId === 'inspector') {
    prepareCanvasSelection(ui)
    return
  }
  const group = panelToRailGroup(panelId)
  if (!group) return
  const rails = ui.getAllByTestId('editor-rail')
  const rail = rails[0]!
  fireEvent.click(within(rail).getByRole('button', { name: group.label }))
  if (group.tabs.length > 1) {
    const tab = ui.queryByTestId(`editor-panel-tab-${panelId}`)
    if (tab) fireEvent.click(tab)
  }
}

export function openRailDiscoverLabel(ui: RenderResult, label: string) {
  const panelId = INVENTORY_RAIL_LABEL_TO_PANEL[label]
  if (panelId) openPanelId(ui, panelId)
}

export function prepareCanvasSelection(ui: RenderResult) {
  const item = ui.queryAllByTestId('timeline-item-video')[0]
  if (item) fireEvent.click(item)
  const frame = ui.queryByTestId('preview-canvas-root')
  if (frame) fireEvent.click(frame)
}

export function openTimelineContextMenu(ui: RenderResult) {
  const item = ui.queryAllByTestId('timeline-item-video')[0]
  if (item) fireEvent.contextMenu(item)
}

export function applyDiscover(ui: RenderResult, discover: InventoryDiscover) {
  switch (discover.kind) {
    case 'rail':
      if (discover.label) openRailDiscoverLabel(ui, discover.label)
      break
    case 'export':
      if (!ui.queryByTestId('export-dialog')) {
        fireEvent.click(ui.getByRole('button', { name: 'Export' }))
      }
      break
    case 'producer': {
      if (!ui.queryByTestId('producer-popover')) {
        const btn = ui.queryByRole('button', { name: /AI Producer/i })
        if (btn) fireEvent.click(btn)
      }
      break
    }
    case 'previewView':
      fireEvent.click(ui.getByTestId('preview-view-menu'))
      break
    case 'timelineChrome':
      fireEvent.click(ui.getByTestId('timeline-tool-trigger'))
      fireEvent.click(ui.getByTestId('timeline-more-menu'))
      break
    case 'canvas':
    case 'selection':
      prepareCanvasSelection(ui)
      break
    case 'ctx':
      openTimelineContextMenu(ui)
      break
    case 'click':
      if (discover.openTestId) {
        const opener = ui.queryByTestId(discover.openTestId)
        if (opener) fireEvent.click(opener)
      }
      break
    default:
      break
  }
}

export function prepareFullEditorInventory(ui: RenderResult) {
  applyDiscover(ui, { kind: 'timelineChrome' })
  applyDiscover(ui, { kind: 'previewView' })
  applyDiscover(ui, { kind: 'export' })

  for (const g of editorRailGroups(false)) {
    for (const t of g.tabs) openPanelId(ui, t.id)
  }
  openPanelId(ui, 'repurpose')
  prepareCanvasSelection(ui)
  openTimelineContextMenu(ui)

  const producerBtn = ui.queryByRole('button', { name: /AI Producer/i })
  if (producerBtn) fireEvent.click(producerBtn)
}

export function assertInventoryDom(ui: RenderResult, entries: { testId: string; discover: InventoryDiscover }[]) {
  const missing: string[] = []
  for (const entry of entries) {
    applyDiscover(ui, entry.discover)
    if (!ui.queryAllByTestId(entry.testId).length) missing.push(entry.testId)
  }
  return missing
}
