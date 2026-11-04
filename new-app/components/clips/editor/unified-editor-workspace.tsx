'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { GripHorizontal, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

type TimelineDisplay = 'compact' | 'expanded' | 'focus'

const TIMELINE_HEIGHT_KEY = 'transovo.editor.unified.timelinePct.v3'
const INSPECTOR_OPEN_KEY = 'transovo.editor.unified.inspectorOpen'

function clampTimelinePct(value: number): number {
  return Math.max(35, Math.min(78, Math.round(value)))
}

/**
 * One presentation-only workspace. Editing state, transcript, preview, tool content and
 * timeline remain owned by EditorShell; this component never duplicates or modifies them.
 * The Inspector spans the full height of the workspace, alongside the timeline.
 */
export function UnifiedEditorWorkspace({
  main,
  inspector,
  timeline,
  timelineView,
  timelineHidden = false,
  onTimelineViewChange,
  inspectorWidthPx,
  onInspectorWidthChange,
  className,
}: {
  main: ReactNode
  inspector: ReactNode
  timeline: ReactNode
  timelineView: 'script' | 'timeline'
  timelineHidden?: boolean
  onTimelineViewChange: (view: 'script' | 'timeline') => void
  inspectorWidthPx: number
  onInspectorWidthChange: (width: number) => void
  className?: string
}) {
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [focus, setFocus] = useState(false)
  const [timelinePct, setTimelinePct] = useState(65)
  const [topBarHost, setTopBarHost] = useState<HTMLElement | null>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const timelineDrag = useRef<{ startY: number; startPct: number; height: number } | null>(null)
  const inspectorDrag = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    try {
      const savedInspector = localStorage.getItem(INSPECTOR_OPEN_KEY)
      setInspectorOpen(savedInspector == null ? window.innerWidth >= 1280 : savedInspector !== 'false')
      const stored = Number(localStorage.getItem(TIMELINE_HEIGHT_KEY))
      if (Number.isFinite(stored) && stored >= 35 && stored <= 78) setTimelinePct(stored)
    } catch {
      // Storage may be inaccessible; default layout still works.
    }
  }, [])

  useEffect(() => {
    setTopBarHost(document.getElementById('editor-workspace-controls'))
  }, [])

  const persistInspectorOpen = useCallback((next: boolean) => {
    setInspectorOpen(next)
    try { localStorage.setItem(INSPECTOR_OPEN_KEY, String(next)) } catch { /* private mode */ }
  }, [])

  const persistTimelinePct = useCallback((next: number) => {
    const pct = clampTimelinePct(next)
    setTimelinePct(pct)
    try { localStorage.setItem(TIMELINE_HEIGHT_KEY, String(pct)) } catch { /* private mode */ }
  }, [])

  const selectMode = useCallback((mode: TimelineDisplay) => {
    if (mode === 'focus') {
      onTimelineViewChange('timeline')
      setFocus(true)
    } else {
      setFocus(false)
      onTimelineViewChange(mode === 'compact' ? 'script' : 'timeline')
    }
  }, [onTimelineViewChange])

  const startTimelineResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (timelineView === 'script' || focus) return
    event.preventDefault()
    const height = workspaceRef.current?.getBoundingClientRect().height ?? 0
    if (!height) return
    timelineDrag.current = { startY: event.clientY, startPct: timelinePct, height }
    const onMove = (e: PointerEvent) => {
      const drag = timelineDrag.current
      if (drag) persistTimelinePct(drag.startPct + ((drag.startY - e.clientY) / drag.height) * 100)
    }
    const onUp = () => {
      timelineDrag.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startInspectorResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    inspectorDrag.current = { startX: event.clientX, startWidth: inspectorWidthPx }
    const onMove = (e: PointerEvent) => {
      const drag = inspectorDrag.current
      if (drag) onInspectorWidthChange(drag.startWidth + drag.startX - e.clientX)
    }
    const onUp = () => {
      inspectorDrag.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const mode: TimelineDisplay = focus ? 'focus' : timelineView === 'script' ? 'compact' : 'expanded'
  const gridRows = focus
    ? 'minmax(0,1fr)'
    : timelineHidden ? 'minmax(0,1fr) 0px 32px'
    : timelineView === 'script'
      ? 'minmax(0,1fr) 9px 150px'
      : `minmax(0,${100 - timelinePct}fr) 9px minmax(0,${timelinePct}fr)`

  const modeButtons = (
    <div className="flex min-w-0 shrink-0 items-center gap-0.5" role="group" aria-label="Timeline display">
      {(['compact', 'expanded', 'focus'] as const).map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={mode === item}
          data-testid={`unified-mode-${item}`}
          onClick={() => selectMode(item)}
          className={cn(
            'h-7 rounded-md px-1.5 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            mode === item ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {item === 'compact' ? 'Compact' : item === 'expanded' ? 'Timeline' : 'Focus'}
        </button>
      ))}
    </div>
  )
  const inspectorButton = (
    <button
      type="button"
      data-testid="unified-inspector-toggle"
      aria-label={inspectorOpen ? 'Hide Inspector' : 'Show Inspector'}
      title={inspectorOpen ? 'Hide Inspector' : 'Show Inspector'}
      aria-expanded={inspectorOpen}
      onClick={() => persistInspectorOpen(!inspectorOpen)}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {inspectorOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
    </button>
  )

  return (
    <>
      {topBarHost
        ? createPortal(
            <div className="flex items-center gap-1" data-testid="unified-top-bar-modes">
              {modeButtons}
              {inspectorButton}
            </div>,
            topBarHost,
          )
        : null}
    <div className={cn('flex h-full min-h-0 min-w-0 flex-col gap-1 overflow-hidden bg-background p-1', className)} data-testid="unified-editor-workspace">
      {!topBarHost ? <div data-testid="unified-mode-fallback" className="sr-only">{modeButtons}{inspectorButton}</div> : null}
      <div
        className="grid min-h-0 min-w-0 flex-1 gap-0 overflow-hidden"
        style={{ gridTemplateColumns: inspectorOpen ? `minmax(0,1fr) 7px ${inspectorWidthPx}px` : 'minmax(0,1fr)' }}
        data-testid="unified-editor-columns"
      >
        <div
          ref={workspaceRef}
          className="grid min-h-0 min-w-0 overflow-hidden"
          style={{ gridTemplateRows: gridRows }}
          data-testid="unified-main-workspace"
          data-timeline-mode={mode}
        >
          <section
            className={cn('min-h-0 min-w-0 overflow-hidden rounded-md border border-border/70 bg-panel', focus && 'hidden')}
            data-testid="unified-upper-workspace"
            aria-hidden={focus}
          >
            {main}
          </section>
          {!focus ? (
            <div className="flex min-h-0 items-center justify-center border-y border-border/50 bg-background" data-testid="unified-workspace-toolbar">

              <button
                type="button"
                aria-label="Resize timeline height"
                data-testid="unified-timeline-resize"
                onPointerDown={startTimelineResize}
                onKeyDown={(e) => {
                  if (timelineView === 'script') return
                  if (e.key === 'ArrowUp') { e.preventDefault(); persistTimelinePct(timelinePct + 3) }
                  if (e.key === 'ArrowDown') { e.preventDefault(); persistTimelinePct(timelinePct - 3) }
                }}
                disabled={timelineView === 'script'}
                className="flex h-2 w-24 cursor-row-resize items-center justify-center text-muted-foreground/70 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
              >
                <GripHorizontal className="size-3" />
              </button>
            </div>
          ) : null}
          <section className="min-h-0 min-w-0 overflow-hidden rounded-md border border-border/70 bg-card" data-testid="unified-timeline-region">
            {timeline}
          </section>
        </div>
        {inspectorOpen ? (
          <>
            <button
              type="button"
              aria-label="Resize tools panel width"
              data-testid="unified-inspector-resize"
              onPointerDown={startInspectorResize}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') { e.preventDefault(); onInspectorWidthChange(inspectorWidthPx + 12) }
                if (e.key === 'ArrowRight') { e.preventDefault(); onInspectorWidthChange(inspectorWidthPx - 12) }
              }}
              className="cursor-col-resize bg-border/30 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <aside className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border/70 bg-card" data-testid="unified-inspector-region">
              {inspector}
            </aside>
          </>
        ) : null}
      </div>
    </div>
    </>
  )
}
