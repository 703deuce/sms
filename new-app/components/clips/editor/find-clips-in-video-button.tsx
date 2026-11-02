'use client'

import { useEffect, useState } from 'react'
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
}: {
  projectId: string
  durationMs: number
  settings?: unknown
  onStarted?: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<{ credits: number | null; mode: 'highlights' | 'project' } | null>(null)

  useEffect(() => {
    if (!confirm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirm(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm])

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
          className="h-8 gap-1 rounded-r-none border-r-0"
          onClick={() => void ask('highlights')}
          disabled={busy}
          data-testid="editor-find-clips-in-video"
          title="Find the best moments and show them on the timeline"
        >
          {busy && !confirm ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
          Find clips
        </Button>
        <DropdownMenu>
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
        </DropdownMenu>
      </div>
      {confirm ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) setConfirm(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="find-clips-dialog-title"
            className="w-full max-w-md rounded-t-xl border border-border bg-background p-4 shadow-lg sm:rounded-xl"
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
        </div>
      ) : null}
    </>
  )
}
