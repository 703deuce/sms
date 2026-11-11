'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Loader2, MoreHorizontal, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { clipsFetch, estimateCredits } from '@/lib/clips-api'

/** Confirm text — credits only, never provider $ (John t371u). */
export function findClipsConfirmText(credits: number | null): string {
  return credits != null
    ? `Find clips in this video? Est. ${credits} credits. Your full-video edit stays as it is.`
    : 'Find clips in this video? Your full-video edit stays as it is.'
}

/**
 * FV1: from a full-video project, start clip finding over the same video (transcript reused).
 */
export function FindClipsInVideoButton({
  projectId,
  durationMs,
  settings,
  onStarted,
  highlightsOnly = false,
}: {
  projectId: string
  durationMs: number
  settings?: unknown
  onStarted?: () => void
  /** Chat intake only: hide the legacy cut-into-project branch. */
  highlightsOnly?: boolean
}) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<{ credits: number | null; mode: 'highlights' | 'project' } | null>(null)

  useEffect(() => {
    if (!confirm) return
    const priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.querySelector<HTMLButtonElement>('[data-testid="find-clips-start"]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault()
        e.stopPropagation()
        setConfirm(null)
      }
      if (e.key !== 'Tab') return
      const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      if (!buttons.length) return
      const first = buttons[0], last = buttons[buttons.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true); priorFocus?.focus() }
  }, [Boolean(confirm), busy])

  const ask = async (mode: 'highlights' | 'project') => {
    if (busy) return
    setBusy(true)
    let credits: number | null = null
    try {
      const est = await estimateCredits({ durationMs, rangeStartMs: 0, rangeEndMs: durationMs, settings: settings ?? {} })
      credits = typeof est?.credits === 'number' ? est.credits : null
    } catch {
      credits = null
    } finally {
      setBusy(false)
    }
    setConfirm({ credits, mode })
  }

  const run = async () => {
    if (busy || !confirm) return
    setBusy(true)
    try {
      if (confirm.mode === 'highlights') {
        await clipsFetch<{ jobId: string; mode: 'highlights' }>(
          `/api/clips/projects/${encodeURIComponent(projectId)}/find-clips`,
          { method: 'POST', body: JSON.stringify({ mode: 'highlights' }) },
        )
        setConfirm(null)
        onStarted?.()
      } else {
        const project = await clipsFetch<{ id: string }>(`/api/clips/projects/${encodeURIComponent(projectId)}/find-clips`, {
          method: 'POST',
          body: '{}',
        })
        setConfirm(null)
        router.push(`/app/clips/${project.id}`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start clip finding')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={highlightsOnly ? 'h-8 gap-1' : 'h-8 gap-1 rounded-r-none border-r-0'}
          onClick={() => void ask('highlights')}
          disabled={busy}
          data-testid="editor-find-clips-in-video"
          title="Find the best moments and show them on the timeline"
        >
          {busy && !confirm ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
          Find clips
        </Button>
        {!highlightsOnly ? <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-l-none px-2"
              disabled={busy}
              aria-label="More find clips options"
              data-testid="editor-find-clips-menu"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              data-testid="editor-find-clips-legacy-project"
              onClick={() => void ask('project')}
            >
              Cut into a new clips project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> : null}
      </div>
      {confirm && typeof document !== 'undefined' ? createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setConfirm(null)
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="find-clips-dialog-title"
            className="relative z-10 my-auto w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-border bg-background p-4 shadow-lg"
            data-testid="find-clips-dialog"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg tile-primary">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <div>
                <h2 id="find-clips-dialog-title" className="text-lg font-semibold">
                  Find clips in this video
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground" data-testid="find-clips-dialog-text">
                  {findClipsConfirmText(confirm.credits)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setConfirm(null)} data-testid="find-clips-cancel">
                Cancel
              </Button>
              <Button autoFocus type="button" size="sm" disabled={busy} onClick={() => void run()} data-testid="find-clips-start">
                {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                Find clips
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  )
}
