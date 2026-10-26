'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dropzone } from '@/components/clips/dropzone'
import { UploadProgressItem } from '@/components/clips/upload-progress-item'
import { PrimaryButton } from '@/components/app/primary-button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StreamerTosNote } from '@/components/streamer/tos-note'
import { StreamerUsageMeter, type StreamUsageView } from '@/components/streamer/usage-meter'
import { clipsFetch } from '@/lib/clips-api'
import { cancelClipUpload, uploadClipFile, type UploadProgress } from '@/lib/clips/upload'
import { Loader2 } from 'lucide-react'

export function StreamerImportPanel({ usageInitial }: { usageInitial?: StreamUsageView | null }) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [attest, setAttest] = useState(false)
  const [preview, setPreview] = useState<{ title?: string; platform: string; kind: string } | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [upload, setUpload] = useState<UploadProgress | null>(null)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const startFileUpload = (file: File) => {
    setPendingFile(file)
    setUploadId(null)
    void uploadClipFile(file, (p) => {
      setUpload(p)
      if (p.state === 'complete' && p.uploadId) setUploadId(p.uploadId)
    }).catch(() => {
      /* state + message set in uploadClipFile */
    })
  }

  useEffect(() => {
    const trimmed = url.trim()
    if (trimmed.length < 12) {
      setPreview(null)
      setResolveError(null)
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
        })
        .catch((e) => {
          setPreview(null)
          setResolveError(e instanceof Error ? e.message : 'Could not parse link')
        })
    }, 400)
    return () => clearTimeout(t)
  }, [url])

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
      </div>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox checked={attest} onCheckedChange={(v) => setAttest(v === true)} />
        <span>This is my channel or I have the creator&apos;s permission.</span>
      </label>
      <StreamerTosNote />
      <PrimaryButton
        type="button"
        disabled={!url.trim() || !attest || !!resolveError || submitting}
        onClick={() => void submitUrl()}
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Find clips'}
      </PrimaryButton>
      <div className="border-t border-border pt-4">
        <p className="mb-2 text-sm font-medium">Or upload a recording</p>
        {!upload || upload.state === 'error' ? (
          upload?.state === 'error' ? (
            <UploadProgressItem
              progress={upload}
              onRetry={() => pendingFile && startFileUpload(pendingFile)}
            />
          ) : (
            <Dropzone onFile={startFileUpload} />
          )
        ) : (
          <UploadProgressItem
            progress={upload}
            onCancel={() => upload.uploadId && void cancelClipUpload(upload.uploadId)}
          />
        )}
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
