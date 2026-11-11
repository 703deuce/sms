'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  ImagePlus,
  Loader2,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import { ExportDialog } from '@/components/clips/editor/export-dialog'
import { useEditorState } from '@/components/clips/editor/use-editor-state'
import { useFilmstripFrames } from '@/components/clips/editor/timeline/use-filmstrip-frames'
import { ReferenceUpload } from '@/components/studio/reference-upload'
import { JobCard } from '@/components/studio/job-card'
import type { EditorClipShell } from '@/components/clips/editor/editor-clip-shell'
import type { LocalAsset } from '@/lib/ai-studio/controller'
import type { StudioJob, StudioModel } from '@/lib/ai-studio/contract'
import { createStudioClient } from '@/lib/ai-studio/client'
import { formatCredits } from '@/lib/ai-studio/format'
import { parseStudioJob, parseStudioRegistry } from '@/lib/ai-studio/parse'
import { loadSourceWords } from '@/lib/clips/source-words'
import { normalizeEditSpeed, orderedKeepSegments, type ClipEditsV2 } from '@/lib/clips/edits'
import { replaceVideoRange, type ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { routes } from '@/lib/routes'
import { editorToolbarRow } from '@/lib/clips/editor/editor-chrome-tokens'
import { EditorModeSwitcher } from '@/components/clips/editor/editor-mode-switcher'
import { StandaloneEditorChrome } from '@/components/clips/editor/standalone-editor-chrome'
import { generatePreviewCandidates, clampGeneratePreviewSeek } from '@/lib/clips/editor/generate-preview-media'

type EditorProps = Parameters<typeof EditorClipShell>[0]
type Props = Pick<
  EditorProps,
  | 'projectId'
  | 'projectTitle'
  | 'clipId'
  | 'initialTitle'
  | 'serverUpdatedAt'
  | 'editsSaveVersion'
  | 'bounds'
  | 'initialEdits'
  | 'words'
  | 'mediaUrls'
  | 'sourceSegStartMs'
  | 'sourceSegEndMs'
  | 'posterUrl'
  | 'facecamLayout'
  | 'reframeV2Enabled'
  | 'aiMeta'
  | 'fullVideo'
> & {
  initialAtMs?: number
  initialRange: { startMs: number; endMs: number } | null
  fromStudio: boolean
}

type CandidateProvenance = { id: string; startMs: number; endMs: number }

const POLL_MS = 2000
const MAX_LOCAL_CANDIDATES = 24

function clock(ms: number): string {
  const sec = Math.floor(Math.max(0, ms) / 1000)
  const hh = Math.floor(sec / 3600)
  const mm = Math.floor(sec / 60) % 60
  const ss = sec % 60
  return (hh ? String(hh).padStart(2, '0') + ':' : '') +
    String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0')
}

function upsertJob(list: StudioJob[], job: StudioJob): StudioJob[] {
  const index = list.findIndex((item) => item.id === job.id)
  if (index < 0) return [job, ...list].slice(0, MAX_LOCAL_CANDIDATES)
  const next = list.slice()
  next[index] = job
  return next
}

function safeOutputRange(
  edits: ClipEditsV2,
  startMs: number,
  endMs: number,
): { startMs: number; endMs: number } | null {
  if (endMs <= startMs) return null
  // Source-time replacements survive cuts and reorder. Display-time mapping through
  // speed or inserted footage needs a dedicated adapter; do not guess it here.
  if (edits.segmentSpeeds?.length || edits.inserts?.length || normalizeEditSpeed(edits.speed)) return null
  let cursor = 0
  let match: { startMs: number; endMs: number } | null = null
  let count = 0
  for (const [start, end] of orderedKeepSegments(edits)) {
    if (startMs >= start && endMs <= end) {
      count += 1
      match = { startMs: cursor + startMs - start, endMs: cursor + endMs - start }
    }
    cursor += end - start
  }
  return count === 1 ? match : null
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.json().catch(() => ({}))
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}
}

async function frameFile(dataUrl: string): Promise<File> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return new File([blob], 'selected-frame.jpg', { type: blob.type || 'image/jpeg' })
}

function candidateRows(raw: unknown): CandidateProvenance[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((row): row is CandidateProvenance =>
      Boolean(
        row &&
        typeof row.id === 'string' &&
        Number.isInteger(row.startMs) &&
        Number.isInteger(row.endMs) &&
        row.endMs > row.startMs,
      ),
    )
    .slice(0, MAX_LOCAL_CANDIDATES)
}

