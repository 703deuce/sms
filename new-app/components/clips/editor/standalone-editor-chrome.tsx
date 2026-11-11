'use client'

import type { ComponentType, ReactNode } from 'react'
import { ArrowLeft, Download, Redo2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EditorModeSwitcher, type EditorModeSwitcherMode } from '@/components/clips/editor/editor-mode-switcher'
import {
  editorIconBtn,
  editorToolbarDivider,
  editorToolbarRow,
  editorToolbarTextBtn,
} from '@/lib/clips/editor/editor-chrome-tokens'
import {
  writeClipEditorLayoutView,
  type ClipEditorLayoutView,
} from '@/lib/clips/editor/editor-layout-view'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'

type SaveState = 'saved' | 'saving' | 'dirty' | 'error'

type LayoutHandoffArgs = {
  view: ClipEditorLayoutView
  projectId: string
  clipId: string
  clipperStudio?: boolean
  flushSave: () => Promise<unknown>
  persistLayout?: (view: ClipEditorLayoutView) => void
  navigate?: (url: string) => void
}

export async function finishStandaloneLayoutHandoff({
  view,
  projectId,
  clipId,
  clipperStudio = false,
  flushSave,
  persistLayout = writeClipEditorLayoutView,
  navigate = (url) => window.location.assign(url),
}: LayoutHandoffArgs) {
  await flushSave()
  persistLayout(view)
  navigate(clipperStudio ? routes.studio(projectId, clipId) : routes.edit(projectId, clipId))
}

function ChromeMenu({
  id,
  label,
  children,
}: {
  id: 'file' | 'edit' | 'view'
  label: string
  children: ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground data-[popup-open]:bg-muted data-[popup-open]:text-foreground"
            data-testid={'standalone-menu-' + id}
          />
        }
      >
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" sideOffset={6}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function StandaloneEditorChrome({
  projectTitle,
  title,
  current,
  saveState,
  statusText,
  canUndo,
  canRedo,
  disabled = false,
  contextSlot,
  onBack,
  onUndo,
  onRedo,
  onExport,
  onRetrySave,
  onModeSelect,
  onLayoutSelect,
}: {
  projectTitle?: string
  title: string
  current: EditorModeSwitcherMode
  saveState: SaveState
  statusText?: string
  canUndo: boolean
  canRedo: boolean
  disabled?: boolean
  contextSlot?: ReactNode
  onBack: () => void
  onUndo: () => void
  onRedo: () => void
  onExport: () => void
  onRetrySave: () => void
  onModeSelect: (mode: EditorModeSwitcherMode) => void
  onLayoutSelect: (view: ClipEditorLayoutView) => void
}) {
  const renderedStatus =
    statusText ??
    (saveState === 'saved'
      ? 'Saved'
      : saveState === 'error'
        ? 'Save failed'
        : 'Saving…')

  return (
    <header className={editorToolbarRow + ' relative z-50'} data-testid="standalone-editor-chrome">
      <button type="button" className={editorIconBtn} aria-label="Back" disabled={disabled} onClick={onBack}>
        <ArrowLeft />
      </button>
      <nav className="hidden shrink-0 items-center md:flex" aria-label="Standalone editor menu">
        <ChromeMenu id="file" label="File">
          <DropdownMenuItem onClick={onBack}>Back to project</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onExport}>Export video…</DropdownMenuItem>
        </ChromeMenu>
        <ChromeMenu id="edit" label="Edit">
          <DropdownMenuItem disabled={!canUndo} onClick={onUndo}>Undo</DropdownMenuItem>
          <DropdownMenuItem disabled={!canRedo} onClick={onRedo}>Redo</DropdownMenuItem>
        </ChromeMenu>
        <ChromeMenu id="view" label="View">
          <DropdownMenuItem disabled={disabled} onClick={() => onLayoutSelect('script')}>Open Compact editor</DropdownMenuItem>
          <DropdownMenuItem disabled={disabled} onClick={() => onLayoutSelect('timeline')}>Open Timeline editor</DropdownMenuItem>
        </ChromeMenu>
      </nav>
      <span className={editorToolbarDivider} />
      <div className="min-w-0">
        {projectTitle ? <p className="max-w-[220px] truncate text-[10px] text-muted-foreground">{projectTitle}</p> : null}
        <h1 className="max-w-[280px] truncate text-xs font-semibold">{title}</h1>
      </div>
      {contextSlot}
      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground" aria-live="polite">{renderedStatus}</span>
      {saveState === 'error' ? (
        <Button size="sm" variant="outline" disabled={disabled} onClick={onRetrySave}>Retry save</Button>
      ) : null}
      <span className={editorToolbarDivider} />
      <button type="button" className={editorIconBtn} disabled={disabled || !canUndo} aria-label="Undo" onClick={onUndo}><Undo2 /></button>
      <button type="button" className={editorIconBtn} disabled={disabled || !canRedo} aria-label="Redo" onClick={onRedo}><Redo2 /></button>
      <button type="button" className={editorToolbarTextBtn} disabled={disabled} onClick={onExport}><Download />Export</button>
      <EditorModeSwitcher current={current} disabled={disabled} onSelect={onModeSelect} />
    </header>
  )
}

export type StandaloneEditorRailItem = {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  active?: boolean
  disabled?: boolean
  title?: string
  onSelect: () => void
}

export function StandaloneEditorToolRail({
  label,
  items,
  className,
}: {
  label: string
  items: StandaloneEditorRailItem[]
  className?: string
}) {
  return (
    <nav
      aria-label={label}
      data-testid="standalone-editor-tool-rail"
      className={cn(
        'order-last flex h-full w-14 shrink-0 flex-col items-center gap-1 overflow-y-auto rounded-lg border border-border/70 bg-muted/20 px-1 py-2',
        className,
      )}
    >
      {items.map(({ id, label: itemLabel, icon: Icon, active, disabled, title, onSelect }) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          title={title}
          aria-current={active ? 'page' : undefined}
          onClick={onSelect}
          className={cn(
            'flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[9px] leading-none transition-colors disabled:pointer-events-none disabled:opacity-40',
            active
              ? 'bg-accent font-semibold text-foreground ring-1 ring-border'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <Icon className="size-5" />
          {itemLabel}
        </button>
      ))}
    </nav>
  )
}
