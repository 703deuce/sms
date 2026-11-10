'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/app/page-primitives'
import { ProjectStatusBadge } from '@/components/app/status'
import { DurationChip } from '@/components/clips/ui/duration-chip'
import { useSetBreadcrumbTitle } from '@/components/shell/breadcrumb-context'
import { Button } from '@/components/ui/button'
import { EmptyState, Panel } from '@/components/app/page-primitives'
import { ClipGrid, type ClipCardData } from '@/components/clips/clip-grid'
import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import { ProjectPeopleStrip } from '@/components/clips/project-people-strip'
import { ProgressiveClipResults } from '@/components/clips/progressive-clip-results'
import { JobStatus } from '@/components/clips/job-status'
import { ProjectFailedAlert } from '@/components/clips/project-failed-alert'
import { ExportAllDialog } from '@/components/clips/export-all-dialog'
import { ClipResultsToolbar } from '@/components/clips/clip-results-toolbar'
import { ClipTemplateProjectActions } from '@/components/clips/clip-template-project-actions'
import { ProjectClipsNewEditAction } from '@/components/ai-producer-agent/project-clips-new-edit-action'
import { mergeMonotonicProjectPoll } from '@/lib/clips/eta-poll'
import {
  loadProjectClipsWithRetry,
  retryIdempotentRequest,
  ProjectClipListTimeoutError,
} from '@/lib/clips/project-clips-list-retry'
import { clipsFetch, getProjectStatus, listProjectClips, retryProject } from '@/lib/clips-api'
import { describeClipProjectFailure } from '@/lib/clips/project-failure-copy'
import { buildOpenInEditorHref, openInEditorLinkLabel } from '@/lib/clips/project-editor-link'
import type { ClipProjectSettings } from '@/lib/clips/settings'
import { ProjectProducerPanel } from '@/components/clips/producer/project-producer-panel'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { MontageDialog } from '@/components/streamer/montage-dialog'
import { StreamerAgentClipMaker } from '@/components/streamer/streamer-agent-clip-maker'
import { MontageProgress } from '@/components/streamer/montage-progress'
import { Clapperboard, Film, FileText, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ProjectSpeechSelectsPanel } from '@/components/clips/project-speech-selects-panel'
import { defaultEdits } from '@/lib/clips/edits'
import { shouldClientEnrichReadyClips } from '@/lib/clips/project-clips-enrich'
import {
  adaptListProjectClips,
  filterSortUnifiedClips,
  unifiedClipCounts,
  type UnifiedClipSort,
  type UnifiedClipTypeFilter,
} from '../../lib/clips/unified-clip-results'
import { UnifiedResultsToolbar } from './unified-results-toolbar'
import { UnifiedClipProgress } from './unified-clip-progress'

type ProjectStatusPayload = {
  status: string
  error?: string | null
  clipCount?: number
  primaryClipId?: string | null
  clipsReady?: number
  clipsTotal?: number
  etaSec?: number
  stage?: string | null
  progress?: number
}

function clipCountLabel(n: number) {
  return n === 1 ? '1 clip' : `${n} clips`
}

function formatCreatedFallback(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso))
  } catch {
    return ''
  }
}

function ClientCreatedDate({ iso }: { iso: string }) {
  const [text, setText] = useState(() => formatCreatedFallback(iso))
  useEffect(() => {
    try {
      setText(new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso)))
    } catch {
      setText(formatCreatedFallback(iso))
    }
  }, [iso])
  return (
    <time dateTime={iso} className="text-xs" suppressHydrationWarning>
      {text}
    </time>
  )
}

function pageDescription(status: string, error: string | null, clipCount: number) {
  if (status === 'READY' && clipCount === 0) {
    const copy = describeClipProjectFailure({ status, error, clipCount })
    return copy?.message ?? error ?? 'No clips were found for this project.'
  }
  if (status === 'READY') return 'Your clips are ready.'
  if (status === 'FAILED') {
    const copy = describeClipProjectFailure({ status, error, clipCount })
    return copy?.message ?? error ?? 'Processing failed.'
  }
  return 'Processing your source video.'
}

function clipsListErrorMessage(error: unknown) {
  if (error instanceof ProjectClipListTimeoutError) {
    return 'The clips list timed out. Your clips were not changed; retry the list request.'
  }
  return 'The clips list could not be loaded. Your clips were not changed; retry the list request.'
}

