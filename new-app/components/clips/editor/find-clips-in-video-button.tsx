'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { clipsFetch, estimateCredits } from '@/lib/clips-api'

/**
 * FV1: from a full-video project, start clip finding over the same video (transcript reused).
 * Shows credits only — never provider $ (John t371u).
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
  const run = async () => {
    if (busy) return
    setBusy(true)
    try {
      let credits: number | null = null
      try {
        const est = await estimateCredits({ durationMs, rangeStartMs: 0, rangeEndMs: durationMs, settings: settings ?? {} })
        credits = typeof est?.credits === 'number' ? est.credits : null
      } catch {
        credits = null
      }
      const msg =
        credits != null
          ? `Find clips in this video? Est. ${credits} credits. Your full-video edit stays as it is.`
          : 'Find clips in this video? Your full-video edit stays as it is.'
      if (!window.confirm(msg)) return
      const project = await clipsFetch<{ id: string }>(`/api/clips/projects/${encodeURIComponent(projectId)}/find-clips`, {
        method: 'POST',
        body: '{}',
      })
      router.push(`/app/clips/${project.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not start clip finding')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1"
      onClick={() => void run()}
      disabled={busy}
      data-testid="editor-find-clips-in-video"
      title="Find short clips in this video (opens a new clips project; this edit is kept)"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}
      Find clips in this video
    </Button>
  )
}
