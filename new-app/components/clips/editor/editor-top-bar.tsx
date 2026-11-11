'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  CloudAlert,
  CloudCheck,
  Download,
  Loader2,
  Save,
  Redo2,
  Sparkles,
  Undo2,
} from 'lucide-react'
import { PrimaryButton } from '@/components/app/primary-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SidebarToggleButton } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

export function EditorTopBar({
  backHref,
  title,
  onTitleChange,
  titleMenuSlot,
  saveState,
  optimisticPending = false,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  historySlot,
  onExport,
  onSaveAsTemplate,
  onOpenProducer,
  showStandaloneProducerButton = true,
  onRetrySave,
  producerOpen = false,
  producerStrip,
  pendingPaidCount = 0,
  layoutSlot,
  versionsSlot,
  layoutViewSlot,
  menuBarSlot,
}: {
  backHref: string
  title: string
  onTitleChange: (t: string) => void
  /** When set, replaces the clip title input (File menu). */
  titleMenuSlot?: React.ReactNode
  saveState: 'saved' | 'saving' | 'dirty' | 'error'
  optimisticPending?: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  historySlot?: React.ReactNode
  onExport: () => void
  onSaveAsTemplate?: () => void
  onRetrySave?: () => void
  onOpenProducer?: () => void
  /** The mode switcher already supplies this entry on standard editor surfaces. */
  showStandaloneProducerButton?: boolean
  producerOpen?: boolean
  producerStrip?: { changeCount: number; onUndo: () => void } | null
  pendingPaidCount?: number
  layoutSlot?: React.ReactNode
  versionsSlot?: React.ReactNode
  /** Phase 3: Script | Timeline segmented control (left of AI Producer). */
  layoutViewSlot?: React.ReactNode
  /** MENUBAR1: File · Edit · View · Clip · Audio · Tools · Help + search (left, after save state). */
  menuBarSlot?: React.ReactNode
}) {
  const saveTone =
    saveState === 'error'
      ? 'text-destructive'
      : saveState === 'saved'
        ? 'text-muted-foreground'
        : 'text-muted-foreground'

  return (
    <header className="flex h-10 shrink-0 items-center gap-1 overflow-hidden border-b border-border bg-background/80 px-2 backdrop-blur [@media(max-height:800px)]:h-9" data-testid="editor-top-bar">
      <SidebarToggleButton />
      <Button size="icon" variant="ghost" aria-label="Back to project" render={<Link href={backHref} />}>
        <ArrowLeft className="size-4" />
      </Button>
      {menuBarSlot ? (
        <div className="flex min-w-0 shrink-0 items-center" data-testid="editor-top-bar-left">
          {menuBarSlot}
        </div>
      ) : null}
      <Separator orientation="vertical" className="mx-1 hidden h-5 shrink-0 lg:block" />
      <div className="flex min-w-0 max-w-[min(22vw,220px)] shrink items-center overflow-hidden" data-testid="editor-top-bar-project">
      {titleMenuSlot ?? (
          <Input
            className="h-8 w-full min-w-0 border-transparent bg-transparent text-sm font-semibold shadow-none hover:border-input focus-visible:border-input"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            aria-label="Clip title"
          />
        )}
      </div>
      <div className="flex shrink-0 items-center" data-testid="editor-top-bar-save">
      <span className={cn('shrink-0', saveTone)} aria-live="polite">
          {optimisticPending && saveState !== 'saving' ? (
            <Badge variant="outline" className="mr-2 h-6 text-[11px] font-normal">
              Pending save
            </Badge>
          ) : null}
          {(saveState === 'saving' || saveState === 'dirty') && (
            <span className="inline-flex items-center gap-1 text-xs">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Saving…
            </span>
          )}
          {saveState === 'saved' && (
            <span className="inline-flex items-center gap-1 text-xs">
              <CloudCheck className="size-3.5" aria-hidden />
              Saved
            </span>
          )}
          {saveState === 'error' && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-destructive"
              onClick={() => onRetrySave?.()}
            >
              <CloudAlert className="mr-1 size-3.5 inline" aria-hidden />
              Not saved · Retry
            </Button>
          )}
        </span>
      </div>
      {producerStrip && producerStrip.changeCount > 0 ? (
        <div
          data-testid="producer-undo-strip"
          className="hidden items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs sm:flex"
        >
          <span>{producerStrip.changeCount} producer change{producerStrip.changeCount === 1 ? '' : 's'}</span>
          <Button size="sm" variant="outline" onClick={producerStrip.onUndo}>Undo</Button>
        </div>
      ) : null}
      <div className="relative z-10 ml-auto flex shrink-0 items-center gap-1 bg-background pl-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!canUndo}
                onClick={onUndo}
                aria-label="Undo"
                className="text-muted-foreground max-[1499px]:hidden"
              />
            }
          >
            <Undo2 className="size-4" />
          </TooltipTrigger>
          <TooltipContent>
            Undo <Kbd>⌘Z</Kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={!canRedo}
                onClick={onRedo}
                aria-label="Redo"
                className="text-muted-foreground max-[1499px]:hidden"
              />
            }
          >
            <Redo2 className="size-4" />
          </TooltipTrigger>
          <TooltipContent>
            Redo <Kbd>⇧⌘Z</Kbd>
          </TooltipContent>
        </Tooltip>
        <div id="editor-workspace-controls" data-testid="editor-workspace-controls" className="flex shrink-0 items-center gap-1" />
        {historySlot}
        <Separator orientation="vertical" className="mx-1 h-6" />
        {layoutViewSlot}
        {onOpenProducer && showStandaloneProducerButton ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              'relative gap-1.5',
              producerOpen && 'border-primary/50 bg-primary/10 text-foreground',
            )}
            onClick={() => onOpenProducer()}
            aria-pressed={producerOpen}
            aria-controls="editor-panel-producer"
            title="AI Producer"
          >
            <Sparkles className="size-4 text-lane-ai" aria-hidden />
            <span className="max-[1499px]:sr-only">AI Producer</span>
            {pendingPaidCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-warning" aria-hidden />
            )}
          </Button>
        ) : null}
        {layoutSlot}
        {versionsSlot}
        {onSaveAsTemplate ? <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onSaveAsTemplate}>
          <Save className="size-4" aria-hidden />
          <span className="max-[1499px]:sr-only">Save as template</span>
        </Button> : null}
        <PrimaryButton type="button" size="sm" className="gap-1.5" onClick={onExport}>
          <Download className="size-4" aria-hidden />
          Export
        </PrimaryButton>
      </div>
    </header>
  )
}
