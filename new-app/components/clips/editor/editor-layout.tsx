'use client'
import { useCallback, useRef, type ReactNode } from 'react'
import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

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
  rail: 'min-h-0 lg:row-span-2 lg:col-start-1 lg:row-start-1',
  panelMobile: 'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:max-h-[70dvh] max-lg:rounded-t-xl max-lg:border-t',
  panelCompact: 'lg:max-xl:absolute lg:max-xl:inset-y-1 lg:max-xl:left-[68px] lg:max-xl:z-30 lg:max-xl:w-[340px] lg:max-xl:shadow-2xl',
  panelDocked: 'xl:relative xl:col-start-2 xl:row-start-1',
  panel: 'flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card',
  preview: 'flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg bg-panel lg:col-start-2 lg:row-start-1 xl:col-start-3',
  properties: 'hidden min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card 2xl:flex 2xl:col-start-4 2xl:row-start-1',
  timeline: 'col-span-full min-h-0 overflow-y-auto rounded-lg border border-border bg-card max-h-[clamp(160px,45dvh,560px)] lg:col-[2/-1] lg:row-start-2',
  backdrop: 'fixed inset-0 z-30 bg-black/50 lg:max-xl:bg-black/30 xl:hidden',
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
}) {
  const { band, panelOpen, panelWidthPx, onPanelWidthChange, hidePanelColumn, hidePropertiesColumn } = props
  const compact = props.compact === true
  const overlay = band === 'mobile' || band === 'compact'
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

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
    panelWidthPx != null
      ? ({
          ['--editor-panel-w' as string]: `${panelWidthPx}px`,
        } as React.CSSProperties)
      : undefined

  return (
    <div
      className={cn(compact ? EDITOR_GRID.rootCompact : EDITOR_GRID.root, 'relative')}
      style={panelStyle}
      data-testid="editor-grid"
      data-band={band}
      data-compact={compact ? 'true' : undefined}
      data-script-view={hidePanelColumn ? 'true' : undefined}
    >
      <div data-region="rail" className={EDITOR_GRID.rail}>{props.rail}</div>
      {overlay && panelOpen ? (
        <button type="button" aria-label="Close panel" className={EDITOR_GRID.backdrop} onClick={props.onClosePanel} data-testid="editor-panel-backdrop" />
      ) : null}
      <section
        data-region="panel"
        hidden={overlay && !panelOpen}
        className={cn(
          EDITOR_GRID.panel,
          EDITOR_GRID.panelMobile,
          EDITOR_GRID.panelCompact,
          EDITOR_GRID.panelDocked,
          'relative',
          hidePanelColumn && 'max-xl:hidden xl:hidden',
        )}
      >
        {props.panel}
        {onPanelWidthChange && panelWidthPx != null && !overlay ? (
          <button
            type="button"
            aria-label="Resize panel"
            data-testid="editor-panel-resize-handle"
            className="absolute -right-1 top-0 z-10 hidden h-full w-2 cursor-col-resize touch-none xl:block"
            onPointerDown={onResizePointerDown}
          />
        ) : null}
      </section>
      <section data-region="preview" className={EDITOR_GRID.preview}>{props.preview}</section>
      {compact ? null : (
        <aside
          data-region="properties"
          className={cn(EDITOR_GRID.properties, hidePropertiesColumn && '2xl:hidden')}
        >
          {props.properties}
        </aside>
      )}
      <section data-region="timeline" className={EDITOR_GRID.timeline}>{props.timeline}</section>
    </div>
  )
}
