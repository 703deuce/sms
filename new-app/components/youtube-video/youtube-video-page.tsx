'use client'

import { useRef, useState } from 'react'
import { parseStreamUrl } from '../../lib/streamer/url'
import {
  YOUTUBE_VIDEO_MAX_SOURCES,
  YOUTUBE_VIDEO_URL_CAP_HOURS,
  type YoutubeVideoSource,
} from '../../lib/youtube-video/contract'
import { statusLabel } from '../../lib/youtube-video/format'
import { uploadFileToProject } from '../../lib/youtube-video/upload-sources'
import { useYoutubeVideo } from './use-youtube-video'
import type { CreateYoutubeVideoControllerOptions } from '../../lib/youtube-video/controller'

type PendingFile = { key: string; file: File }

export function YoutubeVideoPage(opts: CreateYoutubeVideoControllerOptions = {}) {
  const { state, controller } = useYoutubeVideo(opts)
  const [files, setFiles] = useState<PendingFile[]>([])
  const [urlDraft, setUrlDraft] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [urlSources, setUrlSources] = useState<Extract<YoutubeVideoSource, { kind: 'url' }>[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = state.submitLocked || uploading
  const sourceCount = files.length + urlSources.length

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list).filter((f) => f.size > 0)
    setFiles((prev) => {
      const room = YOUTUBE_VIDEO_MAX_SOURCES - urlSources.length - prev.length
      return [...prev, ...incoming.slice(0, Math.max(0, room)).map((file) => ({ key: `${file.name}-${file.size}-${file.lastModified}`, file }))]
    })
    setUploadError(null)
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
    try {
      const uploaded: YoutubeVideoSource[] = []
      for (const item of files) {
        uploaded.push(await uploadFileToProject(item.file))
      }
      const sources = [...uploaded, ...urlSources]
      controller.setSources(sources)
      await controller.submit({ sources, title: state.title })
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const run = state.run
  const showResult = run && run.status === 'done'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8" data-testid="youtube-video-page">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">YouTube Video</h1>
        <p className="text-sm text-muted-foreground">
          Upload one to five videos. We’ll build a single YouTube-ready cut you can download or open in the editor.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">Sources</h2>
          <p className="text-xs text-muted-foreground">
            {sourceCount}/{YOUTUBE_VIDEO_MAX_SOURCES}
          </p>
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/50 px-4 py-8 text-center text-sm text-muted-foreground hover:bg-muted/40">
          <span>Drop videos here, or click to upload</span>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            multiple
            className="sr-only"
            data-testid="youtube-video-upload"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
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
          <span className="text-xs font-medium text-muted-foreground">Title (optional)</span>
          <input
            value={state.title}
            disabled={busy}
            onChange={(e) => controller.setTitle(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            placeholder="Untitled YouTube video"
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
          disabled={busy && !state.submitLocked ? true : sourceCount === 0 && !state.submitLocked}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          onClick={() => void onSubmit()}
        >
          {uploading ? 'Uploading…' : state.submitLocked ? 'Working…' : 'Create video'}
        </button>
        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
      </section>

      {(state.phase === 'polling' || state.phase === 'submitting' || state.phase === 'choosing' || (run && run.status !== 'done' && run.status !== 'failed')) && run && (
        <section className="rounded-xl border border-border bg-card p-4" data-testid="youtube-video-progress">
          <p className="text-sm font-medium">{statusLabel(run.status)}</p>
          <p className="text-sm text-muted-foreground">{run.stage}</p>
          {run.progress != null && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, run.progress))}%` }} />
            </div>
          )}
        </section>
      )}

      {run && run.options.length > 0 && run.status !== 'failed' && !showResult && (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" data-testid="youtube-video-options">
          <h2 className="text-sm font-medium">Choose a cut</h2>
          {state.chooseError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {state.chooseError}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {run.options.map((option) => (
              <li key={option.optionId} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{option.title || option.optionId}</p>
                  {option.beats[0]?.label && (
                    <p className="text-xs text-muted-foreground">{option.beats.map((b) => b.label).filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="h-8 shrink-0 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void controller.choose(option.optionId)}
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

      {showResult && run && (
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4" data-testid="youtube-video-result">
          {state.creditLabel && <p className="text-sm text-muted-foreground">Used · {state.creditLabel}</p>}
          <video
            key={run.playbackUrl}
            className="aspect-video w-full rounded-lg bg-black"
            src={run.playbackUrl}
            poster={run.thumbnailUrl}
            controls
            playsInline
            onError={() => void controller.refetchPlayback()}
            data-testid="youtube-video-player"
          />
          <div className="flex flex-wrap gap-2">
            {run.downloadUrl && (
              <a
                href={run.downloadUrl}
                className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
                data-testid="youtube-video-download"
              >
                Download
              </a>
            )}
            {run.editorUrl && (
              <a
                href={run.editorUrl}
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
  )
}
