'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Dropzone } from '../clips/dropzone'
import { UploadProgressItem } from '../clips/upload-progress-item'
import { ProjectFailedAlert } from '../clips/project-failed-alert'
import { PrimaryButton } from '../app/primary-button'
import { uploadClipFile, type UploadProgress } from '../../lib/clips/upload'
import {
  aiCaptionsSrtUrl,
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
  type AiCaptionsStatus,
  type AiCaptionsStyle,
  type AiCaptionsStylesData,
} from '../../lib/clips/ai-captions-contract'

type Phase = 'idle' | 'uploading' | 'running' | 'ready' | 'failed'

export function AiCaptionsWorkspace() {
  const router = useRouter()
  const [upload, setUpload] = useState<UploadProgress | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState<AiCaptionsRun | null>(null)
  const [styles, setStyles] = useState<AiCaptionsStyle[]>([])
  const startingRef = useRef(false)
  const stopPoll = useRef(false)

  const startRun = useCallback(async (uploadId: string) => {
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
      setRun({
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
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not start captions'
      setPhase('failed')
      setError(message)
      toast.error(message)
      startingRef.current = false
    }
  }, [])

  const onFile = useCallback((file: File) => {
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
      setUpload(p)
      if (p.state === 'complete' && p.uploadId) {
        void startRun(p.uploadId)
      }
      if (p.state === 'error') {
        setPhase('failed')
        setError(p.error || 'Upload failed')
        if (p.error) toast.error(p.error)
      }
    }).catch((e) => {
      const message = e instanceof Error ? e.message : 'Upload failed'
      setPhase('failed')
      setError(message)
      toast.error(message)
    })
  }, [startRun])

  useEffect(() => {
    if (!run?.runId || phase !== 'running') return
    stopPoll.current = false
    const tick = async () => {
      try {
        const data = await getAiCaptionsRun(run.runId)
        setRun(data)
        if (data.status === 'ready' && data.result) {
          setPhase('ready')
          void listAiCaptionsStyles()
            .then((list: AiCaptionsStylesData) => setStyles(list.styles))
            .catch(() => {})
          return
        }
        if (data.status === 'failed') {
          setPhase('failed')
          setError(data.failureMessage || 'Captions could not be generated. Try another upload.')
          return
        }
        if (!isCaptionsRunInProgress(data.status)) return
      } catch {
        // keep polling through transient status errors
      }
      if (!stopPoll.current) setTimeout(tick, 2000)
    }
    void tick()
    return () => {
      stopPoll.current = true
    }
  }, [phase, run?.runId])

  const status: AiCaptionsStatus = run?.status ?? 'queued'
  const credits = captionsCreditCount(run?.creditEstimate)
  const editorHref = run ? captionsRedirectFromRun(run) : null
  const playbackUrl = run?.result?.playbackUrl ?? null
  const downloadUrl = run?.result?.downloadUrl ?? null
  const srtUrl = run?.runId ? (run.result?.srtUrl || aiCaptionsSrtUrl(run.runId)) : null

  return (
    <div className="flex flex-col gap-6" data-testid="ai-captions-workspace">
      {phase === 'idle' || phase === 'uploading' || (phase === 'failed' && !run) ? (
        <Dropzone onFile={onFile} disabled={phase === 'uploading'} />
      ) : null}

      {upload ? <UploadProgressItem progress={upload} /> : null}

      {run && (phase === 'running' || phase === 'ready') ? (
        <p className="text-sm text-muted-foreground" data-testid="ai-captions-credits">
          {credits} credits. Informational only; this run is not charged.
        </p>
      ) : null}

      {phase === 'running' ? (
        <div
          className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
          data-testid="ai-captions-progress"
          data-status={status}
          role="status"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {captionsProgressLabel(status, run?.stage)}
        </div>
      ) : null}

      {phase === 'ready' && run?.result ? (
        <div className="flex flex-col gap-4" data-testid="ai-captions-result">
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
              <PrimaryButton type="button" data-testid="ai-captions-edit" onClick={() => router.push(editorHref)}>
                Edit
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
                onClick={() => {
                  void startAiCaptionsExport(run.runId)
                    .then((exported: AiCaptionsExportData) => {
                      if (exported.downloadUrl) {
                        setRun((current: AiCaptionsRun | null) =>
                          current?.result
                            ? { ...current, status: exported.status, result: { ...current.result, downloadUrl: exported.downloadUrl } }
                            : current,
                        )
                      }
                    })
                    .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not start download'))
                }}
              >
                Prepare download
              </button>
            )}
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
                Try again
              </PrimaryButton>
            }
          />
        </div>
      ) : null}
    </div>
  )
}
