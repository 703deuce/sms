'use client'

import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { exportClip, getClipEditor, getRenderStatus, patchClip } from '../../lib/clips-api'
import { displayDurationMs, type ClipEditsV2 } from '../../lib/clips/edits'
import { formatTimecode } from '../../lib/clips/format'
import {
  CLEAN_TAKE_COPY,
  CLEAN_TAKE_OMISSION_TYPES,
  CLEAN_TAKE_SHOW_CUTS_DEFAULT,
  PLAY_REMOVED_ONLY_EDGE_PAD_MS,
  introOutroLockedRanges,
  listOmissionsFromSavedEdits,
  omissionsOverlappingLocked,
  parseCleanTakeMeta,
  playRemovedOnlyFromOmissions,
  playRemovedOnlySegments,
  restoreCleanTakeOmission,
  sourceExtentsFromEdits,
  writeCleanTakeReview,
  type CleanTakeKeptCut,
  type CleanTakeOmission,
  type CleanTakeOmissionType,
  type CleanTakeSourceExtent,
  type LockedRange,
  type PlayRemovedOnlySegment,
} from '../../lib/clips/editor/clean-take-review'

type ReviewState = {
  edits: ClipEditsV2
  cuts: CleanTakeKeptCut[]
  sources: CleanTakeSourceExtent[]
  title?: string
  sourceMediaUrls: Record<string, string>
}

const TYPE_LABEL: Record<CleanTakeOmissionType, string> = {
  filler: 'Filler',
  silence: 'Silence',
  retake: 'Retakes',
  manual: 'Manual',
}

function collectSourceMediaUrls(payload: unknown, edits: ClipEditsV2): Record<string, string> {
  const out: Record<string, string> = {}
  if (!payload || typeof payload !== 'object') return out
  const root = payload as Record<string, unknown>
  const bag = root.sourceMediaUrls
  if (bag && typeof bag === 'object') {
    for (const [key, value] of Object.entries(bag as Record<string, unknown>)) {
      if (typeof value === 'string' && value) out[key] = value
    }
  }
  for (const source of edits.sources ?? []) {
    const record = source as { id: string; url?: string; mediaUrl?: string }
    const url = record.url ?? record.mediaUrl
    if (url && !out[source.id]) out[source.id] = url
  }
  return out
}

