'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dropzone } from '@/components/clips/dropzone'
import { UploadProgressItem } from '@/components/clips/upload-progress-item'
import { PrimaryButton } from '@/components/app/primary-button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StreamerTosNote } from '@/components/streamer/tos-note'
import { VodUrlCheckBanner } from '@/components/streamer/vod-saving-alert'
import type { VodAvailabilityView } from '@/lib/streamer/vod-availability'
import { StreamerUsageMeter, type StreamUsageView } from '@/components/streamer/usage-meter'
import { clipsFetch } from '@/lib/clips-api'
import { cancelClipUpload, fetchUploadLimits, uploadClipFile, type UploadProgress } from '@/lib/clips/upload'
import { Loader2 } from 'lucide-react'

const PENDING_UPLOAD_KEY = 'streamer-upload-resume-v1'

type PendingUploadMeta = { uploadId: string; filename: string; bytes: number; lastModified?: number }

function fileMatchesResume(file: File, saved: PendingUploadMeta) {
  if (file.name !== saved.filename) return false
  if (file.size !== saved.bytes) return false
  if (saved.lastModified != null && file.lastModified !== saved.lastModified) return false
  return true
}

export function StreamerImportPanel({ usageInitial }: { usageInitial?: StreamUsageView | null }) {
  const router = useRouter()
  const resumeInputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [attest, setAttest] = useState(false)
  const [preview, setPreview] = useState<{ title?: string; platform: string; kind: string } | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [vodCheck, setVodCheck] = useState<VodAvailabilityView | null>(null)
  const [vodCheckBusy, setVodCheckBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [upload, setUpload] = useState<UploadProgress | null>(null)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingMeta, setPendingMeta] = useState<PendingUploadMeta | null>(null)
  const [maxUploadLabel, setMaxUploadLabel] = useState<string | null>(null)

  useEffect(() => {
    void fetchUploadLimits()
      .then((l) => setMaxUploadLabel(l.effectiveMaxLabel ?? l.maxLabel))
      .catch(() => setMaxUploadLabel(null))
  }, [])

  const persistPending = (meta: PendingUploadMeta) => {
    setPendingMeta(meta)
    localStorage.setItem(PENDING_UPLOAD_KEY, JSON.stringify(meta))
  }

  const clearPending = () => {
    localStorage.removeItem(PENDING_UPLOAD_KEY)
    setPendingMeta(null)
    setPendingFile(null)
    setUploadId(null)
    setUpload(null)
  }

  const startFileUpload = (file: File, resumeUploadId?: string) => {
    setPendingFile(file)
    if (!resumeUploadId) setUploadId(null)
    void uploadClipFile(
      file,
      (p) => {
        setUpload(p)
        if (p.uploadId) {
          setUploadId(p.uploadId)
          if (p.state === 'uploading') {
            persistPending({
              uploadId: p.uploadId,
              filename: p.filename,
              bytes: p.bytes,
              lastModified: file.lastModified,
            })
          }
          if (p.state === 'complete') localStorage.removeItem(PENDING_UPLOAD_KEY)
        }
      },
      resumeUploadId ? { resumeUploadId } : undefined,
    ).catch(() => {
      /* state + message set in uploadClipFile */
    })
  }

  const openResumePicker = () => {
    resumeInputRef.current?.click()
  }

  const onResumeFileChosen = (file: File | undefined) => {
    if (!file) {
      openResumePicker()
      return
    }
    const saved = pendingMeta
    const resumeId = upload?.uploadId || uploadId || saved?.uploadId
    if (saved && !fileMatchesResume(file, saved)) {
      toast.error('Choose the same file (name, size, and modified time must match).')
      return
    }
    startFileUpload(file, resumeId || undefined)
  }

  const cancelInterruptedUpload = async () => {
    const id = upload?.uploadId || uploadId || pendingMeta?.uploadId
    if (id) {
      try {
        await cancelClipUpload(id)
      } catch {
        /* discard locally anyway */
      }
    }
    clearPending()
    toast.message('Upload discarded')
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PENDING_UPLOAD_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as PendingUploadMeta
      void fetch(`/api/clips/uploads/${saved.uploadId}/progress`)
        .then((res) => res.json())
        .then((json: { data?: { received: number; bytes: number; canResume: boolean; status: string } }) => {
          if (!json.data?.canResume || json.data.status !== 'PENDING') {
            if (json.data?.status === 'PENDING') return
            localStorage.removeItem(PENDING_UPLOAD_KEY)
            return
          }
          setPendingMeta(saved)
          setUploadId(saved.uploadId)
          setUpload({
            filename: saved.filename,
            bytes: saved.bytes,
            loaded: json.data.received,
            percent: Math.min(99, Math.round((json.data.received / saved.bytes) * 100)),
            state: 'error',
            error: 'Upload interrupted — choose the same file to resume.',
            uploadId: saved.uploadId,
          })
        })
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const trimmed = url.trim()
    if (trimmed.length < 12) {
      setPreview(null)
      setResolveError(null)
      setVodCheck(null)
      return
    }
    const t = setTimeout(() => {
      void clipsFetch<{ platform: string; kind: string; title?: string }>('/api/streamer/resolve', {
        method: 'POST',
        body: JSON.stringify({ url: trimmed }),
      })
        .then((data) => {
          setPreview({ platform: data.platform, kind: data.kind, title: data.title ?? undefined })
          setResolveError(null)
          setVodCheckBusy(true)
          void clipsFetch<VodAvailabilityView>('/api/streamer/vod-check', {
            method: 'POST',
            body: JSON.stringify({ url: trimmed }),
          })
            .then((v) => setVodCheck(v))
            .catch(() => setVodCheck(null))
            .finally(() => setVodCheckBusy(false))
        })
        .catch((e) => {
          setPreview(null)
          setVodCheck(null)
          setResolveError(e instanceof Error ? e.message : 'Could not parse link')
        })
    }, 400)
    return () => clearTimeout(t)
  }, [url])

  const recheckVod = () => {
    const trimmed = url.trim()
    if (trimmed.length < 12) return
    setVodCheckBusy(true)
    void clipsFetch<VodAvailabilityView>('/api/streamer/vod-check', {
      method: 'POST',
      body: JSON.stringify({ url: trimmed }),
    })
      .then((v) => setVodCheck(v))
      .finally(() => setVodCheckBusy(false))
  }

  const submitUrl = async () => {
    if (!attest) {
      toast.error('Confirm permission to import')
      return
    }
    setSubmitting(true)
    try {
      const data = await clipsFetch<{ projectId: string }>('/api/streamer/imports', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim(), attest: true }),
      })
      router.push(`/app/clips/${data.projectId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setSubmitting(false)
    }
  }

  const submitUpload = async () => {
    if (!uploadId) return
    setSubmitting(true)
    try {
      const data = await clipsFetch<{ projectId: string }>('/api/streamer/imports', {
        method: 'POST',
        body: JSON.stringify({ uploadId, attest: true }),
      })
      router.push(`/app/clips/${data.projectId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setSubmitting(false)
    }
  }

  const showResumeCard = upload?.state === 'error'
  const showDropzone = !upload || upload.state === 'error' ? !showResumeCard : false

  return (
    <div className="flex flex-col gap-4">
      {usageInitial ? null : <StreamerUsageMeter />}
      <p className="text-xs text-muted-foreground">
        Long VODs (over ~20 min): we fetch audio first, then only the clip ranges (up to 12 h).
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="streamer-url">Twitch or Kick link</Label>
        <Input
          id="streamer-url"
          placeholder="https://twitch.tv/videos/… or kick.com/…/videos/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {resolveError ? <p className="text-xs text-destructive">{resolveError}</p> : null}
        {preview ? (
          <p className="text-xs text-muted-foreground">
            {preview.platform} · {preview.kind}
            {preview.title ? ` · ${preview.title}` : ''}
          </p>
        ) : null}
        <VodUrlCheckBanner view={vodCheck} onRecheck={recheckVod} rechecking={vodCheckBusy} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox checked={attest} onCheckedChange={(v) => setAttest(v === true)} />
        <span>This is my channel or I have the creator&apos;s permission.</span>
      </label>
      <StreamerTosNote />
      <PrimaryButton
        type="button"
        disabled={
          !url.trim() ||
          !attest ||
          !!resolveError ||
          submitting ||
          vodCheck?.status === 'blocked'
        }
        onClick={() => void submitUrl()}
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Find clips'}
      </PrimaryButton>
      <div className="border-t border-border pt-4">
        <p className="mb-2 text-sm font-medium">Or upload a recording</p>
        <p className="mb-2 text-xs text-muted-foreground">MP4, MOV, WebM, MP3, WAV · up to {maxUploadLabel ?? '…'}</p>
        <input
          ref={resumeInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-m4v,audio/mpeg,audio/wav,.mp4,.mov,.webm,.m4v,.mp3,.wav"
          className="hidden"
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            onResumeFileChosen(file)
          }}
        />
        {showResumeCard && upload ? (
          <UploadProgressItem
            progress={upload}
            onRetry={() => {
              if (pendingFile) {
                startFileUpload(pendingFile, upload.uploadId)
              } else {
                openResumePicker()
              }
            }}
            onChooseFile={openResumePicker}
            onCancel={cancelInterruptedUpload}
          />
        ) : showDropzone ? (
          <Dropzone onFile={startFileUpload} />
        ) : upload ? (
          <UploadProgressItem
            progress={upload}
            onCancel={() => upload.uploadId && void cancelClipUpload(upload.uploadId).then(() => clearPending())}
          />
        ) : null}
        <PrimaryButton
          className="mt-3"
          type="button"
          disabled={!uploadId || upload?.state !== 'complete' || submitting}
          onClick={() => void submitUpload()}
        >
          Find clips from upload
        </PrimaryButton>
      </div>
    </div>
  )
}
