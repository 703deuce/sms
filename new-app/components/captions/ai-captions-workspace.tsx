'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, FileText, Loader2, RefreshCcw } from 'lucide-react'
import { CaptionsRunHistory } from './captions-run-history'
import { Dropzone } from '../clips/dropzone'
import { UploadProgressItem } from '../clips/upload-progress-item'
import { ProjectFailedAlert } from '../clips/project-failed-alert'
import { PrimaryButton } from '../app/primary-button'
import { uploadClipFile, type UploadProgress } from '../../lib/clips/upload'
import {
  aiCaptionsSrtUrl,
  aiCaptionsVttUrl,
  applyAiCaptionsStyle,
  createAiCaptionsRun,
  getAiCaptionsRun,
  listAiCaptionsStyles,
  startAiCaptionsExport,
} from '../../lib/clips/ai-captions-api'
import {
  AI_CAPTIONS_DEFAULT_STYLE_ID,
  captionsCreditCount,
  captionsEditorHref,
  captionsProgressLabel,
  captionsRedirectFromRun,
  createCaptionsSource,
  isCaptionsRunInProgress,
  type AiCaptionsExportData,
  type AiCaptionsRun,
  type AiCaptionsSource,
  type AiCaptionsStatus,
  type AiCaptionsStyle,
  type AiCaptionsStylesData,
} from '../../lib/clips/ai-captions-contract'

type Phase = 'idle' | 'uploading' | 'running' | 'ready' | 'failed'
type PollConnection = 'connected' | 'reconnecting' | 'stalled'

const steps = ['Upload', 'Prepare video', 'Transcribe', 'Generate captions', 'Edit & export'] as const

function compactDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`
}

function exportTimingText(run: AiCaptionsRun): string | null {
  if (run.status !== 'exporting') return null
  const elapsedMs = run.exportProgress?.elapsedMs
  const etaSeconds = run.exportProgress?.etaSeconds
  const elapsed = typeof elapsedMs === 'number' && Number.isFinite(elapsedMs)
    ? `${compactDuration(elapsedMs / 1000)} elapsed`
    : 'Elapsed time unknown'
  const eta = typeof etaSeconds === 'number' && Number.isFinite(etaSeconds)
    ? `ETA about ${compactDuration(etaSeconds)}`
    : 'ETA estimating…'
  return `${elapsed} · ${eta}`
}

function friendlyError(message: string | null | undefined): string {
  const value = message?.trim() || 'Captions could not be completed.'
  if (/no audio|no speech/i.test(value)) return 'No speech was detected. Try a video that has spoken audio.'
  if (/network|fetch|connection|timeout/i.test(value)) return 'The connection was interrupted. Check your connection and select Retry.'
  if (/export|render/i.test(value)) return 'The video export failed. Select Retry to export again.'
  return value
}


export function AiCaptionsWorkspace() {
  const router = useRouter()
  const [upload, setUpload] = useState<UploadProgress | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState<AiCaptionsRun | null>(null)
  const [styles, setStyles] = useState<AiCaptionsStyle[]>([])
  const [exportPending, setExportPending] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const startingRef = useRef(false)
  const pollGenerationRef = useRef(0)
  const [pollConnection, setPollConnection] = useState<PollConnection>('connected')
  const [pollRetryNonce, setPollRetryNonce] = useState(0)

  useEffect(() => {
    console.info('[ai-captions:ui] styles_load_begin')
    void listAiCaptionsStyles().then((data) => {
      console.info('[ai-captions:ui] styles_load_complete', { count: data.styles.length })
      setStyles(data.styles)
    }).catch((err) => console.warn('[ai-captions:ui] styles_load_failed', err))
  }, [])

  const startFromSource = useCallback(async (source: AiCaptionsSource) => {
    if (startingRef.current) { console.info('[ai-captions:ui] duplicate_start_prevented'); return }
    startingRef.current = true
    console.info('[ai-captions:ui] source_retry_begin', { kind: source.kind })
    setError(null)
    setPhase('running')
    try {
      const created = await createAiCaptionsRun({ clientRequestId: crypto.randomUUID(), source, styleId: AI_CAPTIONS_DEFAULT_STYLE_ID })
      setRun({ runId: created.runId, status: created.status, stage: null, progressPercent: 0,
        failureCode: null, failureMessage: null, creditEstimate: created.creditEstimate,
        styleId: AI_CAPTIONS_DEFAULT_STYLE_ID, projectId: null, result: null, source })
      console.info('[ai-captions:ui] source_retry_created', { runId: created.runId })
      setHistoryVersion((n) => n + 1)
    } catch (err) {
      console.error('[ai-captions:ui] source_retry_failed', err)
      setError(friendlyError(err instanceof Error ? err.message : null))
      setPhase('failed')
    } finally { startingRef.current = false }
  }, [])

  const startExport = useCallback(async (id: string) => {
    console.info('[ai-captions:ui] export_request', { runId: id })
    setError(null)
    setExportPending(true)
    try {
      const exported = await startAiCaptionsExport(id)
      console.info('[ai-captions:ui] export_started', { runId: id, status: exported.status, ready: Boolean(exported.downloadUrl) })
      setRun((current) => current?.runId === id ? {
        ...current, status: exported.status, stage: exported.status === 'ready' ? 'ready' : 'export',
        result: current.result ? { ...current.result, downloadUrl: exported.downloadUrl } : null,
      } : current)
      setPhase(exported.status === 'ready' ? 'ready' : 'running')
      setHistoryVersion((n) => n + 1)
    } catch (err) {
      console.error('[ai-captions:ui] export_failed', err)
      setError(friendlyError(err instanceof Error ? err.message : null))
    } finally { setExportPending(false) }
  }, [])

  const startRun = useCallback(async (uploadId: string) => {
    console.info('[ai-captions:ui] run_start', { uploadId })
    if (startingRef.current) return
    startingRef.current = true
    setError(null)
    setPhase('running')
    try {
      const clientRequestId = crypto.randomUUID()
      const created = await createAiCaptionsRun({
        clientRequestId,
        source: createCaptionsSource({ uploadId }),
        styleId: AI_CAPTIONS_DEFAULT_STYLE_ID,
      })
      console.info('[ai-captions:ui] run_created', { runId: created.runId, status: created.status })
      setRun({
        source: createCaptionsSource({ uploadId }),
        runId: created.runId,
        status: created.status,
        stage: created.status === 'preparing' ? 'prepare' : null,
        progressPercent: null,
        failureCode: null,
        failureMessage: null,
        creditEstimate: created.creditEstimate,
        styleId: AI_CAPTIONS_DEFAULT_STYLE_ID,
        projectId: null,
        result: null,
      })
      setHistoryVersion((n) => n + 1)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not start captions'
      setPhase('failed')
      setError(message)
      toast.error(message)
      startingRef.current = false
    }
  }, [])

  const onFile = useCallback((file: File) => {
    console.info('[ai-captions:ui] upload_begin', { filename: file.name, size: file.size })
    startingRef.current = false
    setError(null)
    setRun(null)
    setPhase('uploading')
    setUpload({
      filename: file.name,
      bytes: file.size,
      loaded: 0,
      percent: 0,
      state: 'uploading',
    })
    void uploadClipFile(file, (p: UploadProgress) => {
      console.info('[ai-captions:ui] upload_progress', { state: p.state, percent: p.percent })
      setUpload(p)
      if (p.state === 'complete' && p.uploadId) {
        console.info('[ai-captions:ui] upload_complete', { uploadId: p.uploadId })
        void startRun(p.uploadId)
      }
      if (p.state === 'error') {
        setPhase('failed')
        setError(friendlyError(p.error))
        if (p.error) toast.error(p.error)
      }
    }).catch((e) => {
      console.error('[ai-captions:ui] upload_failed', e)
      const message = e instanceof Error ? e.message : 'Upload failed'
      setPhase('failed')
      setError(message)
      toast.error(message)
    })
  }, [startRun])

  useEffect(() => {
    if (!run?.runId || phase !== 'running') return
    const runId = run.runId
    const generation = ++pollGenerationRef.current
    const controller = new AbortController()
    let canceled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let consecutiveFailures = 0
    const active = () => !canceled && generation === pollGenerationRef.current && !controller.signal.aborted
    const schedule = () => {
      if (!active()) return
      timer = setTimeout(() => { void tick() }, 2000)
    }
    const tick = async () => {
      try {
        console.info('[ai-captions:ui] poll_request', { runId })
        const data = await getAiCaptionsRun(runId, controller.signal)
        if (!active()) return
        consecutiveFailures = 0
        setPollConnection('connected')
        console.info('[ai-captions:ui] poll_result', { runId, status: data.status, stage: data.stage, progress: data.progressPercent })
        setRun(data)
        if (data.status === 'ready' && data.result) {
          setPhase('ready')
          setHistoryVersion((n) => n + 1)
          void listAiCaptionsStyles()
            .then((list: AiCaptionsStylesData) => { if (active()) setStyles(list.styles) })
            .catch(() => {})
          return
        }
        if (data.status === 'failed') {
          setPhase('failed')
          setError(friendlyError(data.failureMessage))
          setHistoryVersion((n) => n + 1)
          return
        }
        if (!isCaptionsRunInProgress(data.status)) return
      } catch (err) {
        if (!active()) return
        consecutiveFailures += 1
        console.warn('[ai-captions:ui] poll_retry', { runId, attempt: consecutiveFailures })
        if (consecutiveFailures >= 3) {
          setPollConnection('stalled')
          return
        }
        setPollConnection('reconnecting')
      }
      schedule()
    }
    setPollConnection('connected')
    void tick()
    return () => {
      canceled = true
      pollGenerationRef.current += 1
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [phase, run?.runId, pollRetryNonce])

  const status: AiCaptionsStatus = run?.status ?? 'queued'
  const credits = captionsCreditCount(run?.creditEstimate)
  const editorHref = run ? captionsRedirectFromRun(run) : null
  const playbackUrl = run?.result?.playbackUrl ?? null
  const downloadUrl = run?.result?.downloadUrl ?? null
  const srtUrl = run?.runId ? (run.result?.srtUrl || aiCaptionsSrtUrl(run.runId)) : null
  const vttUrl = run?.runId ? aiCaptionsVttUrl(run.runId) : null
  const stepIndex = phase === 'uploading' ? 0 : status === 'ready' || status === 'exporting' ? 4 : status === 'captioning' ? 3 : status === 'transcribing' ? 2 : 1

  return (
    <div className="flex flex-col gap-6" data-testid="ai-captions-workspace">
      {phase === 'idle' || phase === 'uploading' || (phase === 'failed' && !run) ? (
        <Dropzone onFile={onFile} disabled={phase === 'uploading'} />
      ) : null}

      {upload ? <UploadProgressItem progress={upload} /> : null}
      {phase !== 'idle' ? <ol data-testid="ai-captions-stages" aria-label="Caption progress" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {steps.map((label, i) => <li key={label} className="flex items-center gap-1 rounded-md border border-border p-2 text-xs">
          {i < stepIndex ? <Check className="size-3.5 text-primary" aria-hidden /> : <span aria-hidden>{i + 1}.</span>}
          <span className={i === stepIndex ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</span>
        </li>)}
      </ol> : null}

      {run && (phase === 'running' || phase === 'ready') ? (
        <p className="text-sm text-muted-foreground" data-testid="ai-captions-credits">
          {credits} credits. Informational only; this run is not charged.
        </p>
      ) : null}

      {phase === 'running' ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
          data-testid="ai-captions-progress"
          data-status={status}
          role="status"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {captionsProgressLabel(status, run?.stage)}
          {typeof run?.progressPercent === 'number' ? <span className="ml-auto">{run.progressPercent}%</span> : null}
          {run && status === 'exporting' ? (
            <span className="basis-full pl-7 text-xs" data-testid="ai-captions-export-timing">
              {exportTimingText(run)}
            </span>
          ) : null}
          {pollConnection === 'reconnecting' ? (
            <span className="basis-full pl-7 text-xs" data-testid="ai-captions-connection">Connection interrupted. Reconnecting…</span>
          ) : null}
          {pollConnection === 'stalled' ? (
            <span className="basis-full pl-7 text-xs" data-testid="ai-captions-connection">
              Status connection paused after repeated failures.{' '}
              <button
                type="button"
                className="underline"
                data-testid="ai-captions-retry-status"
                onClick={() => {
                  console.info('[ai-captions:ui] poll_retry_clicked', { runId: run?.runId })
                  setPollConnection('reconnecting')
                  setPollRetryNonce((n) => n + 1)
                }}
              >
                Retry status
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      {phase === 'ready' && run?.result ? (
        <div className="flex flex-col gap-4" data-testid="ai-captions-result">
          <p className="text-sm text-muted-foreground">Use Edit captions to preview captions in the compact editor and adjust presets, per-word highlighting, font, color, position, and timing. The exported MP4 burns in your saved edits.</p>
          {playbackUrl ? (
            <video
              className="w-full max-w-xl rounded-lg border border-border bg-black"
              src={playbackUrl}
              poster={run.result.thumbnailUrl ?? undefined}
              controls
              playsInline
            />
          ) : null}
          {styles.length > 0 ? (
            <label className="flex max-w-xl flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Caption style</span>
              <select
                className="h-9 rounded-md border border-border bg-background px-2"
                data-testid="ai-captions-style"
                value={run.result.styleId || AI_CAPTIONS_DEFAULT_STYLE_ID}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  const styleId = e.target.value
                  void applyAiCaptionsStyle(run.runId, styleId)
                    .then((next: AiCaptionsRun) => setRun(next))
                    .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not apply style'))
                }}
              >
                {styles.map((style: AiCaptionsStyle) => (
                  <option key={style.styleId} value={style.styleId}>
                    {style.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {editorHref ? (
              <PrimaryButton type="button" data-testid="ai-captions-edit" onClick={() => { console.info('[ai-captions:ui] editor_open', { runId: run.runId }); router.push(editorHref) }}>
                Edit captions
              </PrimaryButton>
            ) : null}
            {downloadUrl ? (
              <a
                className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium"
                href={downloadUrl}
                data-testid="ai-captions-download"
              >
                Download
              </a>
            ) : (
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium"
                data-testid="ai-captions-export"
                disabled={exportPending}
                onClick={() => void startExport(run.runId)}
              >
                {exportPending ? 'Preparing export…' : 'Export burned-in MP4'}
              </button>
            )}
            {vttUrl ? <a className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-sm" href={vttUrl} data-testid="ai-captions-vtt"><FileText className="size-4" /> Download VTT</a> : null}
            {srtUrl ? (
              <a
                className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium"
                href={srtUrl}
                data-testid="ai-captions-srt"
              >
                Download SRT
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {phase === 'failed' && error ? (
        <div data-testid="ai-captions-error">
          <ProjectFailedAlert
            errorMessage={error}
            retryAction={
              <PrimaryButton
                type="button"
                onClick={() => {
                  console.info('[ai-captions:ui] retry_clicked', { runId: run?.runId, failure: run?.failureCode })
                  if (run?.result && run.failureCode === 'export_failed') { void startExport(run.runId); return }
                  if (run?.source) { setRun(null); void startFromSource(run.source); return }
                  const uploadId = upload?.uploadId
                  if (uploadId) {
                    startingRef.current = false
                    void startRun(uploadId)
                    return
                  }
                  setPhase('idle')
                  setError(null)
                  setUpload(null)
                }}
              >
                <RefreshCcw className="mr-1 inline size-4" /> Retry
              </PrimaryButton>
            }
          />
        </div>
      ) : null}
      {phase === 'ready' && error ? <p role="alert" className="text-sm text-destructive">{error} <button type="button" className="underline" onClick={() => run && void startExport(run.runId)}>Retry export</button></p> : null}
      <CaptionsRunHistory selectedRunId={run?.runId} refreshToken={String(historyVersion)} onSelect={(selected) => {
        console.info('[ai-captions:ui] history_selected', { runId: selected.runId, status: selected.status })
        setRun(selected)
        setError(selected.status === 'failed' ? friendlyError(selected.failureMessage) : null)
        setPhase(selected.status === 'failed' ? 'failed' : selected.status === 'ready' ? 'ready' : 'running')
      }} />
    </div>
  )
}
