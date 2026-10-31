'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import {
  coverImageClass,
  coverJobActive,
  coverJobNotice,
  coverPollMs,
  stableCoverItems,
  type CoverJobRow,
  type CoverUrlCache,
} from '@/lib/clips/editor/cover-jobs'
import { toast } from 'sonner'

type ThumbRow = {
  id: string
  generationId: string
  aspect: string
  titleText: string | null
  picked: boolean
  downloadUrl: string | null
  status: string
  error?: string | null
}

export function ThumbnailPanel({
  clipId,
  edits,
  onEdits,
}: {
  clipId: string
  edits: ClipEditsV2
  onEdits: (edits: ClipEditsV2) => void
}) {
  const [aspect, setAspect] = useState<'9:16' | '16:9'>('9:16')
  const [titleOverride, setTitleOverride] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ThumbRow[]>([])
  const [jobs, setJobs] = useState<CoverJobRow[]>([])
  // E1fix: the job this panel started; cleared once it finishes (success or failure toast).
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null)
  const pollErrorShown = useRef(false)
  // E6: stable signed URLs per cover (see stableCoverItems) + one re-sign retry per broken image.
  const urlCache = useRef<CoverUrlCache>(new Map())
  const imgRetried = useRef<Set<string>>(new Set())
  const [imgFailed, setImgFailed] = useState<Set<string>>(() => new Set())

  const refresh = useCallback(async () => {
    try {
      const data = await clipsFetch<{ items: ThumbRow[]; jobs?: CoverJobRow[] }>(`/api/clips/clips/${clipId}/thumbnail`)
      setItems(stableCoverItems(data.items ?? [], urlCache.current))
      setJobs(data.jobs ?? [])
      pollErrorShown.current = false
    } catch (e) {
      // E1fix: surface poll failures once (was swallowed, so the panel just stayed empty).
      if (!pollErrorShown.current) {
        pollErrorShown.current = true
        toast.error(e instanceof Error ? `Could not load covers: ${e.message}` : 'Could not load covers')
      }
    } finally {
      setLoading(false)
    }
  }, [clipId])

  const runningJob = jobs.find((j) => coverJobActive(j.status)) ?? null
  const pollMs = coverPollMs(trackedJobId ? [{ id: trackedJobId, status: 'RUNNING' }, ...jobs] : jobs, items)

  useEffect(() => {
    setLoading(true)
    void refresh()
  }, [refresh])

  useEffect(() => {
    const t = setInterval(() => void refresh(), pollMs)
    return () => clearInterval(t)
  }, [refresh, pollMs])

  // A job started before this panel mounted (or by another tab) is tracked too.
  useEffect(() => {
    if (!trackedJobId && runningJob) setTrackedJobId(runningJob.id)
  }, [runningJob, trackedJobId])

  useEffect(() => {
    const notice = coverJobNotice(trackedJobId, jobs, items)
    if (!notice) return
    if (notice.kind === 'error') toast.error(notice.message)
    else if (notice.kind === 'success') toast.success(notice.message)
    else toast.message(notice.message)
    setTrackedJobId(null)
  }, [trackedJobId, jobs, items])

  useEffect(() => {
    const picked = items.find((t) => t.picked)
    if (picked && !edits.thumbnailId) {
      onEdits({ ...edits, thumbnailId: picked.id })
    }
  }, [items, edits, onEdits])

  const generate = async () => {
    setBusy(true)
    try {
      const data = await clipsFetch<{ jobId?: string; alreadyRunning?: boolean }>(`/api/clips/clips/${clipId}/thumbnail`, {
        method: 'POST',
        body: JSON.stringify({ aspect, titleOverride: titleOverride.trim() || undefined }),
      })
      if (!data?.jobId) throw new Error('Cover job was not created')
      setTrackedJobId(data.jobId)
      toast.message(
        data.alreadyRunning ? 'Covers are already generating (about a minute)' : 'Generating 3 covers (about a minute)…',
      )
      void refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setBusy(false)
    }
  }

  const setCover = async (thumbnailId: string) => {
    try {
      await clipsFetch(`/api/clips/clips/${clipId}/thumbnail/pick`, {
        method: 'POST',
        body: JSON.stringify({ thumbnailId }),
      })
      onEdits({ ...edits, thumbnailId })
      toast.success('Cover updated')
      void refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not set cover')
    }
  }

  const generating = Boolean(trackedJobId || runningJob)

  return (
    <div className="space-y-3 p-3 text-sm">
      <div className="flex gap-2">
        <Button size="sm" variant={aspect === '9:16' ? 'default' : 'outline'} onClick={() => setAspect('9:16')}>9:16</Button>
        <Button size="sm" variant={aspect === '16:9' ? 'default' : 'outline'} onClick={() => setAspect('16:9')}>16:9</Button>
      </div>
      <input
        className="w-full rounded border border-border px-2 py-1 text-xs"
        placeholder="Title override (optional)"
        value={titleOverride}
        onChange={(e) => setTitleOverride(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">About $0.18 (3 × 2K images + vision)</p>
      <Button size="sm" disabled={busy || generating} onClick={() => void generate()} data-testid="cover-generate">
        {busy || generating ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
        {generating ? 'Generating…' : 'Generate'}
      </Button>
      {generating ? (
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite" data-testid="cover-generating">
          Picking frames and rendering 3 covers — about a minute. You can keep editing.
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-2">
        {loading && items.length === 0 ? (
          <>
            <div className="animate-pulse rounded border border-border p-2">
              <div className="mb-2 aspect-video w-full rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>
            <div className="animate-pulse rounded border border-border p-2">
              <div className="mb-2 aspect-video w-full rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          </>
        ) : null}
        {items.map((t) => (
          <div key={t.id} className="rounded border border-border p-2">
            {t.downloadUrl && !imgFailed.has(t.id) ? (
              <img
                key={t.downloadUrl}
                src={t.downloadUrl}
                alt={t.titleText || 'Cover'}
                loading="lazy"
                decoding="async"
                className={coverImageClass(t.aspect)}
                data-testid="cover-img"
                onError={() => {
                  if (!imgRetried.current.has(t.id)) {
                    imgRetried.current.add(t.id)
                    urlCache.current.delete(t.id)
                    void refresh()
                  } else {
                    setImgFailed((prev) => new Set(prev).add(t.id))
                  }
                }}
              />
            ) : t.downloadUrl ? (
              <div className="mb-2 flex h-24 items-center justify-center rounded bg-muted text-xs" data-testid="cover-img-failed">
                Image failed to load
              </div>
            ) : (
              <div className="mb-2 flex h-24 items-center justify-center rounded bg-muted text-xs" title={t.error ?? undefined}>
                {t.status === 'FAILED' ? 'Failed' : t.status === 'READY' ? 'Loading…' : 'Rendering…'}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t.titleText || 'Thumbnail'}</p>
            <div className="mt-2 flex gap-2">
              {t.downloadUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  render={<a href={`/api/clips/thumbnails/${t.id}/download`} />}
                >
                  Download
                </Button>
              )}
              <Button size="sm" variant={edits.thumbnailId === t.id || t.picked ? 'default' : 'secondary'} onClick={() => void setCover(t.id)}>
                Set as cover
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
