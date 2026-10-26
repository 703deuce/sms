'use client'

import Link from 'next/link'
import {
  ArrowLeft,
  CloudAlert,
  CloudCheck,
  Download,
  Loader2,
  Redo2,
  Sparkles,
  Undo2,
} from 'lucide-react'
import { PrimaryButton } from '@/components/app/primary-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function EditorTopBar({
  backHref,
  title,
  onTitleChange,
  saveState,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExport,
  onOpenProducer,
  producerStrip,
  pendingPaidCount = 0,
}: {
  backHref: string
  title: string
  onTitleChange: (t: string) => void
  saveState: 'saved' | 'saving' | 'dirty'
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onExport: () => void
  onOpenProducer?: () => void
  producerStrip?: { changeCount: number; onUndo: () => void } | null
  pendingPaidCount?: number
}) {
  const saveTone =
    saveState === 'saving'
      ? 'text-muted-foreground'
      : saveState === 'dirty'
        ? 'text-destructive'
        : 'text-muted-foreground'

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur">
      <Button size="icon" variant="ghost" aria-label="Back to project" render={<Link href={backHref} />}>
        <ArrowLeft className="size-4" />
      </Button>
      <Input
        className="h-9 max-w-md border-transparent bg-transparent text-base font-semibold shadow-none hover:border-input focus-visible:border-input"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        aria-label="Clip title"
      />
      <span className={cn('shrink-0', saveTone)} aria-live="polite">
        {saveState === 'saving' && (
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
        {saveState === 'dirty' && (
          <span className="inline-flex items-center gap-1 text-xs text-destructive">
            <CloudAlert className="size-3.5" aria-hidden />
            Not saved
          </span>
        )}
      </span>
      {producerStrip && producerStrip.changeCount > 0 ? (
        <div
          data-testid="producer-undo-strip"
          className="hidden items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs sm:flex"
        >
          <span>{producerStrip.changeCount} producer change{producerStrip.changeCount === 1 ? '' : 's'}</span>
          <Button size="sm" variant="outline" onClick={producerStrip.onUndo}>Undo</Button>
        </div>
      ) : null}
      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-40"
            aria-label="Undo"
          >
            <Undo2 className="size-4" />
          </TooltipTrigger>
          <TooltipContent>
            Undo <Kbd>⌘Z</Kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-40"
            aria-label="Redo"
          >
            <Redo2 className="size-4" />
          </TooltipTrigger>
          <TooltipContent>
            Redo <Kbd>⇧⌘Z</Kbd>
          </TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="relative gap-1.5"
          onClick={onOpenProducer}
        >
          <Sparkles className="size-4 text-lane-ai" aria-hidden />
          AI Producer
          {pendingPaidCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-warning" aria-hidden />
          )}
        </Button>
        <PrimaryButton type="button" size="sm" className="gap-1.5" onClick={onExport}>
          <Download className="size-4" aria-hidden />
          Export
        </PrimaryButton>
      </div>
    </header>
  )
}
