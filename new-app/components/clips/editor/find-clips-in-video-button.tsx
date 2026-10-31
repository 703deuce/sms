'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { clipsFetch, estimateCredits } from '@/lib/clips-api'

/** Confirm text — credits only, never provider $ (John t371u). */
export function findClipsConfirmText(credits: number | null): string {
  return credits != null
    ? `Find clips in this video? Est. ${credits} credits. Your full-video edit stays as it is.`
    : 'Find clips in this video? Your full-video edit stays as it is.'
}

/**
 * FV1: from a full-video project, start clip finding over the same video (transcript reused).
 * FVfix: confirms in the app's in-page dialog (same look as the Export dialog), not window.confirm.
 */
export function FindClipsInVideoButton({
  projectId,
  durationMs,
  settings,
}: {
  projectId: string
  durationMs: number
  settings?: unknown
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<{ credits: number | null } | null>(null)

  useEffect(() => {
    if (!confirm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirm(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm])

  const ask = async () => {
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
    setConfirm({ credits })
  }

  const start = async () => {
    if (busy) return
    setBusy(true)
    try {
      const project = await clipsFetch<{ id: string }>(`/api/clips/projects/${encodeURIComponent(projectId)}/find-clips`, {
        method: 'POST',
        body: '{}',
      })
      setConfirm(null)
      router.push(`/app/clips/${project.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start clip finding')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1"
        onClick={() => void ask()}
        disabled={busy}
        data-testid="editor-find-clips-in-video"
        title="Find short clips in this video (opens a new clips project; this edit is kept)"
      >
        {busy && !confirm ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
        Find clips in this video
      </Button>
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
              <Button autoFocus type="button" size="sm" disabled={busy} onClick={() => void start()} data-testid="find-clips-start">
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
