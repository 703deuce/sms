'use client'

import { useEffect, useRef, useState } from 'react'
import { Page, PageHeader } from '../app/page-primitives'
import { parseStreamUrl } from '../../lib/streamer/url'
import { YOUTUBE_VIDEO_MAX_SOURCES, YOUTUBE_VIDEO_URL_CAP_HOURS } from '../../lib/youtube-video-ui/paths'
import { statusLabel } from '../../lib/youtube-video-ui/format'
import { uploadFileToProject } from '../../lib/youtube-video-ui/upload-sources'
import type { YoutubeVideoSource } from '../../lib/youtube-video/types'
import { useYoutubeVideo } from './use-youtube-video'
import type { CreateYoutubeVideoControllerOptions } from '../../lib/youtube-video-ui/controller'

type PendingFile = { key: string; file: File }

const VIDEO_FILE_EXT = /\.(?:mp4|mov|m4v|webm|mkv|avi|mpeg|mpg|3gp|ts)$/i

function pendingFileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function acceptsVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || (!file.type && VIDEO_FILE_EXT.test(file.name))
}

export function YoutubeVideoPage(opts: CreateYoutubeVideoControllerOptions = {}) {
  const { state, controller } = useYoutubeVideo(opts)
  const [files, setFiles] = useState<PendingFile[]>([])
  const [urlDraft, setUrlDraft] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [urlSources, setUrlSources] = useState<Extract<YoutubeVideoSource, { kind: 'url' }>[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadedByFileKeyRef = useRef(new Map<string, Extract<YoutubeVideoSource, { kind: 'upload' }>>())
  const busy = state.submitLocked || uploading
  const sourceCount = files.length + urlSources.length

  // Bookmark the run, not source uploads or local-only form state. A reload can
  // resume polling, choice, render and final playback from the durable run id.
  useEffect(() => {
    const runId = new URLSearchParams(window.location.search).get('run')
    if (runId) {
      console.info('[youtube-video:client]', { event: 'url_restore', runId })
      void controller.restoreRun(runId)
    }
  }, [controller])

  useEffect(() => {
    const runId = state.run?.runId
    if (!runId) return
    const url = new URL(window.location.href)
    if (url.searchParams.get('run') === runId) return
    url.searchParams.set('run', runId)
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    console.info('[youtube-video:client]', { event: 'url_run_saved', runId })
  }, [state.run?.runId])

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list)
    const nonEmpty = incoming.filter((file) => file.size > 0)
    const accepted = nonEmpty.filter(acceptsVideoFile)
    const known = new Set(files.map((item) => item.key))
    const unique = accepted.filter((file) => {
      const key = pendingFileKey(file)
      if (known.has(key)) return false
      known.add(key)
      return true
    })
    const room = Math.max(0, YOUTUBE_VIDEO_MAX_SOURCES - urlSources.length - files.length)
    setFiles((prev) => [
      ...prev,
      ...unique.slice(0, room).map((file) => ({ key: pendingFileKey(file), file })),
    ])
    if (incoming.some((file) => file.size <= 0)) {
      setUploadError('Empty video files cannot be uploaded.')
    } else if (nonEmpty.some((file) => !acceptsVideoFile(file))) {
      setUploadError('Choose video files only.')
    } else if (unique.length > room) {
      setUploadError(`You can add up to ${YOUTUBE_VIDEO_MAX_SOURCES} sources.`)
    } else {
      setUploadError(null)
    }
  }

  function openFilePicker() {
    if (busy || sourceCount >= YOUTUBE_VIDEO_MAX_SOURCES) return
    inputRef.current?.click()
  }

  function addUrl() {
    const raw = urlDraft.trim()
    if (!raw) return
    if (files.length + urlSources.length >= YOUTUBE_VIDEO_MAX_SOURCES) {
      setUrlError(`You can add up to ${YOUTUBE_VIDEO_MAX_SOURCES} sources.`)
      return
    }
    const parsed = parseStreamUrl(raw)
    if ('error' in parsed) {
      setUrlError(parsed.error === 'unsupported' ? 'Paste a Twitch or Kick video or clip link.' : parsed.error)
      return
    }
    setUrlSources((prev) => [...prev, { kind: 'url', url: raw }])
    setUrlDraft('')
    setUrlError(null)
  }

  async function onSubmit() {
    if (busy) {
      void controller.submit()
      return
    }
    if (!files.length && !urlSources.length) {
      setUploadError('Add at least one uploaded video.')
      return
    }
    setUploadError(null)
    setUploading(true)
    console.info('[youtube-video:client]', { event: 'upload_begin', sourceCount })
    try {
      const uploaded: YoutubeVideoSource[] = []
      for (const item of files) {
        const cached = uploadedByFileKeyRef.current.get(item.key)
        if (cached) {
          uploaded.push(cached)
          console.info('[youtube-video:client]', {
            event: 'source_upload_reused', sourceIndex: uploaded.length - 1, projectId: cached.projectId,
          })
          continue
        }
        console.info('[youtube-video:client]', { event: 'source_upload_start', sourceIndex: uploaded.length })
        const source = await uploadFileToProject(item.file)
        uploadedByFileKeyRef.current.set(item.key, source)
        uploaded.push(source)
        console.info('[youtube-video:client]', { event: 'source_upload_done', projectId: source.projectId })
      }
      const sources = [...uploaded, ...urlSources]
      if (JSON.stringify(state.sources) !== JSON.stringify(sources)) controller.setSources(sources)
      await controller.submit({ sources, title: state.title })
      console.info('[youtube-video:client]', { event: 'upload_and_submit_complete', sourceCount: sources.length })
    } catch (e) {
      console.error('[youtube-video:client]', { event: 'upload_or_submit_failed',
        errorType: e instanceof Error ? e.name : 'unknown' })
      setUploadError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const run = state.run
  const result = run?.result ?? null
  const showResult = run?.status === 'ready' && result
  const options = run?.options ?? []

  return (
    <Page>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" data-testid="youtube-video-page">
        <PageHeader
          title="Make a YouTube video"
          description="Turn a long recording into one long-form video. Uploads first; Twitch or Kick links use the existing import."
        />

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium">Sources</h2>
            <p className="text-xs text-muted-foreground">
              {sourceCount}/{YOUTUBE_VIDEO_MAX_SOURCES}
            </p>
          </div>
          <button
            type="button"
            data-testid="youtube-video-dropzone"
            disabled={busy || sourceCount >= YOUTUBE_VIDEO_MAX_SOURCES}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/50 px-4 py-8 text-center text-sm text-muted-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={openFilePicker}
            onDragOver={(e) => {
              if (busy) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (busy || !e.dataTransfer.files.length) return
              console.info('[youtube-video:client]', {
                event: 'source_drop', sourceCount: e.dataTransfer.files.length,
              })
              addFiles(e.dataTransfer.files)
            }}
          >
            <span>Drop videos here</span>
            <span className="font-medium text-foreground">Choose videos</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            multiple
            className="sr-only"
            data-testid="youtube-video-upload"
            disabled={busy || sourceCount >= YOUTUBE_VIDEO_MAX_SOURCES}
            onChange={(e) => {
              if (e.currentTarget.files?.length) addFiles(e.currentTarget.files)
              e.currentTarget.value = ''
            }}
          />
          {files.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm" data-testid="youtube-video-file-list">
              {files.map((item, i) => (
                <li key={item.key} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                  <span className="truncate">{item.file.name}</span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    disabled={busy}
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="youtube-video-url" className="text-xs font-medium text-muted-foreground">
              Optional Twitch or Kick link
            </label>
            <div className="flex gap-2">
              <input
                id="youtube-video-url"
                value={urlDraft}
                disabled={busy}
                placeholder="https://www.twitch.tv/videos/…"
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                onChange={(e) => {
                  setUrlDraft(e.target.value)
                  setUrlError(null)
                }}
              />
              <button
                type="button"
                className="h-9 shrink-0 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
                disabled={busy}
                onClick={addUrl}
              >
                Add link
              </button>
            </div>
            <p className="text-xs text-muted-foreground">URL imports are capped at {YOUTUBE_VIDEO_URL_CAP_HOURS} hours.</p>
            {urlError && <p className="text-xs text-destructive">{urlError}</p>}
            {urlSources.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {urlSources.map((s, i) => (
                  <li key={`${s.url}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                    <span className="truncate">{s.url}</span>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground"
                      disabled={busy}
                      onClick={() => setUrlSources((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Instruction (optional)</span>
            <input
              value={state.title}
              disabled={busy}
              onChange={(e) => controller.setTitle(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              placeholder="What should this video be about?"
            />
          </label>
          {state.creditLabel && (
            <p className="text-sm text-muted-foreground" data-testid="youtube-video-credits">
              Estimate · {state.creditLabel}
            </p>
          )}
          <button
            type="button"
            data-testid="youtube-video-submit"
            disabled={sourceCount === 0 && !state.submitLocked}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            onClick={() => void onSubmit()}
          >
            {uploading ? 'Uploading…' : state.submitLocked ? 'Working…' : 'Create video'}
          </button>
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        </section>

        {(state.phase === 'polling' || state.phase === 'submitting' || state.phase === 'choosing' || state.phase === 'reverting') && run && (
          <section className="rounded-xl border border-border bg-card p-4" data-testid="youtube-video-progress">
            <p className="text-sm font-medium">{statusLabel(run.status)}</p>
            {run.stage && <p className="text-sm text-muted-foreground">{run.stage}</p>}
            {run.progressPercent != null && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, run.progressPercent))}%` }} />
              </div>
            )}
          </section>
        )}

        {run && options.length > 1 && run.status === 'awaiting_choice' && (
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" data-testid="youtube-video-options">
            <h2 className="text-sm font-medium">Choose a story</h2>
            {state.chooseError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {state.chooseError}
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {options.map((option) => (
                <li key={option.id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{option.title || option.id}</p>
                    {option.premise ? <p className="text-xs text-muted-foreground">{option.premise}</p> : null}
                    {option.beats[0]?.label && (
                      <p className="text-xs text-muted-foreground">{option.beats.map((b) => b.label).filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="h-8 shrink-0 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    disabled={busy}
                    onClick={() => void controller.choose(option.id)}
                  >
                    Choose
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {state.phase === 'failed' && state.error && (
          <section className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4" role="alert" data-testid="youtube-video-error">
            <p className="text-sm text-destructive">{state.error.message}</p>
            <button
              type="button"
              className="h-9 w-fit rounded-md border border-border bg-background px-3 text-sm font-medium"
              onClick={() => void controller.retry()}
            >
              Retry
            </button>
          </section>
        )}

        {showResult && run && result && (
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4" data-testid="youtube-video-result">
            {state.creditLabel && <p className="text-sm text-muted-foreground">Estimate · {state.creditLabel}</p>}
            <video
              key={result.playbackUrl ?? result.clipId}
              className="aspect-video w-full rounded-lg bg-black"
              src={result.playbackUrl ?? undefined}
              poster={result.thumbnailUrl ?? undefined}
              controls
              playsInline
              preload="metadata"
              onError={() => void controller.refetchPlayback()}
              data-testid="youtube-video-player"
            />
            <section className="space-y-2 rounded-lg border border-border p-3" data-testid="youtube-story-audit">
              <h3 className="text-sm font-semibold">Storyline it kept</h3>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{result.analysisAudit?.premise ?? result.plan.premise}</p>
              {result.analysisAudit?.needsReview && (
                <p className="text-sm font-semibold text-amber-600" role="status">
                  Needs review — the last QA revision did not resolve every issue.
                </p>
              )}
              {result.analysisAudit && (
                <details className="text-sm" open={result.analysisAudit.needsReview}>
                  <summary className="cursor-pointer font-medium">Editorial QA findings</summary>
                  {(result.analysisAudit.globalQaIssueHistory?.length ?? 0) > 0 && (
                    <div className="mt-2 space-y-1">
                      <strong>Global story QA</strong>
                      <ul className="list-disc space-y-1 pl-5">
                        {result.analysisAudit.globalQaIssueHistory?.map((issue, index) => (
                          <li key={index} className="whitespace-pre-wrap">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.analysisAudit.windows.map((window, index) => (
                    <div className="mt-2 space-y-1" key={index}>
                      <strong>Source window {index + 1} ({Math.floor(window.startMs / 60000)}–{Math.ceil(window.endMs / 60000)} min)</strong>
                      <p>{window.qaPassed === true ? 'Passed' : window.qaPassed === false ? 'Needs review' : 'Not assessed'}</p>
                      {(window.qaIssueHistory ?? window.qaIssues ?? []).length > 0 && (
                        <ul className="list-disc space-y-1 pl-5">
                          {(window.qaIssueHistory ?? window.qaIssues ?? []).map((issue, i) => (
                            <li key={i} className="whitespace-pre-wrap">{issue}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </details>
              )}
            </section>
            <div className="flex flex-wrap gap-2">
              {result.downloadUrl && (
                <a
                  href={result.downloadUrl}
                  className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
                  data-testid="youtube-video-download"
                >
                  Download
                </a>
              )}
              {result.editorUrl && (
                <a
                  href={result.editorUrl}
                  className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  data-testid="youtube-video-edit"
                >
                  Edit
                </a>
              )}
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
                data-testid="youtube-video-revert"
                disabled={busy}
                onClick={() => controller.requestRevert()}
              >
                Revert to AI version
              </button>
            </div>
            {state.confirmRevert && (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3" data-testid="youtube-video-revert-confirm">
                <p className="text-sm">Revert this cut to the original AI version? This replaces the current editor edits.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
                    data-testid="youtube-video-revert-confirm-btn"
                    onClick={() => void controller.confirmRevert()}
                  >
                    Revert to AI version
                  </button>
                  <button
                    type="button"
                    className="h-8 rounded-md border border-border px-3 text-xs font-medium"
                    onClick={() => controller.cancelRevert()}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </Page>
  )
}