export function CleanTakeReviewPanel({
  projectId,
  clipId,
  lockIntroSec = 0,
  lockOutroSec = 0,
  lockedRanges: lockedRangesProp,
}: {
  projectId: string
  clipId: string
  lockIntroSec?: number
  lockOutroSec?: number
  lockedRanges?: LockedRange[]
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [review, setReview] = useState<ReviewState | null>(null)
  const [showCuts, setShowCuts] = useState(CLEAN_TAKE_SHOW_CUTS_DEFAULT)
  const [playRemovedOnly, setPlayRemovedOnly] = useState(false)
  const [removedSegmentIndex, setRemovedSegmentIndex] = useState(0)
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
      const extentsFromSources = sourceExtentsFromEdits(payload.edits)
      const extents: CleanTakeSourceExtent[] = []
      const seen = new Set<string>()
      for (const row of extentsFromSources) {
        if (seen.has(row.sourceId) || row.endMs <= row.startMs) continue
        seen.add(row.sourceId)
        extents.push(row)
      }
      if (meta) {
        for (const cut of meta.cuts) {
          if (seen.has(cut.sourceId)) continue
          seen.add(cut.sourceId)
          const media = payload.edits.sources?.find((source, index) =>
            source.id === cut.sourceId || index === meta.cuts.findIndex((row: CleanTakeKeptCut) => row.sourceId === cut.sourceId),
          )
          extents.push({
            sourceId: cut.sourceId,
            sourceProjectId: cut.sourceProjectId,
            startMs: 0,
            endMs: media?.durationMs ?? Math.max(...meta.cuts.filter((row: CleanTakeKeptCut) => row.sourceId === cut.sourceId).map((row: CleanTakeKeptCut) => row.endMs), 0),
          })
        }
      }
      // Remaining omissions come from the saved edits (persisted review list or current kept ranges),
      // not from re-deriving leftover spans off aiMeta.cleanTake.cuts.
      const remaining = listOmissionsFromSavedEdits(payload.edits, extents)
      setReview({
        edits: remaining.length && !((payload.edits as { cleanTakeReview?: unknown }).cleanTakeReview)
          ? writeCleanTakeReview(payload.edits, remaining)
          : payload.edits,
        cuts: meta?.cuts ?? [],
        sources: extents,
        title: meta?.title ?? payload.clip?.title,
        sourceMediaUrls: collectSourceMediaUrls(payload, payload.edits),
      })
      if (!remaining.length && !meta?.cuts.length) {
        setError('The first-pass cut list is not on this project yet. You can still open the editor to review the assembled take.')
      }
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
    if (lockedRangesProp?.length) return lockedRangesProp
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
  }, [lockedRangesProp, review?.sources, lockIntroSec, lockOutroSec])

  const omissions = useMemo(() => {
    if (!review) return []
    return listOmissionsFromSavedEdits(review.edits, review.sources)
  }, [review])

  const lockedOmissions = useMemo(
    () => omissionsOverlappingLocked(omissions, lockedRanges),
    [omissions, lockedRanges],
  )

  const removedSegments: PlayRemovedOnlySegment[] = useMemo(
    () => playRemovedOnlySegments(omissions, review?.sources ?? []),
    [omissions, review?.sources],
  )

  useEffect(() => {
    setRemovedSegmentIndex(0)
  }, [playRemovedOnly, removedSegments])

  const previewEdits = useMemo(() => {
    if (!review) return null
    if (!playRemovedOnly) return review.edits
    return playRemovedOnlyFromOmissions(review.edits, omissions, review.cuts, review.sources)
  }, [playRemovedOnly, review, omissions])

  const durationMs = previewEdits ? displayDurationMs(previewEdits) : 0
  const activeSegment = removedSegments[removedSegmentIndex]
  const activeSegmentUrl = activeSegment ? review?.sourceMediaUrls[activeSegment.sourceId] : undefined

  const persistEdits = async (edits: ClipEditsV2, remaining: CleanTakeOmission[], message: string) => {
    const next = writeCleanTakeReview(edits, remaining)
    await patchClip(clipId, { edits: next })
    setReview((current) => current ? { ...current, edits: next } : current)
    setNotice(message)
  }

  const restoreMany = async (rows: CleanTakeOmission[]) => {
    if (!review || !rows.length) return
    setError('')
    setNotice('')
    let edits = review.edits
    const restored: string[] = []
    for (const omission of rows) {
      setRestoringId(omission.id)
      const result = restoreCleanTakeOmission(edits, omission, review.cuts)
      if (!result.ok) {
        setError(
          result.error === 'source_media_not_on_output'
            ? 'This omitted take cannot be restored yet because its source was not attached to the output project. The kept edit is unchanged.'
            : 'Could not restore that take. The kept edit is unchanged.',
        )
        continue
      }
      edits = result.edits
      restored.push(omission.id)
    }
    setRestoringId(null)
    if (!restored.length) return
    const remaining = listOmissionsFromSavedEdits(edits, review.sources).filter((row) => !restored.includes(row.id))
    try {
      await persistEdits(
        edits,
        remaining,
        `Restored ${restored.length} item${restored.length === 1 ? '' : 's'}. Duration is now ${formatTimecode(displayDurationMs(edits))}.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore could not be saved. The kept edit was not deleted.')
    }
  }

  const restoreOne = async (omission: CleanTakeOmission) => {
    await restoreMany([omission])
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
        {playRemovedOnly ? (
          <div className="mt-3 space-y-2" data-testid="clean-take-play-removed-assembled">
            {activeSegment && activeSegmentUrl ? (
              <video
                key={activeSegment.id}
                className="aspect-video w-full rounded-lg bg-panel"
                controls
                autoPlay
                data-testid="clean-take-play-removed-video"
                src={`${activeSegmentUrl}#t=${(activeSegment.inMs / 1000).toFixed(3)},${(activeSegment.outMs / 1000).toFixed(3)}`}
                onTimeUpdate={(event: SyntheticEvent<HTMLVideoElement>) => {
                  const endSec = activeSegment.outMs / 1000
                  if (event.currentTarget.currentTime >= endSec - 0.05) {
                    if (removedSegmentIndex + 1 < removedSegments.length) {
                      setRemovedSegmentIndex((index: number) => index + 1)
                    } else {
                      event.currentTarget.pause()
                    }
                  }
                }}
              >
                Assembled preview of removed ranges.
              </video>
            ) : (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground" data-testid="clean-take-play-removed-missing-media">
                The assembled removed-only preview is {formatTimecode(removedSegments.length ? removedSegments[removedSegments.length - 1]!.outputEndMs : 0)}
                {' '}long across {removedSegments.length} segment{removedSegments.length === 1 ? '' : 's'}.
                Source media for this segment is not attached here; open the editor to audition the same assembled edit.
              </p>
            )}
            {activeSegment ? (
              <p className="text-xs text-muted-foreground">
                Assembled preview {removedSegmentIndex + 1} of {removedSegments.length}
                {' · '}output {formatTimecode(activeSegment.outputStartMs)}–{formatTimecode(activeSegment.outputEndMs)}
                {' · '}source {activeSegment.sourceId}
                {activeSegment.paddedShort
                  ? ` · short cue padded by ${PLAY_REMOVED_ONLY_EDGE_PAD_MS}ms (not skipped)`
                  : ` · ${PLAY_REMOVED_ONLY_EDGE_PAD_MS}ms edge padding`}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">No removed ranges to preview.</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={showCuts ? 'default' : 'outline'}
          aria-pressed={showCuts}
          data-testid="clean-take-show-cuts"
          onClick={() => setShowCuts((value: boolean) => !value)}
        >
          Show cuts
        </Button>
        <Button
          type="button"
          size="sm"
          variant={playRemovedOnly ? 'default' : 'outline'}
          aria-pressed={playRemovedOnly}
          data-testid="clean-take-play-removed-only"
          onClick={() => setPlayRemovedOnly((value: boolean) => !value)}
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
          <Button type="button" size="sm" className="mt-2" onClick={() => void restoreMany(lockedOmissions)}>
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
          <div className="mt-3 space-y-5">
            {CLEAN_TAKE_OMISSION_TYPES.map((type: CleanTakeOmissionType) => {
              const rows = omissions.filter((row: CleanTakeOmission) => row.type === type)
              if (!rows.length) return null
              return (
                <div key={type} data-testid={`clean-take-omission-group-${type}`}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-medium">{TYPE_LABEL[type]} · {rows.length}</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid={`clean-take-restore-type-${type}`}
                      onClick={() => void restoreMany(rows)}
                    >
                      Restore {TYPE_LABEL[type].toLowerCase()}
                    </Button>
                  </div>
                  <ul className="space-y-2">
                    {rows.map((omission: CleanTakeOmission) => (
                      <li
                        key={omission.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                        data-testid="clean-take-omission"
                        data-omission-type={omission.type}
                      >
                        <div className="min-w-0">
                          {showCuts ? (
                            <p className="font-mono text-xs tabular-nums text-muted-foreground">
                              {formatTimecode(omission.startMs)}–{formatTimecode(omission.endMs)}
                            </p>
                          ) : null}
                          <p className="text-sm">
                            <span className="font-medium">{TYPE_LABEL[omission.type]}</span>
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
                          data-testid={`clean-take-restore-${omission.type}`}
                        >
                          {restoringId === omission.id ? 'Restoring…' : 'Restore'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showCuts && review?.cuts.length ? (
        <div>
          <h3 className="text-sm font-semibold">Kept takes</h3>
          <ul className="mt-3 space-y-1 text-sm">
            {review.cuts.map((cut: CleanTakeKeptCut, index: number) => (
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
