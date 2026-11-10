'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportClip, getClipEditor, getRenderStatus, patchClip } from '@/lib/clips-api'
import { displayDurationMs, type ClipEditsV2 } from '@/lib/clips/edits'
import { formatTimecode } from '@/lib/clips/format'
import {
  CLEAN_TAKE_COPY,
  introOutroLockedRanges,
  omissionsOverlappingLocked,
  omittedRangesFromCleanTakeCuts,
  parseCleanTakeMeta,
  playRemovedOnlyFromOmissions,
  restoreCleanTakeOmission,
  type CleanTakeKeptCut,
  type CleanTakeOmission,
  type CleanTakeSourceExtent,
  type LockedRange,
} from '@/lib/clips/editor/clean-take-review'

type ReviewState = {
  edits: ClipEditsV2
  cuts: CleanTakeKeptCut[]
  sources: CleanTakeSourceExtent[]
  title?: string
  mediaUrl?: string | null
}

export function CleanTakeReviewPanel({
  projectId,
  clipId,
  lockIntroSec = 0,
  lockOutroSec = 0,
}: {
  projectId: string
  clipId: string
  lockIntroSec?: number
  lockOutroSec?: number
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [review, setReview] = useState<ReviewState | null>(null)
  const [showCuts, setShowCuts] = useState(true)
  const [playRemovedOnly, setPlayRemovedOnly] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<{ status: string; url?: string | null; error?: string | null; renderId?: string } | null>(null)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await getClipEditor(clipId)
      const meta = parseCleanTakeMeta({ ...payload, aiMeta: (payload as { aiMeta?: unknown }).aiMeta })
      if (!meta || !meta.cuts.length) {
        setError('The first-pass cut list is not on this project yet. You can still open the editor to review the assembled take.')
        setReview({
          edits: payload.edits,
          cuts: [],
          sources: [],
          title: payload.clip?.title,
          mediaUrl: payload.mediaUrls?.source ?? payload.mediaUrls?.preview ?? null,
        })
        return
      }
      const extents: CleanTakeSourceExtent[] = []
      const seen = new Set<string>()
      for (const cut of meta.cuts) {
        if (seen.has(cut.sourceId)) continue
        seen.add(cut.sourceId)
        const media = payload.edits.sources?.find((source, index) =>
          source.id === cut.sourceId || index === meta.cuts.findIndex((row) => row.sourceId === cut.sourceId),
        )
        extents.push({
          sourceId: cut.sourceId,
          sourceProjectId: cut.sourceProjectId,
          startMs: 0,
          endMs: media?.durationMs ?? Math.max(...meta.cuts.filter((row) => row.sourceId === cut.sourceId).map((row) => row.endMs), 0),
        })
      }
      setReview({
        edits: payload.edits,
        cuts: meta.cuts,
        sources: extents,
        title: meta.title ?? payload.clip?.title,
        mediaUrl: payload.mediaUrls?.source ?? payload.mediaUrls?.preview ?? null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the review')
    } finally {
      setLoading(false)
    }
  }, [clipId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const renderId = exportStatus?.renderId
    if (!renderId || !exportStatus || ['READY', 'FAILED', 'CANCELED'].includes(exportStatus.status)) return
    let active = true
    const timer = window.setInterval(() => {
      void getRenderStatus(renderId).then((row) => {
        if (!active) return
        setExportStatus({
          status: row.status,
          renderId,
          url: row.downloadUrl,
          error: row.error,
        })
      }).catch(() => { /* keep last status */ })
    }, 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [exportStatus?.renderId, exportStatus?.status])

  const lockedRanges: LockedRange[] = useMemo(() => {
    if (!review?.sources.length) return introOutroLockedRanges(0, 0, 0, 0)
    const rows: LockedRange[] = []
    for (const source of review.sources) {
      rows.push(
        ...introOutroLockedRanges(
          source.startMs,
          source.endMs,
          Math.max(0, Math.round(lockIntroSec * 1000)),
          Math.max(0, Math.round(lockOutroSec * 1000)),
          source.sourceId,
        ),
      )
    }
    return rows
  }, [review?.sources, lockIntroSec, lockOutroSec])

  const omissions = useMemo(() => {
    if (!review) return []
    return omittedRangesFromCleanTakeCuts(review.cuts, review.sources)
  }, [review])

  const lockedOmissions = useMemo(
    () => omissionsOverlappingLocked(omissions, lockedRanges),
    [omissions, lockedRanges],
  )

  const previewEdits = useMemo(() => {
    if (!review) return null
    if (!playRemovedOnly) return review.edits
    return playRemovedOnlyFromOmissions(review.edits, omissions, review.cuts)
  }, [playRemovedOnly, review, omissions])

  const durationMs = previewEdits ? displayDurationMs(previewEdits) : 0

  const restoreOne = async (omission: CleanTakeOmission) => {
    if (!review) return
    setRestoringId(omission.id)
    setError('')
    setNotice('')
    const result = restoreCleanTakeOmission(review.edits, omission, review.cuts)
    if (!result.ok) {
      setError(
        result.error === 'source_media_not_on_output'
          ? 'This omitted take cannot be restored yet because its source was not attached to the output project. The kept edit is unchanged.'
          : 'Could not restore that take. The kept edit is unchanged.',
      )
      setRestoringId(null)
      return
    }
    try {
      await patchClip(clipId, { edits: result.edits })
      setReview((current) => current ? { ...current, edits: result.edits } : current)
      setNotice(`Restored ${formatTimecode(omission.endMs - omission.startMs)}. Duration is now ${formatTimecode(displayDurationMs(result.edits))}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore could not be saved. The kept edit was not deleted.')
    } finally {
      setRestoringId(null)
    }
  }

  const restoreLocked = async () => {
    if (!review || !lockedOmissions.length) return
    let edits = review.edits
    for (const omission of lockedOmissions) {
      const result = restoreCleanTakeOmission(edits, omission, review.cuts)
      if (result.ok) edits = result.edits
    }
    try {
      await patchClip(clipId, { edits })
      setReview((current) => current ? { ...current, edits } : current)
      setNotice('Locked intro/outro ranges were restored into the review edit.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore locked ranges')
    }
  }

  const approveAndExport = async () => {
    setExporting(true)
    setError('')
    try {
      const result = await exportClip(clipId, { aspect: '16:9', resolution: '720p' })
      setExportStatus({ status: result.status ?? 'QUEUED', renderId: result.renderId, url: result.downloadUrl })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export could not be started')
    } finally {
      setExporting(false)
    }
  }

  const editorHref = `/app/clips/${projectId}/edit/${clipId}`

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card p-6" data-testid="clean-take-review" aria-busy="true">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading the first-pass review…
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-6" data-testid="clean-take-review">
      <div className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight">{CLEAN_TAKE_COPY.reviewTitle}</h2>
        <p className="text-sm text-muted-foreground">{CLEAN_TAKE_COPY.reviewBody}</p>
        <p className="text-xs text-muted-foreground">{CLEAN_TAKE_COPY.languageNote}</p>
        {review?.title ? <p className="text-sm font-medium">{review.title}</p> : null}
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          Current duration {formatTimecode(durationMs)}
          {playRemovedOnly ? ' · previewing removed ranges only (not saved)' : ''}
        </p>
        {playRemovedOnly && review?.mediaUrl && omissions[0] ? (
          <video
            key={omissions.map((row) => row.id).join('|')}
            className="mt-3 aspect-video w-full rounded-lg bg-panel"
            controls
            src={`${review.mediaUrl}#t=${(omissions[0].startMs / 1000).toFixed(3)},${(omissions[0].endMs / 1000).toFixed(3)}`}
          >
            Play removed only starts at the first omitted range. Open the editor for the full flip-timeline preview.
          </video>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={showCuts ? 'default' : 'outline'}
          aria-pressed={showCuts}
          data-testid="clean-take-show-cuts"
          onClick={() => setShowCuts((value) => !value)}
        >
          Show cuts
        </Button>
        <Button
          type="button"
          size="sm"
          variant={playRemovedOnly ? 'default' : 'outline'}
          aria-pressed={playRemovedOnly}
          data-testid="clean-take-play-removed-only"
          onClick={() => setPlayRemovedOnly((value) => !value)}
        >
          Play removed only
        </Button>
        <Button type="button" size="sm" variant="outline" render={<Link href={editorHref} />}>
          Open in editor
        </Button>
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}

      {lockedOmissions.length ? (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm" data-testid="clean-take-locked-warning">
          <p>
            {lockedOmissions.length} omitted range{lockedOmissions.length === 1 ? '' : 's'} overlap a locked intro or outro.
            The planner may still have dropped them; restore them here so they are not left out.
          </p>
          <Button type="button" size="sm" className="mt-2" onClick={() => void restoreLocked()}>
            Restore locked ranges
          </Button>
        </div>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold">Omitted takes</h3>
        {omissions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground" data-testid="clean-take-omissions-empty">
            No omitted source ranges were found on this first pass. Kept takes are listed below when Show cuts is on.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {omissions.map((omission) => (
              <li
                key={omission.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                data-testid="clean-take-omission"
              >
                <div className="min-w-0">
                  {showCuts ? (
                    <p className="font-mono text-xs tabular-nums text-muted-foreground">
                      {formatTimecode(omission.startMs)}–{formatTimecode(omission.endMs)}
                    </p>
                  ) : null}
                  <p className="text-sm">
                    <span className="font-medium capitalize">{omission.type}</span>
                    {' · '}
                    {omission.reason}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={restoringId === omission.id}
                  onClick={() => void restoreOne(omission)}
                  data-testid="clean-take-restore"
                >
                  {restoringId === omission.id ? 'Restoring…' : 'Restore'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCuts && review?.cuts.length ? (
        <div>
          <h3 className="text-sm font-semibold">Kept takes</h3>
          <ul className="mt-3 space-y-1 text-sm">
            {review.cuts.map((cut, index) => (
              <li key={`${cut.sourceId}-${cut.startMs}-${index}`} className="font-mono text-xs tabular-nums text-muted-foreground">
                {formatTimecode(cut.startMs)}–{formatTimecode(cut.endMs)}
                {cut.reason ? ` · ${cut.reason}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button
          type="button"
          onClick={() => void approveAndExport()}
          disabled={exporting}
          data-testid="clean-take-approve-export"
        >
          {exporting ? 'Starting export…' : CLEAN_TAKE_COPY.exportCta}
        </Button>
        <p className="text-xs text-muted-foreground">
          Export uses the approved edit only. It does not start a new analysis or a paid automatic retry.
        </p>
      </div>
      {exportStatus ? (
        <p className="text-sm">
          Export: <strong className="font-medium">{exportStatus.status}</strong>
          {exportStatus.error ? <span className="text-destructive"> · {exportStatus.error}</span> : null}
          {exportStatus.url ? (
            <a href={exportStatus.url} className="ml-2 font-medium text-primary underline-offset-4 hover:underline">
              Open MP4
            </a>
          ) : null}
        </p>
      ) : null}
    </section>
  )
}