export function ProjectClipsView({
  projectId,
  projectTitle,
  initialStatus,
  initialClips,
  initialError,
  fromLink,
  createdAt,
  sourceDurationMs = 0,
  sourceStartMs = 0,
  isStreamer = false,
  initialProgress = 0,
  initialStage = null,
  initialEtaSec = 0,
  exportAspect = '9:16' as ClipProjectSettings['aspectRatio'],
  scriptEditorEnabled = false,
  byoProject = false,
  viewOnFullVideoUrl = null,
  asrLanguage,
  editorProjectId,
  projectHasUpload = false,
  autoAgentClipMode,
  autoAgentClipError,
}: {
  projectId: string
  projectTitle: string
  initialStatus: string
  initialClips?: ClipCardData[] | null
  initialError?: string | null
  fromLink?: boolean
  createdAt?: string
  sourceDurationMs?: number
  sourceStartMs?: number
  isStreamer?: boolean
  initialProgress?: number
  initialStage?: string | null
  initialEtaSec?: number
  exportAspect?: ClipProjectSettings['aspectRatio']
  scriptEditorEnabled?: boolean
  byoProject?: boolean
  viewOnFullVideoUrl?: string | null
  asrLanguage?: ClipProjectSettings['asrLanguage']
  /** Full-video project id for editor link (defaults to route projectId). */
  editorProjectId?: string | null
  /** CL-05: clip cards can open moment in full video when the project has an upload. */
  projectHasUpload?: boolean
  autoAgentClipMode?: 'clip_moment_v1'|'clip_story_v1'|'clip_unified_v1'
  autoAgentClipSeconds?: 30|60|90
  autoAgentClipError?: string
}) {
  useSetBreadcrumbTitle('project', projectTitle)
  const router = useRouter()

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`clips-proj-scroll-${projectId}`)
      if (raw != null) {
        const y = Number(raw)
        sessionStorage.removeItem(`clips-proj-scroll-${projectId}`)
        if (Number.isFinite(y)) requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }))
      }
    } catch {
      /* ignore */
    }
  }, [projectId])

  useEffect(() => {
    if (!shouldClientEnrichReadyClips(initialStatus, initialClips)) return
    const controller = new AbortController()
    void listProjectClips(projectId, 'score', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setClips(data.clips as ClipCardData[])
      })
      .catch(() => {
        /* keep SSR clip list */
      })
    return () => {
      controller.abort()
    }
  }, [initialStatus, initialClips, projectId])

  const readyFromServer =
    (initialStatus === 'READY' && initialClips != null) ||
    (initialStatus === 'FAILED' && initialClips != null && initialClips.length > 0)
  const [status, setStatus] = useState(initialStatus)
  const [clips, setClips] = useState<ClipCardData[]>(initialClips ?? [])
  const clipsRef = useRef<ClipCardData[]>(initialClips ?? [])
  useEffect(() => {
    clipsRef.current = clips
  }, [clips])
  const [clipSort, setClipSort] = useState<UnifiedClipSort>('score')
  const [clipTypeFilter, setClipTypeFilter] = useState<UnifiedClipTypeFilter>('all')
  const unifiedClips = adaptListProjectClips(clips)
  const displayedClips = filterSortUnifiedClips(unifiedClips, { type: clipTypeFilter, sort: clipSort })
  const clipKindCounts = unifiedClipCounts(unifiedClips)
  const [montagePollKey, setMontagePollKey] = useState(0)
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [readyHydrated, setReadyHydrated] = useState(readyFromServer)
  const [listLoading, setListLoading] = useState(
    (initialStatus === 'READY' || initialStatus === 'FAILED') && !readyFromServer,
  )
  const [listError, setListError] = useState<string | null>(null)
  const listHydrationAbortRef = useRef<AbortController | null>(null)
  const [progressEtaSec, setProgressEtaSec] = useState(initialEtaSec)
  const [progressStage, setProgressStage] = useState<string | null>(initialStage)
  const [clipsReady, setClipsReady] = useState(0)
  const [clipsTotal, setClipsTotal] = useState(0)
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(() => new Set())
  const [pollPrimaryClipId, setPollPrimaryClipId] = useState<string | null>(null)

  const refreshClipsList = useCallback(async () => {
    const data = await listProjectClips(projectId, 'score')
    const rows = data.clips as ClipCardData[]
    setClips(rows)
  }, [projectId])

  const thumbnailBackfillRequestedRef = useRef<Set<string>>(new Set())
  const thumbnailBackfillControllersRef = useRef<Set<AbortController>>(new Set())
  useEffect(() => {
    thumbnailBackfillRequestedRef.current.clear()
    return () => {
      for (const controller of thumbnailBackfillControllersRef.current) controller.abort()
      thumbnailBackfillControllersRef.current.clear()
    }
  }, [projectId])

  useEffect(() => {
    if (status !== 'READY' || clips.length === 0) return
    const missing = clips.filter((clip) => !clip.posterUrl && !thumbnailBackfillRequestedRef.current.has(clip.id))
    if (!missing.length) return
    for (const clip of missing) thumbnailBackfillRequestedRef.current.add(clip.id)
    const controller = new AbortController()
    thumbnailBackfillControllersRef.current.add(controller)
    const startedAt = Date.now()
    for (const clip of missing) {
      console.info('[clips:cards] thumbnail backfill begin', { clipId: clip.id })
    }
    void retryIdempotentRequest({
      signal: controller.signal,
      maxAttempts: 3,
      baseDelayMs: 750,
      timeoutMs: 8_000,
      request: (signal) =>
        clipsFetch(`/api/clips/projects/${encodeURIComponent(projectId)}/card-thumbnails`, {
          method: 'POST',
          body: '{}',
          signal,
        }),
    }).then(async () => {
      if (controller.signal.aborted) return
      const data = await listProjectClips(projectId, 'score', { signal: controller.signal })
      if (controller.signal.aborted) return
      const rows = data.clips as ClipCardData[]
      setClips(rows)
      const byId = new Map(rows.map((clip) => [clip.id, clip]))
      for (const clip of missing) {
        const current = byId.get(clip.id)
        console.info('[clips:cards] thumbnail backfill end', {
          clipId: clip.id,
          elapsedMs: Date.now() - startedAt,
          status: current?.posterUrl ? 'ready' : current?.fallbackSourceUrl ? 'source_fallback' : 'queued',
        })
      }
    }).catch((backfillError) => {
      if (controller.signal.aborted) return
      for (const clip of missing) {
        thumbnailBackfillRequestedRef.current.delete(clip.id)
        console.warn('[clips:cards] thumbnail backfill end', {
          clipId: clip.id,
          elapsedMs: Date.now() - startedAt,
          status: 'failed',
          errorName: backfillError instanceof Error ? backfillError.name : 'UnknownError',
        })
      }
    }).finally(() => {
      thumbnailBackfillControllersRef.current.delete(controller)
    })
  }, [clips, projectId, status])
  const retryProcessing = useCallback(() => {
    listHydrationAbortRef.current?.abort()
    setStatus('QUEUED')
    setError(null)
    setListError(null)
    setListLoading(false)
    setClips([])
    setReadyHydrated(false)
    void retryProject(projectId)
      .then(() => toast.success('Processing restarted'))
      .catch((e) => {
        setStatus('FAILED')
        toast.error(e instanceof Error ? e.message : 'Retry failed')
      })
  }, [projectId])

  const replacePollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (replacePollRef.current) clearInterval(replacePollRef.current)
    }
  }, [])

  const onClipHidden = useCallback(
    (clipId: string) => {
      setClips((prev) => prev.filter((c) => c.id !== clipId))
      if (replacePollRef.current) clearInterval(replacePollRef.current)
      let attempts = 0
      const tick = async () => {
        attempts += 1
        try {
          await refreshClipsList()
        } catch {
          if (attempts === 2) {
            toast.error('Could not refresh clips — reload the page if your replacement does not appear.')
          }
        }
        if (attempts >= 18) {
          if (replacePollRef.current) clearInterval(replacePollRef.current)
          replacePollRef.current = null
        }
      }
      replacePollRef.current = setInterval(() => void tick(), 4000)
      void tick()
    },
    [refreshClipsList],
  )

  const hydrateTerminalClips = useCallback(async (payload: ProjectStatusPayload) => {
    const controller = new AbortController()
    listHydrationAbortRef.current?.abort()
    listHydrationAbortRef.current = controller
    const startedAt = Date.now()
    const loadedCount = clipsRef.current.length
    const expectedCount = payload.clipCount ?? (loadedCount > 0 ? loadedCount : undefined)
    setListLoading(true)
    setListError(null)
    console.info('[clips:list] hydrate_begin', {
      projectId,
      status: payload.status,
      expectedCount: expectedCount ?? null,
      loadedCount,
    })
    try {
      const result = await loadProjectClipsWithRetry<ClipCardData>({
        signal: controller.signal,
        expectedCount,
        maxAttempts: 4,
        baseDelayMs: 500,
        timeoutMs: 8_000,
        load: async (signal) => {
          const data = await listProjectClips(projectId, 'score', { signal })
          return data.clips as ClipCardData[]
        },
      })
      if (controller.signal.aborted) return
      setStatus(payload.status)
      setError(payload.error ?? null)
      if (result.expectedMissing) {
        setListError('The project reports saved clips, but the list is still catching up. Retry the clips list.')
        console.warn('[clips:list] hydrate_expected_missing', {
          projectId,
          status: payload.status,
          expectedCount: expectedCount ?? null,
          loadedCount,
          attempts: result.attempts,
          elapsedMs: Date.now() - startedAt,
        })
        return
      }
      setClips(result.rows)
      setReadyHydrated(true)
      console.info('[clips:list] hydrate_end', {
        projectId,
        status: payload.status,
        rows: result.rows.length,
        attempts: result.attempts,
        elapsedMs: Date.now() - startedAt,
      })
    } catch (hydrateError) {
      if (controller.signal.aborted) return
      setStatus(payload.status)
      setError(payload.error ?? null)
      setListError(clipsListErrorMessage(hydrateError))
      console.warn('[clips:list] hydrate_failed', {
        projectId,
        status: payload.status,
        errorName: hydrateError instanceof Error ? hydrateError.name : 'UnknownError',
        elapsedMs: Date.now() - startedAt,
      })
    } finally {
      if (listHydrationAbortRef.current === controller) {
        listHydrationAbortRef.current = null
        setListLoading(false)
      }
    }
  }, [projectId])

  useEffect(() => {
    return () => {
      listHydrationAbortRef.current?.abort()
      listHydrationAbortRef.current = null
    }
  }, [projectId])

  useEffect(() => {
    if ((initialStatus === 'READY' || initialStatus === 'FAILED') && !readyHydrated) {
      void hydrateTerminalClips({ status: initialStatus, error: initialError })
    }
  }, [initialStatus, initialError, readyHydrated, hydrateTerminalClips])

  const onByoReadyFromPoll = useCallback(
    (payload: { primaryClipId?: string | null }) => {
      if (payload.primaryClipId) setPollPrimaryClipId(payload.primaryClipId)
      void hydrateTerminalClips({ status: 'READY', clipCount: 1 })
    },
    [hydrateTerminalClips],
  )
  const terminalRef = useRef(readyFromServer || ['READY', 'FAILED', 'CANCELED'].includes(initialStatus))
  const pollSnapshotRef = useRef({
    status: initialStatus,
    stage: initialStage,
    progress: initialProgress,
    etaSec: initialEtaSec,
  })

  useEffect(() => {
    if (readyFromServer || initialStatus === 'READY') return
    let stop = false
    let failStreak = 0
    const pollMs = isStreamer ? 2500 : 4000
    const tick = async () => {
      try {
        let data: ProjectStatusPayload
        try {
          data = await getProjectStatus(projectId)
        } catch (pollErr) {
          if (!stop && !terminalRef.current) {
            if (failStreak === 0) {
              console.warn('[clipper:poll] project status failed', pollErr)
            }
            failStreak += 1
            const backoff = Math.min(pollMs * 2 ** Math.min(failStreak, 4), 30_000)
            setTimeout(tick, backoff)
          }
          return
        }
        failStreak = 0
        if (stop) return
        const merged = mergeMonotonicProjectPoll(pollSnapshotRef.current, {
          status: data.status,
          stage: data.stage ?? null,
          progress: data.progress ?? pollSnapshotRef.current.progress,
          etaSec: typeof data.etaSec === 'number' ? data.etaSec : pollSnapshotRef.current.etaSec,
        })
        pollSnapshotRef.current = merged
        setProgressEtaSec(merged.etaSec)
        setProgressStage(merged.stage)
        if (typeof data.clipsTotal === 'number') setClipsTotal(data.clipsTotal)
        if (typeof data.clipsReady === 'number') setClipsReady(data.clipsReady)
        if (typeof data.primaryClipId === 'string' && data.primaryClipId) {
          setPollPrimaryClipId(data.primaryClipId)
        }
        const liveClipCount = data.clipCount ?? 0
        if (liveClipCount > 0 || (data.clipsReady ?? 0) > 0) {
          try {
            await refreshClipsList()
          } catch {
            /* ignore transient list errors during reframe */
          }
        }
        const next = merged.status
        if (next === 'READY') {
          terminalRef.current = true
          await hydrateTerminalClips(data)
          return
        }
        if (next === 'FAILED') {
          terminalRef.current = true
          if (liveClipCount > 0 || clipsRef.current.length > 0) {
            await hydrateTerminalClips(data)
          } else {
            setStatus(next)
            setError(data.error ?? null)
          }
          return
        }
        if (next === 'CANCELED') {
          terminalRef.current = true
        }
        setStatus(next)
        setError(data.error ?? null)
      } catch {
        /* ignore */
      }
      if (!stop && !terminalRef.current) setTimeout(tick, pollMs)
    }
    tick()
    return () => {
      stop = true
    }
  }, [projectId, hydrateTerminalClips, readyFromServer, initialStatus, isStreamer, refreshClipsList])

  const failureCopy = describeClipProjectFailure({
    status,
    error,
    clipCount: clips.length,
    stage: progressStage,
  })
  const desc =
    listLoading && clips.length === 0
      ? 'Loading your saved clips…'
      : listError && clips.length === 0
        ? listError
        : pageDescription(status, error, clips.length)
  const showResults =
    (status === 'READY' && (readyHydrated || clips.length > 0)) ||
    (status === 'FAILED' && clips.length > 0)
  const processing = !showResults && status !== 'FAILED' && status !== 'CANCELED'
  const showProgressiveClips =
    processing && (clips.length > 0 || clipsTotal > 0 || clipsReady > 0)
  const failedMsg =
    failureCopy?.message ??
    (error?.includes('heavy traffic')
      ? `${error} The upstream model was overloaded (503). Use Retry to re-queue with backoff.`
      : error || 'Something went wrong while processing this project.')

  const processingEditorHref =
    byoProject && !showResults && pollPrimaryClipId
      ? buildOpenInEditorHref({
          routeProjectId: projectId,
          editorProjectId,
          clipId: pollPrimaryClipId,
        })
      : null

  return (
    <ClipperSurfaceErrorBoundary surface="Project clips">
    <>
      <PageHeader
        icon={Film}
        title={projectTitle}
        description={desc}
        actions={
          <>
            {viewOnFullVideoUrl ? (
              <Button
                size="sm"
                variant="outline"
                data-testid="view-on-full-video"
                render={<Link href={viewOnFullVideoUrl} />}
              >
                View on full video
              </Button>
            ) : processingEditorHref ? (
              <Button
                size="sm"
                variant="outline"
                data-testid="open-in-editor-header"
                render={<Link href={processingEditorHref} />}
              >
                {openInEditorLinkLabel(asrLanguage)}
              </Button>
            ) : null}
            {showResults && (
              <ProjectClipsNewEditAction projectId={projectId} clipIds={clips.map((c) => c.id)} />
            )}
            {showResults && scriptEditorEnabled ? (
            <Button
              size="sm"
              data-testid="edit-transcript-project"
              onClick={() => {
                try {
                  sessionStorage.setItem(`clips-proj-scroll-${projectId}`, String(window.scrollY))
                } catch {
                  /* ignore */
                }
              }}
              render={<Link href={`/app/video-editor/${projectId}/script`} />}
            >
              <FileText className="mr-1 size-4" />
              Edit transcript
            </Button>
          ) : showResults && clips[0] ? (
            <Button
              size="sm"
              data-testid="edit-clip-project"
              onClick={() => {
                try {
                  sessionStorage.setItem(`clips-proj-scroll-${projectId}`, String(window.scrollY))
                } catch {
                  /* ignore */
                }
                router.push(`/app/clips/${projectId}/${isStreamer ? 'studio' : 'edit'}/${clips[0].id}`)
              }}
            >
              <FileText className="mr-1 size-4" />
              Edit clip
            </Button>
          ) : null}
          </>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <ProjectStatusBadge status={status} />
            {sourceDurationMs > 0 ? (
              <DurationChip
                ms={sourceDurationMs}
                className="relative rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground"
              />
            ) : null}
            <span>{clipCountLabel(clips.length)}</span>
            {createdAt ? <ClientCreatedDate iso={createdAt} /> : null}
          </div>
        }
      />
      {autoAgentClipError ? <p role="alert" className="mb-3 text-sm text-destructive">AI Agent Clipper could not start: {autoAgentClipError}</p> : null}
      {listError ? (
        <Panel title="Clips list" description={listError}>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={listLoading}
              onClick={() => void hydrateTerminalClips({
                status,
                error,
                clipCount: clipsTotal > 0 ? clipsTotal : clips.length > 0 ? clips.length : undefined,
              })}
            >
              {listLoading ? 'Retrying…' : 'Retry clips list'}
            </Button>
            {clips.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                Loaded clips remain available while the list retries.
              </span>
            ) : null}
          </div>
        </Panel>
      ) : null}
      {(isStreamer || (projectHasUpload && !byoProject)) ? <StreamerAgentClipMaker projectId={projectId} ready={status === 'READY'} videoAvailable={projectHasUpload} sourceKind={isStreamer?'stream':'upload'} sourceStartMs={sourceStartMs} sourceDurationMs={sourceDurationMs} /> : null}
      {status === 'FAILED' && !showResults ? (
        <Panel title="Project" description="This upload could not be processed.">
          <ProjectFailedAlert
            errorMessage={failedMsg}
            retryAction={
              <Button
                size="sm"
                variant="outline"
                onClick={() => retryProcessing()}
              >
                {failureCopy?.retryLabel ?? 'Retry processing'}
              </Button>
            }
          />
        </Panel>
      ) : status === 'FAILED' && showResults ? (
        <Panel title="Export issue" description="Your clips are still here — only a download/export failed.">
          <ProjectFailedAlert
            errorMessage={failedMsg}
            retryAction={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setError(null)
                  setStatus('READY')
                }}
              >
                Dismiss
              </Button>
            }
          />
        </Panel>
      ) : !showResults ? (
        <div className="flex flex-col gap-6">
          {!isStreamer ? (
            <JobStatus
              projectId={projectId}
              initialStatus={status}
              initialProgress={initialProgress}
              initialStage={initialStage}
              initialEtaSec={initialEtaSec}
              fromLink={fromLink}
              byo={byoProject}
              asrLanguage={asrLanguage}
              editorProjectId={editorProjectId}
              onReady={byoProject ? onByoReadyFromPoll : undefined}
            />
          ) : null}
          {showProgressiveClips ? (
            <>
            {!isStreamer && clips.length > 0 ? <ProjectPeopleStrip clips={clips} /> : null}
            <ProgressiveClipResults
              projectId={projectId}
              clips={unifiedClips}
              clipsTotal={clipsTotal}
              clipsReady={clipsReady}
              etaSec={progressEtaSec}
              stage={progressStage}
              onHidden={onClipHidden}
              cardAspect={exportAspect}
              isStreamer={isStreamer}
            />
            </>
          ) : processing ? (
            <UnifiedClipProgress
              clipsReady={clipsReady}
              clipsTotal={clipsTotal}
              etaSec={progressEtaSec}
              stage={progressStage}
            />
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {isStreamer ? <MontageProgress projectId={projectId} pollKey={montagePollKey} /> : null}
          {!isStreamer && clips.length > 0 ? <ProjectPeopleStrip clips={clips} /> : null}
          <Panel
            title={
              clipKindCounts.total === 0
                ? clipCountLabel(clips.length)
                : `${clipKindCounts.total} clip${clipKindCounts.total === 1 ? '' : 's'} · ${clipKindCounts.story} Story · ${clipKindCounts.continuous} Continuous`
            }
            description="Hover a card to preview. Edit opens the clip editor."
            actions={
              clips.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <UnifiedResultsToolbar
                    typeFilter={clipTypeFilter}
                    sort={clipSort}
                    onTypeFilterChange={setClipTypeFilter}
                    onSortChange={setClipSort}
                    storyCount={clipKindCounts.story}
                    continuousCount={clipKindCounts.continuous}
                  />
                  <Sheet>
                    <SheetTrigger render={<Button size="sm" variant="outline" />}>
                      <Sparkles className="mr-1 size-4 text-primary" />
                      AI Producer
                    </SheetTrigger>
                    <SheetContent side="right" className="w-full sm:max-w-[440px] p-0">
                      <SheetHeader className="border-b border-border p-4">
                        <SheetTitle>Project Producer</SheetTitle>
                      </SheetHeader>
                      <div className="h-[calc(100dvh-5rem)]">
                        <ProjectProducerPanel projectId={projectId} />
                      </div>
                    </SheetContent>
                  </Sheet>
                  <ExportAllDialog projectId={projectId} clips={clips} />
                  {!isStreamer ? (
                    <ClipTemplateProjectActions
                      projectId={projectId}
                      onApplied={() => void refreshClipsList()}
                    />
                  ) : null}
                  {isStreamer ? (
                    <MontageDialog
                      projectId={projectId}
                      clips={clips}
                      onQueued={() => setMontagePollKey((k) => k + 1)}
                    />
                  ) : null}
                </div>
              ) : null
            }
          >
            {clips.length === 0 && autoAgentClipMode ? (
              <EmptyState
                icon={Clapperboard}
                title={failureCopy?.title ?? 'No clips to show'}
                description={
                  failureCopy?.message ??
                  'Processing finished, but no Story or Continuous clips were saved. Retry processing to run again. This does not start a second run until you retry.'
                }
                action={
                  <Button size="sm" variant="outline" onClick={() => retryProcessing()}>
                    {failureCopy?.retryLabel ?? 'Retry processing'}
                  </Button>
                }
              />
            ) : clips.length === 0 ? (
              <EmptyState
                icon={Clapperboard}
                title={failureCopy?.title ?? 'No clips found'}
                description={
                  failureCopy?.message ??
                  error ??
                  'Processing finished, but no Story or Continuous clips were saved. Retry processing to run again.'
                }
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => retryProcessing()}
                  >
                    {failureCopy?.retryLabel ?? 'Retry processing'}
                  </Button>
                }
              />
            ) : (
              <>
                {!isStreamer && status === 'READY' ? (
                  <ProjectSpeechSelectsPanel
                    projectId={projectId}
                    editorHref={
                      clips[0]
                        ? `/app/video-editor/${editorProjectId ?? projectId}/edit/${clips[0]!.id}?panel=media`
                        : viewOnFullVideoUrl
                          ? `${viewOnFullVideoUrl.split('?')[0]}?panel=media`
                          : null
                    }
                    stubEdits={defaultEdits({
                      clipStartMs: 0,
                      clipEndMs: Math.max(1000, sourceDurationMs || 60_000),
                    })}
                    mediaStub={
                      {
                        items: [],
                        transcripts: [],
                        refresh: async () => {},
                        uploadFile: async () => {
                          throw new Error('upload unavailable')
                        },
                        syncAudio: async () => {},
                      } as import('@/components/clips/editor/use-project-media').ProjectMediaApi
                    }
                  />
                ) : null}
                {!isStreamer ? (
                  <ClipResultsToolbar
                    projectId={projectId}
                    selectedIds={[...selectedClipIds]}
                    exportAspect={exportAspect}
                    onClear={() => setSelectedClipIds(new Set())}
                    onApplied={() => void refreshClipsList()}
                  />
                ) : null}
                {displayedClips.length === 0 ? (
                  <EmptyState
                    icon={Clapperboard}
                    title={clipTypeFilter === 'story' ? 'No Story clips' : 'No Continuous clips'}
                    description="Try the other type, or clear the filter to see every clip from this run."
                  />
                ) : (
                <ClipGrid
                  clips={displayedClips}
                  projectId={projectId}
                  onHidden={onClipHidden}
                  onChanged={() => void refreshClipsList()}
                  isStreamer={isStreamer}
                  cardAspect={exportAspect}
                  projectHasUpload={projectHasUpload}
                  selectedIds={isStreamer ? undefined : selectedClipIds}
                  onToggleSelect={
                    isStreamer
                      ? undefined
                      : (id) => {
                          setSelectedClipIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(id)) next.delete(id)
                            else next.add(id)
                            return next
                          })
                        }
                  }
                />
                )}
              </>
            )}
          </Panel>
        </div>
      )}
    </>
    </ClipperSurfaceErrorBoundary>
  )
}
