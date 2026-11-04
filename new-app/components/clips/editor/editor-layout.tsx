'use client'
import { useCallback, useRef, type ReactNode } from 'react'
import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'
import { useEditorGridSizing } from '@/lib/clips/editor/use-editor-grid-sizing'
import { useEditorTimelineRow } from '@/lib/clips/editor/use-editor-timeline-row'

export type EditorBand = 'mobile' | 'compact' | 'desktop' | 'wide'
export function bandForWidth(w: number): EditorBand {
  return w >= 1536 ? 'wide' : w >= 1280 ? 'desktop' : w >= 1024 ? 'compact' : 'mobile'
}
const subscribe = (cb: () => void) => { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb) }
export function useEditorBand(): EditorBand {
  return useSyncExternalStore(subscribe, () => bandForWidth(window.innerWidth), () => 'desktop')
}
export function aspectCssToNumber(aspect: string): number {
  const [w, h] = aspect.split(/[/:]/).map((n) => Number(n.trim()))
  return w > 0 && h > 0 ? w / h : 16 / 9
}

export const EDITOR_GRID = {
  root: 'grid h-full min-h-0 overflow-hidden bg-background gap-1 p-1 ' +
    'grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] ' +
    'lg:grid-cols-[64px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto] ' +
    'xl:grid-cols-[64px_var(--editor-panel-w,360px)_minmax(0,1fr)] ' +
    '2xl:grid-cols-[64px_var(--editor-panel-w,360px)_minmax(0,1fr)_minmax(280px,320px)]',
  /** FIX2 R7: compact clip editor, no 4th (Properties) column at 2xl. */
  rootCompact: 'grid h-full min-h-0 overflow-hidden bg-background gap-1 p-1 ' +
    'grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] ' +
    'lg:grid-cols-[64px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto] ' +
    'xl:grid-cols-[64px_var(--editor-panel-w,360px)_minmax(0,1fr)] ' +
    '2xl:grid-cols-[64px_var(--editor-panel-w,360px)_minmax(0,1fr)]',
  /** Script view without docked tools (mobile / legacy). */
  rootScript:
    'relative isolate grid h-full min-h-0 overflow-hidden bg-background gap-1 p-1 ' +
    'grid-cols-1 grid-rows-[minmax(0,1fr)_var(--editor-timeline-row-h,168px)] ' +
    'lg:grid-cols-[minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_var(--editor-timeline-row-h,168px)]',
  /** Script view: keep the mobile rail, hide the desktop rail. */
  railScript: 'min-h-0 lg:hidden',
  rail: 'min-h-0 lg:row-span-2 lg:col-start-1 lg:row-start-1',
  panelMobile: 'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:max-h-[70dvh] max-lg:rounded-t-xl max-lg:border-t',
  panelCompact: 'lg:max-xl:absolute lg:max-xl:inset-y-1 lg:max-xl:left-[68px] lg:max-xl:z-30 lg:max-xl:w-[340px] lg:max-xl:shadow-2xl',
  panelDocked: 'xl:relative xl:col-start-2 xl:row-start-1',
  /** Script view: panel column not in grid (display none at xl+). */
  panelScriptHidden: 'hidden max-xl:hidden xl:hidden',
  panel: 'flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card',
  preview:
    'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg bg-panel lg:col-start-2 lg:row-start-1 xl:col-start-3 2xl:col-start-3',
  /** Script view main column (spans former panel + preview width). */
  previewScript:
    'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-panel lg:col-start-1 lg:row-start-1',
  properties:
    'hidden min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card 2xl:flex 2xl:col-start-4 2xl:row-start-1',
  /** Script view: properties column absent (do not merge with properties + 2xl:hidden). */
  propertiesHidden: 'hidden',
  timeline:
    'col-span-full min-h-0 overflow-y-auto rounded-lg border border-border bg-card max-h-[clamp(160px,45dvh,560px)] lg:col-[2/-1] lg:row-start-2',
  /** Script view: compact timeline row, fixed 148px (140px strip + border/padding). */
  timelineScript:
    'relative isolate z-10 col-span-full flex min-h-0 max-h-[var(--editor-timeline-row-h,168px)] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card lg:col-start-1 lg:row-start-2',
  backdrop: 'fixed inset-0 z-30 bg-black/50 lg:max-xl:bg-black/30 xl:hidden',
  /** TIMELINE_LAYOUT1: Timeline view like Script view: preview | docked panel | tool rail (right); timeline full width below. */
  rootDock:
    'relative isolate grid h-full min-h-0 max-h-full overflow-hidden bg-background gap-1 p-1 ' +
    'grid-cols-1 grid-rows-[minmax(0,1fr)_var(--editor-timeline-row-h,240px)] ' +
    'lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-rows-[minmax(0,1fr)_var(--editor-timeline-row-h,240px)]',
  /** TIMELINE_LAYOUT8: one tools card — tab strip + panel body share column 1 (no empty grid row when panel closed). */
  toolsDock:
    'relative isolate z-0 flex min-h-0 min-w-0 max-h-full flex-col overflow-hidden rounded-lg border border-border bg-card lg:col-start-1 lg:row-start-1 lg:w-[var(--editor-tools-w,clamp(200px,20vw,340px))] lg:min-h-0 lg:max-w-[min(100%,520px)]',
  toolsDockCollapsed:
    'lg:w-[min(var(--editor-tools-w,240px),100%)] lg:max-w-[min(100%,520px)]',
  toolsDockRail: 'min-h-0 min-w-0 shrink-0 border-b border-border bg-card/80',
  toolsDockPanel: 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overflow-y-auto border-t border-border',
  /** @deprecated split rail/panel rows — use toolsDock */
  railDock: 'min-h-0 min-w-0 shrink-0 lg:col-start-1 lg:row-start-1 lg:w-[clamp(260px,28vw,440px)]',
  panelDock: 'flex min-h-0 min-w-0 flex-1 flex-col lg:col-start-1 lg:row-start-2 lg:w-[clamp(260px,28vw,440px)] lg:max-h-none',
  previewDock:
    'relative isolate z-0 flex min-h-0 min-w-0 max-h-full flex-col overflow-hidden lg:col-start-2 lg:row-start-1 lg:min-h-0',
  propertiesDock:
    'relative isolate z-0 flex min-h-0 min-w-0 max-h-full flex-col overflow-hidden rounded-lg border border-border bg-card lg:col-start-3 lg:row-start-1 lg:w-[var(--editor-props-w,clamp(200px,17vw,300px))] lg:min-h-0',
  timelineDock:
    'relative isolate z-10 col-span-full flex min-h-0 max-h-[var(--editor-timeline-row-h,240px)] flex-col overflow-hidden rounded-lg border border-border bg-card lg:col-start-1 lg:col-span-full lg:row-start-2',
  timelineRowResizeHandle:
    'h-1.5 shrink-0 cursor-row-resize touch-none rounded-t-lg bg-transparent hover:bg-primary/25 active:bg-primary/40',
} as const