export function GenerateShotEditorShell(props: Props) {
  const { projectId, clipId } = props
  const words = useMemo(() => loadSourceWords(props.words), [props.words])
  const {
    edits,
    setEdits,
    undo,
    redo,
    canUndo,
    canRedo,
    saveState,
    flushSave,
  } = useEditorState(clipId, props.bounds, props.initialEdits, {
    serverUpdatedAt: props.serverUpdatedAt,
    editsSaveVersion: props.editsSaveVersion,
    words,
    editorSaveSeq:
      typeof (props.aiMeta as { __editorSaveSeq?: number } | null)?.__editorSaveSeq === 'number'
        ? (props.aiMeta as { __editorSaveSeq: number }).__editorSaveSeq
        : 0,
  })
  const latestEditsRef = useRef(edits)
  latestEditsRef.current = edits

  // Provider input must be the exact stored source segment. A full project source cannot
  // safely represent an arbitrary shot because Wan Video Edit has no source offset field.
  const source = useMemo(
    () =>
      props.mediaUrls.segment &&
      props.sourceSegStartMs != null &&
      props.sourceSegEndMs != null
        ? {
            url: props.mediaUrls.segment,
            offsetMs: props.sourceSegStartMs,
            startMs: props.sourceSegStartMs,
            endMs: props.sourceSegEndMs,
            kind: 'segment' as const,
          }
        : props.mediaUrls.source
          ? {
              url: props.mediaUrls.source,
              offsetMs: 0,
              startMs: 0,
              endMs: Number.POSITIVE_INFINITY,
              kind: 'source' as const,
            }
          : null,
    [
      props.mediaUrls.source,
      props.mediaUrls.segment,
      props.sourceSegStartMs,
      props.sourceSegEndMs,
    ],
  )

  const minMs = source ? Math.max(source.startMs, edits.trim.in) : edits.trim.in
  const maxMs = source ? Math.min(source.endMs, edits.trim.out) : edits.trim.out
  const [playheadMs, setPlayheadMs] = useState(() =>
    props.initialAtMs !== undefined &&
    props.initialAtMs >= minMs &&
    props.initialAtMs <= maxMs
      ? props.initialAtMs
      : minMs,
  )
  const [inMs, setInMs] = useState<number | null>(() => props.initialRange?.startMs ?? null)
  const [outMs, setOutMs] = useState<number | null>(() => props.initialRange?.endMs ?? null)
  const [instruction, setInstruction] = useState('')
  const [view, setView] = useState<'original' | 'result'>('original')
  const [playing, setPlaying] = useState(false)
  const [mediaFailure, setMediaFailure] = useState(false)
  const [mediaReady, setMediaReady] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const previewCandidates = useMemo(() => generatePreviewCandidates({
    authorizedSegment: source?.kind === 'segment' ? source : null,
    authorizedSource: source?.kind === 'source' ? source : null,
    urls: props.mediaUrls,
    segmentStartMs: props.sourceSegStartMs,
    segmentEndMs: props.sourceSegEndMs,
    clipStartMs: props.bounds.clipStartMs,
    clipEndMs: props.bounds.clipEndMs,
  }), [source, props.mediaUrls, props.sourceSegStartMs, props.sourceSegEndMs, props.bounds.clipStartMs, props.bounds.clipEndMs])
  const preview = previewCandidates[previewIndex] ?? null
  const previewRef = useRef(preview)
  previewRef.current = preview
  const [exportOpen, setExportOpen] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [models, setModels] = useState<StudioModel[]>([])
  const [modelsStatus, setModelsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [modelId, setModelId] = useState('')
  const [resolution, setResolution] = useState('720p')
  const [referenceAsset, setReferenceAsset] = useState<LocalAsset | undefined>()
  const [frameAction, setFrameAction] = useState<'selected' | 'custom' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [jobs, setJobs] = useState<StudioJob[]>([])
  const [provenance, setProvenance] = useState<Record<string, CandidateProvenance>>({})
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [discardedIds, setDiscardedIds] = useState<Set<string>>(() => new Set())
  const [acceptedJobId, setAcceptedJobId] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const handoffRef = useRef(false)
  const studioClientRef = useRef<ReturnType<typeof createStudioClient> | null>(null)
  const objectUrlsRef = useRef<string[]>([])

  const jobStorageKey = useMemo(
    () => 'transovo.generate-mode.jobs.' + projectId + '.' + clipId,
    [projectId, clipId],
  )
  const discardedStorageKey = useMemo(
    () => 'transovo.generate-mode.discarded.' + projectId + '.' + clipId,
    [projectId, clipId],
  )
  const acceptedStorageKey = useMemo(
    () => 'transovo.generate-mode.accepted.' + projectId + '.' + clipId,
    [projectId, clipId],
  )

  const client = useCallback(() => {
    if (!studioClientRef.current) studioClientRef.current = createStudioClient()
    return studioClientRef.current
  }, [])

  const hasRange = inMs !== null && outMs !== null
  const validRange = Boolean(
    source &&
    maxMs > minMs &&
    hasRange &&
    inMs != null &&
    outMs != null &&
    inMs >= minMs &&
    outMs <= maxMs &&
    outMs > inMs,
  )
  const durationMs = validRange && inMs != null && outMs != null ? outMs - inMs : 0
  const durationSec = durationMs > 0 && durationMs % 1000 === 0 ? durationMs / 1000 : null
  const outputRange =
    validRange && inMs != null && outMs != null
      ? safeOutputRange(edits, inMs, outMs)
      : null

  const selectedModel = models.find((model) => model.id === modelId) ?? null
  const sourceConfig = selectedModel?.sourceVideoEdit
  const creditRate = sourceConfig?.creditPerSecondByResolution[resolution] ?? 0
  const creditEstimate = durationSec != null ? Math.round(durationSec * creditRate) : 0
  const minCredits = sourceConfig ? Math.round(sourceConfig.minDurationSec * creditRate) : 0
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null
  const selectedJobRange = selectedJobId ? provenance[selectedJobId] ?? null : null
  const selectedJobSafeRange = selectedJobRange
    ? safeOutputRange(edits, selectedJobRange.startMs, selectedJobRange.endMs)
    : null

  const rangeIssue = !source
    ? 'An authorized original source is not available for this clip; previews and proxies are not substitutes.'
    : maxMs <= minMs
      ? 'The saved trim has no playable overlap with the available original source.'
      : !hasRange
        ? 'Mark both In and Out on the original source before generating.'
        : !validRange
          ? 'Select a positive-duration range entirely inside the available saved source.'
          : !outputRange
            ? 'This range uses speed-altered, inserted, duplicated, or cut footage that cannot be mapped to one safe output span.'
            : null

  const sourceSegmentDurationMs =
    source?.kind === 'segment' ? source.endMs - source.startMs : null
  const providerIssue =
    !validRange || inMs == null || outMs == null
      ? null
      : source?.kind !== 'segment'
        ? 'Wan 2.7 Video Edit needs an exact stored source segment; this clip currently exposes only full-source playback.'
        : sourceSegmentDurationMs == null ||
            sourceSegmentDurationMs < 2000 ||
            sourceSegmentDurationMs > 10000
          ? 'Wan 2.7 Video Edit requires the stored source video itself to be 2 to 10 seconds. This segment needs a server-side range extractor first.'
          : inMs !== source.startMs
            ? 'Wan 2.7 Video Edit cannot offset into a source URL. This range must begin at the available source-segment start.'
            : durationSec == null
              ? 'Wan 2.7 Video Edit requires a whole-second range.'
              : durationSec < 2 || durationSec > 10
                ? 'Wan 2.7 Video Edit accepts source ranges from 2 to 10 seconds.'
                : null

  const modelIssue =
    modelsStatus === 'loading'
      ? 'Loading verified source-video edit models.'
      : modelsStatus === 'error' || !selectedModel
        ? 'No verified source-video edit model is available.'
        : !selectedModel.modes.includes('source_video_edit') || !sourceConfig
          ? 'The selected model is not verified for source-video editing.'
          : null
  const promptIssue =
    instruction.trim().length < 3
      ? 'Describe the change in at least 3 characters.'
      : instruction.trim().length > 5000
        ? 'Wan 2.7 Video Edit prompts are limited to 5000 characters.'
        : null
  const activeSpend = jobs.some((job) => job.status === 'queued' || job.status === 'running')
  const generateBlockedReason =
    rangeIssue ||
    providerIssue ||
    modelIssue ||
    promptIssue ||
    (submitting
      ? 'Submitting this generation.'
      : activeSpend
        ? 'A source-video generation is already in progress.'
        : null)

  // Playback-only fallback: provider authorization always uses `source`, never `preview`.
  useEffect(() => {
    setPreviewIndex(0)
    setPreviewAttempt(0)
    setMediaReady(false)
    setMediaFailure(false)
  }, [source?.url, props.mediaUrls.proxy, props.mediaUrls.preview])

  useEffect(() => {
    if (!source || !preview || mediaReady || mediaFailure) return
    const timeout = window.setTimeout(() => {
      setPreviewIndex((current) => {
        if (current + 1 < previewCandidates.length) return current + 1
        setMediaFailure(true)
        return current
      })
    }, 12000)
    return () => window.clearTimeout(timeout)
  }, [source, preview, previewCandidates.length, previewIndex, previewAttempt, mediaReady, mediaFailure])

  const failPreview = useCallback(() => {
    setMediaReady(false)
    setPlaying(false)
    setPreviewIndex((current) => {
      if (current + 1 < previewCandidates.length) return current + 1
      setMediaFailure(true)
      return current
    })
    console.warn('[editor:generate-mode] preview-fallback', { projectId, clipId, stage: previewIndex + 1 })
  }, [previewCandidates.length, previewIndex, projectId, clipId])

  const mediaFrameMs = source ? Math.max(0, playheadMs - source.offsetMs) : 0
  const frameExtractor = useFilmstripFrames(source?.url)
  useEffect(() => {
    if (!frameExtractor || !source) return
    frameExtractor.want([mediaFrameMs], 250)
  }, [frameExtractor, mediaFrameMs, source])
  const selectedFramePreview = frameExtractor?.get(mediaFrameMs, 250) ?? null

  useEffect(
    () => () => {
      for (const url of objectUrlsRef.current) URL.revokeObjectURL(url)
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    void fetch('/api/studio/models?mode=source_video_edit', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load video edit models')
        return parseStudioRegistry(await response.json())
      })
      .then((registry) => {
        if (cancelled) return
        setModels(registry.models)
        const first = registry.models[0]
        if (first) {
          setModelId(first.id)
          setResolution(first.resolutions.includes('720p') ? '720p' : first.resolutions[0] ?? '')
        }
        setModelsStatus('ready')
        console.info('[editor:generate-mode] models-ready', {
          projectId,
          clipId,
          count: registry.models.length,
        })
      })
      .catch(() => {
        if (cancelled) return
        setModelsStatus('error')
        console.error('[editor:generate-mode] models-failed', { projectId, clipId })
      })
    return () => {
      cancelled = true
    }
  }, [projectId, clipId])

  const rememberCandidates = useCallback(
    (next: CandidateProvenance[]) => {
      try {
        localStorage.setItem(
          jobStorageKey,
          JSON.stringify(next.slice(0, MAX_LOCAL_CANDIDATES)),
        )
      } catch {
        // Private mode: workspace authorization still protects individual job GETs.
      }
    },
    [jobStorageKey],
  )

  const refreshJob = useCallback(
    async (jobId: string) => {
      try {
        const response = await fetch('/api/studio/jobs/' + encodeURIComponent(jobId), {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!response.ok) throw new Error('Could not refresh generation')
        const job = parseStudioJob(await response.json())
        setJobs((prev) => {
          const previous = prev.find((item) => item.id === job.id)
          if (!previous || previous.status !== job.status) {
            console.info('[editor:generate-mode] job-status', {
              projectId,
              clipId,
              jobId: job.id,
              status: job.status,
            })
            if (job.status === 'done') {
              console.info('[editor:generate-mode] result-ready', {
                projectId,
                clipId,
                jobId: job.id,
              })
            }
          }
          return upsertJob(prev, job)
        })
      } catch {
        console.warn('[editor:generate-mode] job-refresh-failed', {
          projectId,
          clipId,
          jobId,
        })
      }
    },
    [projectId, clipId],
  )

  useEffect(() => {
    let cancelled = false
    try {
      const rows = candidateRows(JSON.parse(localStorage.getItem(jobStorageKey) || '[]'))
      setProvenance(Object.fromEntries(rows.map((row) => [row.id, row])))
      console.info('[editor:generate-mode] history-load', {
        projectId,
        clipId,
        count: rows.length,
      })
      void Promise.all(
        rows.map(async (row) => {
          if (!cancelled) await refreshJob(row.id)
        }),
      )
      const discarded = JSON.parse(localStorage.getItem(discardedStorageKey) || '[]')
      if (Array.isArray(discarded)) {
        setDiscardedIds(
          new Set(discarded.filter((id): id is string => typeof id === 'string')),
        )
      }
      const accepted = localStorage.getItem(acceptedStorageKey)
      if (accepted) setAcceptedJobId(accepted)
    } catch {
      console.warn('[editor:generate-mode] history-local-state-unavailable', {
        projectId,
        clipId,
      })
    }
    return () => {
      cancelled = true
    }
  }, [
    jobStorageKey,
    discardedStorageKey,
    acceptedStorageKey,
    projectId,
    clipId,
    refreshJob,
  ])

  const pendingKey = jobs
    .filter((job) => job.status === 'queued' || job.status === 'running')
    .map((job) => job.id)
    .join('|')
  useEffect(() => {
    if (!pendingKey) return
    const ids = pendingKey.split('|').filter(Boolean)
    const timer = window.setInterval(() => {
      for (const id of ids) void refreshJob(id)
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [pendingKey, refreshJob])

  useEffect(() => {
    console.info('[editor:generate-mode] eligibility', {
      projectId,
      clipId,
      hasSource: Boolean(source),
      validRange,
      outputMapped: Boolean(outputRange),
      providerReady: !providerIssue,
      modelId: selectedModel?.id ?? null,
      rangeMs: validRange ? durationMs : null,
    })
  }, [
    projectId,
    clipId,
    source,
    validRange,
    outputRange,
    providerIssue,
    selectedModel?.id,
    durationMs,
  ])

  useEffect(() => {
    console.info('[editor:generate-mode] save-state', {
      projectId,
      clipId,
      state: saveState,
    })
  }, [projectId, clipId, saveState])

  const seek = useCallback(
    (requestedMs: number) => {
      if (!source || maxMs <= minMs) return
      const ms = Math.round(Math.max(minMs, Math.min(maxMs, requestedMs)))
      setPlayheadMs(ms)
      if (videoRef.current) {
        videoRef.current.currentTime = clampGeneratePreviewSeek(ms, previewRef.current, videoRef.current.duration)
      }
      console.info('[editor:generate-mode] seek', {
        projectId,
        clipId,
        sourceMs: ms,
      })
    },
    [source, minMs, maxMs, projectId, clipId],
  )

  const mark = useCallback(
    (edge: 'in' | 'out') => {
      if (!source) return
      const ms = Math.round(Math.max(minMs, Math.min(maxMs, playheadMs)))
      if (edge === 'in') setInMs(ms)
      else setOutMs(ms)
      console.info('[editor:generate-mode] range-mark', {
        projectId,
        clipId,
        edge,
        sourceMs: ms,
      })
    },
    [source, minMs, maxMs, playheadMs, projectId, clipId],
  )

  const clearDraft = useCallback(() => {
    setInMs(null)
    setOutMs(null)
    setInstruction('')
    setReferenceAsset(undefined)
    setFrameAction(null)
    setView('original')
    console.info('[editor:generate-mode] discard-draft', { projectId, clipId })
  }, [projectId, clipId])

  const navigate = useCallback(
    async (href: string, destination: string) => {
      if (handoffRef.current) return
      handoffRef.current = true
      setNavigating(true)
      console.info('[editor:generate-mode] handoff-start', {
        projectId,
        clipId,
        destination,
      })
      try {
        await flushSave()
        console.info('[editor:generate-mode] handoff-saved', {
          projectId,
          clipId,
          destination,
        })
        window.location.assign(href)
      } catch {
        console.error('[editor:generate-mode] handoff-save-failed', {
          projectId,
          clipId,
          destination,
        })
        toast.error('Save edits before switching editors.')
        setNavigating(false)
        handoffRef.current = false
      }
    },
    [flushSave, projectId, clipId],
  )

  const setCustomReference = useCallback(
    (file: File | null) => {
      if (!file) {
        setReferenceAsset(undefined)
        setFrameAction(null)
        console.info('[editor:generate-mode] reference-removed', { projectId, clipId })
        return
      }
      const previewUrl = URL.createObjectURL(file)
      objectUrlsRef.current.push(previewUrl)
      setReferenceAsset({ file, name: file.name, type: file.type, previewUrl })
      setFrameAction('custom')
      console.info('[editor:generate-mode] reference-added', {
        projectId,
        clipId,
        kind: 'custom',
      })
    },
    [projectId, clipId],
  )

  const attachSelectedFrame = useCallback(async () => {
    if (!selectedModel?.supportsReferenceImage) {
      toast.message('The selected model does not support an image reference.')
      return
    }
    if (!selectedFramePreview) {
      frameExtractor?.want([mediaFrameMs], 250)
      toast.message('Preparing the selected frame. Try again when the thumbnail appears.')
      return
    }
    try {
      const file = await frameFile(selectedFramePreview)
      setReferenceAsset({
        file,
        name: file.name,
        type: file.type,
        previewUrl: selectedFramePreview,
      })
      setFrameAction('selected')
      console.info('[editor:generate-mode] reference-added', {
        projectId,
        clipId,
        kind: 'selected-frame',
        sourceMs: playheadMs,
      })
    } catch {
      toast.error('Could not prepare that frame as a reference')
      console.error('[editor:generate-mode] selected-frame-reference-failed', {
        projectId,
        clipId,
      })
    }
  }, [
    selectedModel?.supportsReferenceImage,
    selectedFramePreview,
    frameExtractor,
    mediaFrameMs,
    projectId,
    clipId,
    playheadMs,
  ])

  const persistCandidate = useCallback(
    (job: StudioJob, range: { startMs: number; endMs: number }) => {
      const row: CandidateProvenance = {
        id: job.id,
        startMs: range.startMs,
        endMs: range.endMs,
      }
      setProvenance((prev) => ({ ...prev, [job.id]: row }))
      try {
        const current = candidateRows(
          JSON.parse(localStorage.getItem(jobStorageKey) || '[]'),
        )
        rememberCandidates([row, ...current.filter((item) => item.id !== row.id)])
      } catch {
        rememberCandidates([row])
      }
    },
    [jobStorageKey, rememberCandidates],
  )

  const generate = useCallback(async () => {
    if (
      generateBlockedReason ||
      !selectedModel ||
      !sourceConfig ||
      inMs == null ||
      outMs == null ||
      durationSec == null
    ) {
      if (generateBlockedReason) toast.message(generateBlockedReason)
      return
    }
    setSubmitting(true)
    console.info('[editor:generate-mode] generate-start', {
      projectId,
      clipId,
      modelId: selectedModel.id,
      durationSec,
      credits: creditEstimate,
      hasReference: Boolean(referenceAsset),
    })
    try {
      await flushSave()
      console.info('[editor:generate-mode] generate-source-save-complete', {
        projectId,
        clipId,
      })

      const sourceResponse = await fetch('/api/studio/assets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId, startMs: inMs, endMs: outMs }),
      })
      const sourceBody = await responseJson(sourceResponse)
      if (!sourceResponse.ok || typeof sourceBody.id !== 'string') {
        throw new Error(
          typeof sourceBody.error === 'string'
            ? sourceBody.error
            : 'Could not prepare the exact source range',
        )
      }
      const sourceVideoAssetId = sourceBody.id
      console.info('[editor:generate-mode] source-range-ready', {
        projectId,
        clipId,
        sourceAssetId: sourceVideoAssetId,
        durationSec,
      })

      let referenceAssetId = referenceAsset?.assetId
      if (referenceAsset && !referenceAssetId) {
        const uploaded = await client().uploadAsset(
          referenceAsset.file,
          'reference',
          referenceAsset.name,
        )
        referenceAssetId = uploaded.id
        setReferenceAsset((current) =>
          current ? { ...current, assetId: uploaded.id } : current,
        )
        console.info('[editor:generate-mode] reference-uploaded', {
          projectId,
          clipId,
          assetId: uploaded.id,
        })
      }

      const job = await client().createJob({
        modelId: selectedModel.id,
        mode: 'source_video_edit',
        prompt: instruction.trim(),
        durationSec,
        resolution,
        sourceVideoAssetId,
        ...(referenceAssetId ? { referenceAssetId } : {}),
        projectId,
      })
      persistCandidate(job, { startMs: inMs, endMs: outMs })
      setJobs((prev) => upsertJob(prev, job))
      setSelectedJobId(job.id)
      setView('result')
      console.info('[editor:generate-mode] job-submitted', {
        projectId,
        clipId,
        jobId: job.id,
        status: job.status,
        credits: job.creditEstimate,
      })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Generation could not be started',
      )
      console.error('[editor:generate-mode] generate-failed', {
        projectId,
        clipId,
        reason: 'submission_failed',
      })
    } finally {
      setSubmitting(false)
    }
  }, [
    generateBlockedReason,
    selectedModel,
    sourceConfig,
    inMs,
    outMs,
    durationSec,
    projectId,
    clipId,
    creditEstimate,
    referenceAsset,
    flushSave,
    client,
    instruction,
    resolution,
    persistCandidate,
  ])

  const discardSelected = useCallback(() => {
    if (!selectedJob) return
    const next = new Set(discardedIds)
    next.add(selectedJob.id)
    setDiscardedIds(next)
    try {
      localStorage.setItem(discardedStorageKey, JSON.stringify([...next]))
    } catch {
      // Session-only discard still mutates no clip state.
    }
    setView('original')
    console.info('[editor:generate-mode] discard', {
      projectId,
      clipId,
      jobId: selectedJob.id,
    })
  }, [
    selectedJob,
    discardedIds,
    discardedStorageKey,
    projectId,
    clipId,
  ])

  const acceptSelected = useCallback(async () => {
    const job = selectedJob
    const range = selectedJobRange
    if (
      !job ||
      job.status !== 'done' ||
      !job.output ||
      job.output.kind !== 'video' ||
      !range
    ) return
    if (discardedIds.has(job.id)) {
      toast.message('This candidate was discarded. Generate or select another version.')
      return
    }
    if (!safeOutputRange(latestEditsRef.current, range.startMs, range.endMs)) {
      toast.error('Current speed/insert edits make this candidate unsafe to accept.')
      return
    }

    setAccepting(true)
    console.info('[editor:generate-mode] accept-start', {
      projectId,
      clipId,
      jobId: job.id,
      rangeMs: range.endMs - range.startMs,
    })
    try {
      await flushSave()
      const response = await fetch(
        '/api/studio/jobs/' + encodeURIComponent(job.id) + '/media',
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, clipId }),
        },
      )
      const body = await responseJson(response)
      const item = body.item as ProjectMediaItem | undefined
      const sourceRange = body.sourceRange as { startMs?: unknown; endMs?: unknown } | undefined
      const serverStartMs = Number(sourceRange?.startMs)
      const serverEndMs = Number(sourceRange?.endMs)
      if (
        !response.ok ||
        !item ||
        item.ref !== 'upload' ||
        item.mediaType !== 'video' ||
        !Number.isInteger(serverStartMs) ||
        !Number.isInteger(serverEndMs) ||
        serverEndMs <= serverStartMs
      ) {
        throw new Error(
          typeof body.error === 'string'
            ? body.error
            : 'Could not prepare the generated candidate',
        )
      }

      if (serverStartMs !== range.startMs || serverEndMs !== range.endMs) {
        throw new Error('Candidate source range no longer matches this selected version')
      }
      const expectedMs = serverEndMs - serverStartMs
      if (item.durationMs != null && item.durationMs < expectedMs) {
        throw new Error('Generated candidate is shorter than the selected range')
      }
      const latest = latestEditsRef.current
      if (!safeOutputRange(latest, serverStartMs, serverEndMs)) {
        throw new Error('The clip changed while preparing the candidate. Try Accept again.')
      }
      const replacement = replaceVideoRange(
        latest,
        item,
        serverStartMs,
        serverEndMs,
        () => crypto.randomUUID(),
      )
      if (!replacement.edits) throw new Error(replacement.message)

      // One edit-state mutation = one Undo transaction. replaceVideoRange defaults
      // to main audio, preserving narration/original audio while picture changes.
      setEdits(replacement.edits)
      await flushSave()
      setAcceptedJobId(job.id)
      try {
        localStorage.setItem(acceptedStorageKey, job.id)
      } catch {
        // The accepted sourceSegment itself is persisted in ClipEditsV2.
      }
      console.info('[editor:generate-mode] accept-complete', {
        projectId,
        clipId,
        jobId: job.id,
        rangeMs: expectedMs,
      })
      toast.success('Generated shot accepted. Undo restores the prior footage.')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not accept this candidate',
      )
      console.error('[editor:generate-mode] accept-failed', {
        projectId,
        clipId,
        jobId: job.id,
        reason: 'accept_failed',
      })
    } finally {
      setAccepting(false)
    }
  }, [
    selectedJob,
    selectedJobRange,
    discardedIds,
    projectId,
    clipId,
    flushSave,
    setEdits,
    acceptedStorageKey,
  ])

  const editorHref = props.fromStudio
    ? routes.studio(projectId, clipId)
    : routes.edit(projectId, clipId)
  const canAccept = Boolean(
    selectedJob?.status === 'done' &&
    selectedJob.output?.kind === 'video' &&
    selectedJobRange &&
    selectedJobSafeRange &&
    !discardedIds.has(selectedJob.id) &&
    !accepting,
  )
  const generateTitle = generateBlockedReason
    ? generateBlockedReason
    : formatCredits(creditEstimate) +
      ' for this ' +
      String(durationSec) +
      's range. Minimum ' +
      formatCredits(minCredits) +
      ' at ' +
      resolution +
      '.'

  return (
    <ClipperSurfaceErrorBoundary surface="Change this shot">
      <div
        className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground"
        data-testid="generate-shot-editor"
      >
        <header className={editorToolbarRow + ' relative z-50'}>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Back to clip editor"
            disabled={navigating}
            onClick={() => void navigate(editorHref, 'edit')}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="mr-2 min-w-0">
            <p className="max-w-44 truncate text-[11px] text-muted-foreground">
              {props.projectTitle}
            </p>
            <h1 className="max-w-64 truncate text-sm font-semibold">
              Change this shot · {props.initialTitle}
            </h1>
          </div>
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium">
            Change this shot
          </span>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {saveState === 'saved'
              ? 'Saved'
              : saveState === 'error'
                ? 'Save failed'
                : 'Saving…'}
          </span>
          {saveState === 'error' ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void flushSave().catch(() => toast.error('Save retry failed'))
              }
            >
              Retry save
            </Button>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={!canUndo}
              aria-label="Undo"
              onClick={() => {
                undo()
                console.info('[editor:generate-mode] undo', { projectId, clipId })
              }}
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!canRedo}
              aria-label="Redo"
              onClick={() => {
                redo()
                console.info('[editor:generate-mode] redo', { projectId, clipId })
              }}
            >
              <Redo2 className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setExportOpen(true)
                console.info('[editor:generate-mode] export-open', {
                  projectId,
                  clipId,
                })
              }}
            >
              <Download className="mr-1 size-4" />
              Export
            </Button>
            <EditorModeSwitcher
              current="generate"
              disabled={navigating}
              onSelect={(mode) => {
                console.info('[editor:generate-mode] mode-selected', { projectId, clipId, mode })
                if (mode === 'generate') return
                const query = props.fromStudio ? { from: 'studio' } : undefined
                if (mode === 'clip') { void navigate(editorHref, 'clip'); return }
                if (mode === 'producer') { void navigate(routes.chat(projectId, clipId, query), 'producer'); return }
                if (mode === 'story') { void navigate(routes.story(projectId, clipId, query), 'story'); return }
                if (mode === 'templates') void navigate(routes.templateMode(projectId, clipId, query), 'templates')
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              disabled={navigating}
              onClick={() =>
                void navigate(routes.studio(projectId, clipId), 'studio')
              }
            >
              Studio
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-1 overflow-y-auto bg-background p-1 lg:grid-cols-[240px_minmax(0,1fr)_280px] lg:overflow-hidden">
          <aside
            className="space-y-4 rounded-lg border border-border/70 bg-card p-4 lg:overflow-y-auto"
            aria-label="Original source and range"
          >
            <div>
              <h2 className="text-sm font-semibold">Source</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose the exact shot range. The original is never overwritten.
              </p>
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-muted">
              {props.posterUrl ? (
                <img
                  src={props.posterUrl}
                  alt="Original clip thumbnail"
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center text-xs text-muted-foreground">
                  No thumbnail
                </div>
              )}
            </div>
            <div className="space-y-1 text-xs">
              <p>
                Source:{' '}
                <strong>
                  {source?.kind === 'segment'
                    ? 'Exact source segment'
                    : source?.kind === 'source'
                      ? 'Original upload'
                      : 'Unavailable'}
                </strong>
              </p>
              <p>
                Saved trim: {clock(edits.trim.in)} – {clock(edits.trim.out)}
              </p>
              <p>
                Selected:{' '}
                {validRange && inMs != null && outMs != null
                  ? clock(inMs) +
                    ' – ' +
                    clock(outMs) +
                    ' · ' +
                    clock(durationMs)
                  : 'No valid range'}
              </p>
              <p className="text-muted-foreground">
                Accepted replacements keep the main narration/audio track.
              </p>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="generate-source-playhead"
                className="block text-xs font-medium"
              >
                Source playhead · {clock(playheadMs)}
              </label>
              <input
                id="generate-source-playhead"
                className="w-full accent-primary"
                type="range"
                min={minMs}
                max={Math.max(minMs + 1, maxMs)}
                step={100}
                value={Math.min(maxMs, Math.max(minMs, playheadMs))}
                disabled={!source || maxMs <= minMs}
                onChange={(event) => seek(Number(event.target.value))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!source}
                  onClick={() => mark('in')}
                >
                  Mark In
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!source}
                  onClick={() => mark('out')}
                >
                  Mark Out
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                In: {inMs == null ? 'Not set' : clock(inMs)} · Out:{' '}
                {outMs == null ? 'Not set' : clock(outMs)}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearDraft}
                disabled={!hasRange && !instruction && !referenceAsset}
              >
                Clear draft
              </Button>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold">Reference</p>
              {referenceAsset ? (
                <div className="mt-2 flex items-center gap-2">
                  {referenceAsset.previewUrl ? (
                    <img
                      src={referenceAsset.previewUrl}
                      alt=""
                      className="h-12 w-16 rounded object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs">{referenceAsset.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {frameAction === 'selected'
                        ? 'Selected frame'
                        : 'Custom guide'}
                    </p>
                  </div>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Remove reference"
                    onClick={() => setCustomReference(null)}
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional image guide for clothing, character, object, or style
                  changes.
                </p>
              )}
            </div>
          </aside>

          <main className="flex min-h-[600px] min-w-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-background lg:min-h-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <h2 className="text-sm font-semibold">Shot board</h2>
              <div
                className="flex gap-1"
                role="tablist"
                aria-label="Compare original and generated result"
              >
                <Button
                  size="sm"
                  variant={view === 'original' ? 'default' : 'outline'}
                  role="tab"
                  aria-selected={view === 'original'}
                  onClick={() => {
                    setView('original')
                    console.info('[editor:generate-mode] compare-original', {
                      projectId,
                      clipId,
                    })
                  }}
                >
                  Original
                </Button>
                <Button
                  size="sm"
                  variant={view === 'result' ? 'default' : 'outline'}
                  role="tab"
                  aria-selected={view === 'result'}
                  onClick={() => {
                    setView('result')
                    console.info('[editor:generate-mode] compare-result', {
                      projectId,
                      clipId,
                      jobId: selectedJobId,
                    })
                  }}
                >
                  After
                </Button>
              </div>
            </div>

            <div className="relative flex min-h-[260px] flex-1 items-center justify-center bg-black p-3">
              {view === 'original' && source ? (
                <div className="w-full max-w-4xl">
                  <video
                    ref={videoRef}
                    key={previewIndex + ':' + previewAttempt}
                    src={preview?.url}
                    poster={props.posterUrl || undefined}
                    preload="metadata"
                    controls
                    playsInline
                    className="mx-auto max-h-[48vh] w-full object-contain"
                    onLoadedMetadata={() => {
                      setMediaReady(true)
                      setMediaFailure(false)
                      if (videoRef.current) {
                        videoRef.current.currentTime = clampGeneratePreviewSeek(
                          playheadMs, previewRef.current, videoRef.current.duration,
                        )
                      }
                      console.info('[editor:generate-mode] source-ready', {
                        projectId,
                        clipId,
                      })
                    }}
                    onError={failPreview}
                    onTimeUpdate={(event) =>
                      setPlayheadMs(Math.max(minMs, Math.min(maxMs, Math.round(
                        event.currentTarget.currentTime * 1000 +
                          (previewRef.current?.offsetMs ?? source.offsetMs),
                      ))))
                    }
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                  />
                  {!mediaReady && !mediaFailure ? (
                    <p className="mt-2 text-center text-xs text-white/75">
                      Loading original source…
                    </p>
                  ) : null}
                  {mediaFailure ? (
                    <div role="alert" className="mt-2 flex items-center justify-center gap-2 text-xs text-red-300">
                      <span>Original preview unavailable. No changes were made.</span>
                      <Button type="button" size="sm" variant="outline" onClick={() => {
                        setPreviewIndex(0)
                        setMediaReady(false)
                        setMediaFailure(false)
                        setPreviewAttempt((value) => value + 1)
                        console.info('[editor:generate-mode] preview-retry', { projectId, clipId })
                      }}>Retry preview</Button>
                    </div>
                  ) : null}
                </div>
              ) : view === 'result' && selectedJob ? (
                <div className="w-full max-w-4xl text-center">
                  {selectedJob.status === 'done' &&
                  selectedJob.output?.kind === 'video' ? (
                    <>
                      <video
                        src={selectedJob.output.previewUrl}
                        controls
                        playsInline
                        preload="metadata"
                        className="mx-auto max-h-[48vh] w-full object-contain"
                        onError={() =>
                          console.error(
                            '[editor:generate-mode] result-playback-failed',
                            {
                              projectId,
                              clipId,
                              jobId: selectedJob.id,
                            },
                          )
                        }
                      />
                      <span className="absolute left-4 top-4 rounded-full bg-black/75 px-2 py-1 text-[11px] font-medium text-white">
                        {acceptedJobId === selectedJob.id
                          ? 'Accepted footage'
                          : 'Candidate · not applied'}
                      </span>
                    </>
                  ) : selectedJob.status === 'failed' ? (
                    <div className="mx-auto max-w-md text-sm text-red-300">
                      <AlertCircle className="mx-auto mb-2 size-6" />
                      <p>
                        {selectedJob.error?.message || 'Generation failed'}
                      </p>
                    </div>
                  ) : (
                    <div className="mx-auto max-w-md text-sm text-white/75">
                      <Loader2 className="mx-auto mb-2 size-6 animate-spin" />
                      <p>
                        {selectedJob.status === 'queued'
                          ? 'Queued'
                          : 'Generating candidate…'}
                      </p>
                      <p className="mt-1 text-xs text-white/55">
                        Original footage stays active until you choose Accept.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-md text-center text-sm text-white/75">
                  {view === 'result'
                    ? 'Select or generate a version to preview it. The original clip remains unchanged.'
                    : 'Original source footage is unavailable.'}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-xs">
              <span>
                Source {clock(playheadMs)} ·{' '}
                {hasRange && inMs != null && outMs != null
                  ? clock(inMs) + ' – ' + clock(outMs)
                  : 'Select an In/Out range'}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={!source || view !== 'original'}
                onClick={() => {
                  if (!videoRef.current) return
                  if (videoRef.current.paused) {
                    void videoRef.current
                      .play()
                      .catch(() => setMediaFailure(true))
                  } else {
                    videoRef.current.pause()
                  }
                  console.info('[editor:generate-mode] playback-toggle', {
                    projectId,
                    clipId,
                  })
                }}
              >
                {playing ? (
                  <Pause className="mr-1 size-4" />
                ) : (
                  <Play className="mr-1 size-4" />
                )}
                {playing ? 'Pause' : 'Play'}
              </Button>
            </div>

            <section
              className="space-y-3 p-4"
              aria-label="Source-video edit instruction"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium">
                  @Video
                </span>
                <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                  {validRange && inMs != null && outMs != null
                    ? clock(inMs) + '–' + clock(outMs)
                    : 'Range required'}
                </span>
                {referenceAsset ? (
                  <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium">
                    @Reference · {referenceAsset.name}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  size="sm"
                  variant={frameAction === 'selected' ? 'secondary' : 'outline'}
                  onClick={() => void attachSelectedFrame()}
                  disabled={!source || !selectedModel?.supportsReferenceImage}
                >
                  <ImagePlus className="mr-1 size-4" />
                  Edit selected frame
                </Button>
                <Button
                  size="sm"
                  variant={frameAction === 'custom' ? 'secondary' : 'outline'}
                  onClick={() => setFrameAction('custom')}
                  disabled={!selectedModel?.supportsReferenceImage}
                >
                  <Plus className="mr-1 size-4" />
                  Add custom frame
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                This provider exposes one optional reference image. The selected
                strip frame or custom image is sent as that reference; no
                unsupported strength, keyframe, Draft, or Modify control is
                simulated.
              </p>

              {frameAction === 'custom' &&
              selectedModel?.supportsReferenceImage ? (
                <div className="max-w-sm">
                  <ReferenceUpload
                    slot="reference"
                    asset={referenceAsset}
                    onChange={setCustomReference}
                    disabled={submitting}
                  />
                </div>
              ) : frameAction === 'selected' &&
                referenceAsset?.previewUrl ? (
                <div className="flex max-w-sm items-center gap-3 rounded-lg border border-border p-2">
                  <img
                    src={referenceAsset.previewUrl}
                    alt="Selected frame reference"
                    className="h-16 w-24 rounded object-cover"
                  />
                  <div>
                    <p className="text-xs font-medium">
                      Selected frame reference
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Captured from {clock(playheadMs)} for optional visual
                      guidance.
                    </p>
                  </div>
                </div>
              ) : null}

              <label
                className="block text-xs font-semibold"
                htmlFor="generate-shot-prompt"
              >
                Describe your changes…
              </label>
              <textarea
                id="generate-shot-prompt"
                aria-label="Change this shot instruction"
                value={instruction}
                rows={3}
                onChange={(event) => setInstruction(event.target.value)}
                maxLength={5000}
                placeholder="Change the jacket to a blue coat while preserving the person's motion and the camera movement."
                className="w-full resize-y rounded-lg border border-input bg-background p-3 text-sm"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs">
                  <span className="font-medium">Verified model</span>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2"
                    value={modelId}
                    onChange={(event) => {
                      setModelId(event.target.value)
                      console.info('[editor:generate-mode] model-selected', {
                        projectId,
                        clipId,
                        modelId: event.target.value,
                      })
                    }}
                    disabled={modelsStatus !== 'ready' || models.length === 0}
                  >
                    {models.length === 0 ? (
                      <option value="">No verified model</option>
                    ) : null}
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs">
                  <span className="font-medium">Resolution</span>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2"
                    value={resolution}
                    onChange={(event) => setResolution(event.target.value)}
                    disabled={!selectedModel}
                  >
                    {(selectedModel?.resolutions ?? []).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {selectedModel && sourceConfig ? (
                    <>
                      <span>{selectedModel.label}</span>
                      <span>
                        {' '}
                        · {sourceConfig.minDurationSec}–
                        {sourceConfig.maxDurationSec}s
                      </span>
                      <span>
                        {' '}
                        ·{' '}
                        {creditRate
                          ? String(creditRate) +
                            ' credits/s at ' +
                            resolution
                          : 'price unavailable'}
                      </span>
                      {durationSec != null && creditRate ? (
                        <span>
                          {' '}
                          · this range {formatCredits(creditEstimate)}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span>
                      {modelsStatus === 'loading'
                        ? 'Loading provider capability…'
                        : 'Provider unavailable'}
                    </span>
                  )}
                </div>
                <Button
                  disabled={Boolean(generateBlockedReason)}
                  title={generateTitle}
                  onClick={() => void generate()}
                >
                  {submitting ? (
                    <Loader2 className="mr-1 size-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 size-4" />
                  )}
                  Generate video
                  {creditEstimate > 0
                    ? ' · ' + formatCredits(creditEstimate)
                    : ''}
                </Button>
              </div>
              {generateBlockedReason ? (
                <p
                  role="status"
                  className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{generateBlockedReason}</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Generate creates a non-destructive candidate. No clip edit is
                  written until Accept.
                </p>
              )}
            </section>
          </main>

          <aside
            className="space-y-3 overflow-y-auto rounded-lg border border-border/70 bg-card p-3"
            aria-label="Generation versions"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Versions</h2>
              <span className="text-[11px] text-muted-foreground">
                {jobs.length + 1}
              </span>
            </div>

            <button
              type="button"
              className="w-full overflow-hidden rounded-xl border border-border bg-background text-left"
              onClick={() => {
                setView('original')
                setSelectedJobId(null)
              }}
            >
              <div className="relative aspect-video bg-muted">
                {props.posterUrl ? (
                  <img
                    src={props.posterUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : null}
                <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
                  Original · pinned
                </span>
              </div>
              <div className="p-2.5 text-xs">
                <p className="font-medium">Original footage</p>
                <p className="mt-0.5 text-muted-foreground">
                  Keep original is always available.
                </p>
              </div>
            </button>

            {jobs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Your previews will show up here.
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => {
                  const row = provenance[job.id]
                  const discarded = discardedIds.has(job.id)
                  const accepted = acceptedJobId === job.id
                  return (
                    <div
                      key={job.id}
                      className={
                        'relative rounded-xl ' +
                        (selectedJobId === job.id
                          ? 'ring-2 ring-primary/40 '
                          : '') +
                        (discarded ? 'opacity-60' : '')
                      }
                    >
                      <JobCard
                        job={job}
                        model={models.find(
                          (model) => model.id === job.modelId,
                        )}
                        density="comfortable"
                        onOpen={() => {
                          setSelectedJobId(job.id)
                          setView('result')
                          console.info(
                            '[editor:generate-mode] version-selected',
                            {
                              projectId,
                              clipId,
                              jobId: job.id,
                            },
                          )
                        }}
                      />
                      {accepted || discarded ? (
                        <span className="absolute right-2 top-2 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold shadow">
                          {accepted ? 'Accepted' : 'Discarded'}
                        </span>
                      ) : null}
                      {row ? (
                        <p className="px-2 pb-2 pt-1 text-[10px] text-muted-foreground">
                          {clock(row.startMs)}–{clock(row.endMs)}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="w-full border-dashed"
              onClick={() => {
                setSelectedJobId(null)
                setView('original')
                console.info('[editor:generate-mode] new-version-slot', {
                  projectId,
                  clipId,
                })
              }}
            >
              <Plus className="mr-1 size-4" />
              New version
            </Button>

            {selectedJob ? (
              <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">Selected candidate</p>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {selectedJob.status}
                  </span>
                </div>
                <p className="line-clamp-3 text-xs text-muted-foreground">
                  {selectedJob.prompt}
                </p>
                {selectedJobRange ? (
                  <p className="text-[11px] text-muted-foreground">
                    Range {clock(selectedJobRange.startMs)}–
                    {clock(selectedJobRange.endMs)}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    disabled={!canAccept}
                    onClick={() => void acceptSelected()}
                  >
                    {accepting ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                    ) : (
                      <Check className="mr-1 size-3.5" />
                    )}
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={discardedIds.has(selectedJob.id)}
                    onClick={discardSelected}
                  >
                    <X className="mr-1 size-3.5" />
                    Discard
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setView('original')
                    console.info('[editor:generate-mode] keep-original', {
                      projectId,
                      clipId,
                      jobId: selectedJob.id,
                    })
                  }}
                >
                  Keep original
                </Button>
                {selectedJob.status === 'failed' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={Boolean(generateBlockedReason)}
                    title={generateTitle}
                    onClick={() => void generate()}
                  >
                    <RotateCcw className="mr-1 size-3.5" />
                    Retry
                    {creditEstimate > 0
                      ? ' · ' + formatCredits(creditEstimate)
                      : ''}
                  </Button>
                ) : null}
                {selectedJob.status === 'done' && !selectedJobSafeRange ? (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Current speed/insert edits make this older candidate unsafe
                    to accept. Its result is still previewable.
                  </p>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>

        <footer
          className="shrink-0 border-t border-border px-4 py-2 text-xs text-muted-foreground"
          aria-label="Selected shot and output timeline context"
        >
          Shot context · Original{' '}
          {hasRange && inMs != null && outMs != null
            ? clock(inMs) + ' – ' + clock(outMs)
            : 'range not selected'}
          {' · '}Output{' '}
          {outputRange
            ? clock(outputRange.startMs) + ' – ' + clock(outputRange.endMs)
            : 'not safely mapped'}
          {' · '}Playback {view === 'original' ? 'Original' : 'After'}
          {acceptedJobId
            ? ' · accepted replacement saved'
            : ' · candidate review is non-destructive'}
        </footer>

        <ExportDialog
          clipId={clipId}
          title={props.initialTitle}
          edits={edits}
          words={words}
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          onBeforeExport={flushSave}
          onEdits={setEdits}
          onAspectChange={(aspect) =>
            setEdits({ ...edits, aspectRatio: aspect })
          }
          layoutMode={edits.layout.mode}
          onLayoutModeChange={(mode, facecam) =>
            setEdits({
              ...edits,
              layout: { ...edits.layout, mode, facecam },
            })
          }
          facecamLayout={props.facecamLayout}
          reframeV2Enabled={props.reframeV2Enabled}
          posterUrl={props.posterUrl}
          aiMeta={props.aiMeta}
          fullVideo={props.fullVideo}
        />
      </div>
    </ClipperSurfaceErrorBoundary>
  )
}
