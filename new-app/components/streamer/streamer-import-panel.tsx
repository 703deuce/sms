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
import {
  LIVE_CLIP_LAST_MINUTE_PRESETS,
  resolveVodImportRangeMs,
  type VodImportRangeMode,
} from '@/lib/streamer/vod-import-range'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClipLengthChoice } from '@/components/clips/clip-length-choice'
import { streamerClipLengthFields, type ClipLengthChoice as ClipLengthChoiceValue } from '@/lib/clips/clip-length'

const PENDING_UPLOAD_KEY = 'streamer-upload-resume-v1'

type PendingUploadMeta = { uploadId: string; filename: string; bytes: number; lastModified?: number }

function fileMatchesResume(file: File, saved: PendingUploadMeta) {
  if (file.name !== saved.filename) return false
  if (file.size !== saved.bytes) return false
  if (saved.lastModified != null && file.lastModified !== saved.lastModified) return false
  return true
}

type StreamerResolveView = {
  platform: string
  kind: string
  title?: string | null
  durationS?: number | null
  isLive?: boolean
  vodSource?: 'live_archive' | 'latest_vod' | null
  resolvedVodUrl?: string | null
  pastedAs?: string
  channelLogin?: string | null
  id?: string
}

function formatDurationClock(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function StreamerImportPanel({ usageInitial }: { usageInitial?: StreamUsageView | null }) {
  const router = useRouter()
  const resumeInputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [attest, setAttest] = useState(false)
  const [preview, setPreview] = useState<{ title?: string; platform: string; kind: string } | null>(null)
  const [resolveMeta, setResolveMeta] = useState<StreamerResolveView | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [vodCheck, setVodCheck] = useState<VodAvailabilityView | null>(null)
  const [vodCheckBusy, setVodCheckBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [upload, setUpload] = useState<UploadProgress | null>(null)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingMeta, setPendingMeta] = useState<PendingUploadMeta | null>(null)
  const [maxUploadLabel, setMaxUploadLabel] = useState<string | null>(null)
  const [rangeMode, setRangeMode] = useState<VodImportRangeMode>('first_minutes')
  const [firstMinutes, setFirstMinutes] = useState('15')
  const [lastMinutesPreset, setLastMinutesPreset] = useState<string>('5')
  const [rangeStart, setRangeStart] = useState('0:00')
  const [rangeEnd, setRangeEnd] = useState('15:00')
  const [clipLength, setClipLength] = useState<ClipLengthChoiceValue>('auto')

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
      setResolveMeta(null)
      setResolveError(null)
      setVodCheck(null)
      return
    }
    const t = setTimeout(() => {
      void clipsFetch<StreamerResolveView>('/api/streamer/resolve', {
        method: 'POST',
        body: JSON.stringify({ url: trimmed }),
      })
        .then((data) => {
          setResolveMeta(data)
          setPreview({
            platform: data.platform,
            kind: data.pastedAs === 'channel' ? 'channel' : data.kind,
            title: data.title ?? undefined,
          })
          if (data.isLive) {
            setRangeMode('last_minutes')
            setLastMinutesPreset('5')
          } else {
            setRangeMode((m) => (m === 'last_minutes' ? 'first_minutes' : m))
          }
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
          setResolveMeta(null)
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

  const vodDurationMs =
    resolveMeta?.durationS != null && resolveMeta.durationS > 0
      ? Math.round(resolveMeta.durationS * 1000)
      : undefined

  const buildRangePayload = (durationOverrideMs?: number) => {
    const mins = parseInt(firstMinutes, 10)
    const lastMins = parseInt(lastMinutesPreset, 10)
    const durationMs = durationOverrideMs ?? vodDurationMs
    return resolveVodImportRangeMs(
      {
        mode: rangeMode,
        firstMinutes: Number.isFinite(mins) ? mins : 15,
        lastMinutes: Number.isFinite(lastMins) ? lastMins : 5,
        start: rangeStart,
        end: rangeEnd,
      },
      { vodDurationMs: durationMs },
    )
  }

  const submitUrl = async () => {
    if (!attest) {
      toast.error('Confirm permission to import')
      return
    }
    setSubmitting(true)
    try {
      const fresh = await clipsFetch<StreamerResolveView>('/api/streamer/resolve', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() }),
      })
      setResolveMeta(fresh)
      const durationMs =
        fresh.durationS != null && fresh.durationS > 0 ? Math.round(fresh.durationS * 1000) : undefined
      const range = buildRangePayload(durationMs)
      if ('error' in range) {
        toast.error(range.error)
        return
      }
      const data = await clipsFetch<{ projectId: string }>('/api/streamer/imports', {
        method: 'POST',
        body: JSON.stringify({
          url: url.trim(),
          attest: true,
          settings: streamerClipLengthFields(clipLength),
          ...(range.rangeEndMs > 0
            ? { rangeStartMs: range.rangeStartMs, rangeEndMs: range.rangeEndMs }
            : {}),
        }),
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
    const range = buildRangePayload()
    if ('error' in range) {
      toast.error(range.error)
      return
    }
    setSubmitting(true)
    try {
      const data = await clipsFetch<{ projectId: string }>('/api/streamer/imports', {
        method: 'POST',
        body: JSON.stringify({
          uploadId,
          attest: true,
          settings: streamerClipLengthFields(clipLength),
          ...(range.rangeEndMs > 0
            ? { rangeStartMs: range.rangeStartMs, rangeEndMs: range.rangeEndMs }
            : {}),
        }),
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
        Long VODs: we fetch audio first, then only the clip ranges you choose (up to 12 h). Live Twitch channels use
        the in-progress archive VOD — we do not pull the raw live HLS feed.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="streamer-url">Twitch or Kick link</Label>
        <Input
          id="streamer-url"
          placeholder="https://twitch.tv/yourchannel or twitch.tv/videos/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        {resolveError ? <p className="text-xs text-destructive">{resolveError}</p> : null}
        {preview ? (
          <p className="text-xs text-muted-foreground">
            {preview.platform} · {preview.kind === 'channel' ? 'channel' : preview.kind}
            {preview.title ? ` · ${preview.title}` : ''}
            {resolveMeta?.durationS ? ` · ${formatDurationClock(resolveMeta.durationS)} on VOD` : ''}
          </p>
        ) : null}
        {resolveMeta?.isLive ? (
          <p className="text-xs text-primary">
            Live now — clipping from the in-progress Twitch archive VOD. Pick how many recent minutes to analyze.
          </p>
        ) : null}
        {resolveMeta?.vodSource === 'latest_vod' && preview?.kind === 'channel' ? (
          <p className="text-xs text-muted-foreground">
            Channel is offline — using their latest finished broadcast.
          </p>
        ) : null}
        {resolveMeta?.resolvedVodUrl ? (
          <p className="text-xs text-muted-foreground truncate" title={resolveMeta.resolvedVodUrl}>
            VOD: {resolveMeta.resolvedVodUrl.replace(/^https?:\/\//, '')}
          </p>
        ) : null}
        <VodUrlCheckBanner view={vodCheck} onRecheck={recheckVod} rechecking={vodCheckBusy} />
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <ClipLengthChoice value={clipLength} onChange={setClipLength} />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs font-medium">VOD range (optional)</p>
        <p className="text-xs text-muted-foreground">
          Limit download and clip finding to part of the VOD. When the channel is live, default to the last few minutes
          of the archive.
        </p>
        <Select value={rangeMode} onValueChange={(v) => setRangeMode(v as VodImportRangeMode)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full VOD</SelectItem>
            {resolveMeta?.isLive ? (
              <SelectItem value="last_minutes">Last N minutes (live tail)</SelectItem>
            ) : null}
            <SelectItem value="first_minutes">First N minutes</SelectItem>
            <SelectItem value="start_end">Start → end time</SelectItem>
          </SelectContent>
        </Select>
        {rangeMode === 'last_minutes' ? (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Last minutes (from current VOD length)</Label>
            <Select value={lastMinutesPreset} onValueChange={setLastMinutesPreset}>
              <SelectTrigger className="h-9 w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIVE_CLIP_LAST_MINUTE_PRESETS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    Last {m} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vodDurationMs ? (
              <p className="text-xs text-muted-foreground tabular-nums">
                VOD length now {formatDurationClock(vodDurationMs / 1000)} — we fetch only the tail you pick.
              </p>
            ) : null}
          </div>
        ) : null}
        {rangeMode === 'first_minutes' ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="streamer-first-min" className="shrink-0 text-xs">Minutes</Label>
            <Input
              id="streamer-first-min"
              type="number"
              min={1}
              max={720}
              className="h-9 w-24"
              value={firstMinutes}
              onChange={(e) => setFirstMinutes(e.target.value)}
            />
          </div>
        ) : null}
        {rangeMode === 'start_end' ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="streamer-range-start" className="text-xs">Start</Label>
              <Input
                id="streamer-range-start"
                placeholder="0:00"
                className="h-9"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="streamer-range-end" className="text-xs">End</Label>
              <Input
                id="streamer-range-end"
                placeholder="15:00"
                className="h-9"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
              />
            </div>
          </div>
        ) : null}
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