export function EditorLayout(props: {
  band: EditorBand
  rail: ReactNode
  panel: ReactNode
  panelOpen: boolean
  onClosePanel: () => void
  preview: ReactNode
  properties: ReactNode
  timeline: ReactNode
  /** FIX2 R7: compact clip editor (no Properties column). */
  compact?: boolean
  /** Phase 2b: resizable left panel width (px), xl+ docked column. */
  panelWidthPx?: number
  onPanelWidthChange?: (px: number) => void
  /** Phase 3: Descript-style script view hides the docked side panel column. */
  hidePanelColumn?: boolean
  hidePropertiesColumn?: boolean
  /** TIMELINE_LAYOUT1: tools rail + docked panel on the left (Timeline view, lg+). */
  dockTools?: boolean
}) {
  const { band, panelOpen, panelWidthPx, onPanelWidthChange, hidePanelColumn, hidePropertiesColumn } = props
  const compact = props.compact === true
  const scriptView = hidePanelColumn === true
  const timelineDock = props.dockTools === true
  const overlay = band === 'mobile' || band === 'compact'
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  useEditorGridSizing(gridRef)
  const timelineRowMode = timelineDock ? 'timeline-dock' : scriptView ? 'script' : 'default'
  const { onRowResizePointerDown } = useEditorTimelineRow(gridRef, timelineRowMode)

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onPanelWidthChange || panelWidthPx == null) return
      e.preventDefault()
      dragRef.current = { startX: e.clientX, startW: panelWidthPx }
      const onMove = (ev: PointerEvent) => {
        const st = dragRef.current
        if (!st) return
        onPanelWidthChange(st.startW + (ev.clientX - st.startX))
      }
      const onUp = () => {
        dragRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [onPanelWidthChange, panelWidthPx],
  )

  const panelStyle =
    panelWidthPx != null && !scriptView
      ? ({
          ['--editor-panel-w' as string]: `${panelWidthPx}px`,
        } as React.CSSProperties)
      : undefined

  const dock = timelineDock
  const rootClass = timelineDock
    ? EDITOR_GRID.rootDock
    : scriptView
      ? EDITOR_GRID.rootScript
      : compact
        ? EDITOR_GRID.rootCompact
        : EDITOR_GRID.root
  const previewClass = dock ? EDITOR_GRID.previewDock : scriptView ? EDITOR_GRID.previewScript : EDITOR_GRID.preview
  const timelineClass = timelineDock
    ? EDITOR_GRID.timelineDock
    : scriptView
      ? EDITOR_GRID.timelineScript
      : EDITOR_GRID.timeline
  const propertiesClass = dock
    ? EDITOR_GRID.propertiesDock
    : compact || hidePropertiesColumn
      ? EDITOR_GRID.propertiesHidden
      : EDITOR_GRID.properties

  return (
    <div
      ref={gridRef}
      className={rootClass}
      style={panelStyle}
      data-testid="editor-grid"
      data-band={band}
      data-compact={compact ? 'true' : undefined}
      data-script-view={scriptView ? 'true' : undefined}
    >
      {timelineDock ? (
        <div
          data-region="tools"
          data-tools-collapsed={panelOpen ? undefined : 'true'}
          className={cn(EDITOR_GRID.toolsDock, !panelOpen && EDITOR_GRID.toolsDockCollapsed)}
        >
          <div data-region="rail" className={EDITOR_GRID.toolsDockRail}>
            {props.rail}
          </div>
          {panelOpen ? (
            <section data-region="panel" data-dock="true" className={EDITOR_GRID.toolsDockPanel}>
              {props.panel}
            </section>
          ) : null}
        </div>
      ) : (
        <>
          <div data-region="rail" className={scriptView ? EDITOR_GRID.railScript : EDITOR_GRID.rail}>
            {props.rail}
          </div>
          {overlay && panelOpen ? (
            <button
              type="button"
              aria-label="Close panel"
              className={EDITOR_GRID.backdrop}
              onClick={props.onClosePanel}
              data-testid="editor-panel-backdrop"
            />
          ) : null}
          <section
            data-region="panel"
            hidden={overlay && !panelOpen}
            className={cn(
              EDITOR_GRID.panel,
              EDITOR_GRID.panelMobile,
              EDITOR_GRID.panelCompact,
              scriptView ? EDITOR_GRID.panelScriptHidden : EDITOR_GRID.panelDocked,
              'relative',
            )}
          >
            {props.panel}
            {onPanelWidthChange && panelWidthPx != null && !overlay && !scriptView ? (
              <button
                type="button"
                aria-label="Resize panel"
                data-testid="editor-panel-resize-handle"
                className="absolute -right-1 top-0 z-10 hidden h-full w-2 cursor-col-resize touch-none xl:block"
                onPointerDown={onResizePointerDown}
              />
            ) : null}
          </section>
        </>
      )}
      <section data-region="preview" className={previewClass}>
        {props.preview}
      </section>
      {compact && !dock ? null : (
        <aside
          data-region="properties"
          className={cn(propertiesClass, dock && 'lg:[display:var(--editor-props-visible,flex)]')}
        >
          {props.properties}
        </aside>
      )}
      <section data-region="timeline" className={timelineClass}>
        {timelineDock ? (
          <button
            type="button"
            aria-label="Resize timeline region"
            data-testid="editor-timeline-row-resize"
            className={EDITOR_GRID.timelineRowResizeHandle}
            onPointerDown={onRowResizePointerDown}
          />
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{props.timeline}</div>
      </section>
    </div>
  )
}
