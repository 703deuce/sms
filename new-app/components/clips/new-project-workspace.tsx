'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { PrimaryButton } from '@/components/app/primary-button'
import { Dropzone } from '@/components/clips/dropzone'
import { UploadProgressItem } from '@/components/clips/upload-progress-item'
import { ProjectSettingsForm } from '@/components/clips/project-settings-form'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createProject, createProjectFromLink, estimateCredits } from '@/lib/clips-api'
import { validateImportUrlForSubmit, YOUTUBE_UNSUPPORTED_MSG } from '@/lib/clips/import-url'
import { defaultClipSettings, TOOL_PRESET_MAP, type ClipProjectSettings } from '@/lib/clips/settings'
import { cancelClipUpload, uploadClipFile, type UploadProgress } from '@/lib/clips/upload'
import { featuresAllUnlocked } from '@/lib/billing/entitlements'
import { StreamerImportPanel } from '@/components/streamer/streamer-import-panel'
import { classifyImportUrl } from '@/lib/clips/import-url'
import { Globe, Link2, Loader2, Plus, Radio, UploadCloud } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NewProjectWorkspace() {
  const router = useRouter()
  const params = useSearchParams()
  const preset = params.get('preset')
  const initial = useMemo(() => {
    const base = defaultClipSettings()
    if (preset && TOOL_PRESET_MAP[preset]) return defaultClipSettings(TOOL_PRESET_MAP[preset])
    return base
  }, [preset])

  const tabParam = params.get('tab')
  const [tab, setTab] = useState<'upload' | 'link' | 'streamer'>(
    tabParam === 'streamer' ? 'streamer' : tabParam === 'link' ? 'link' : 'upload',
  )
  const [settings, setSettings] = useState<ClipProjectSettings>(initial)
  const [upload, setUpload] = useState<UploadProgress | null>(null)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [durationMs, setDurationMs] = useState(0)
  const [estimate, setEstimate] = useState<{ credits: number; providerCostUsd?: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const onFile = (file: File) => {
    setPendingFile(file)
    setUploadId(null)
    void uploadClipFile(file, (p) => {
      setUpload(p)
      if (p.state === 'complete' && p.uploadId) {
        setUploadId(p.uploadId)
        void probeDuration(file).then((ms) => {
          setDurationMs(ms)
          setSettings((s) => ({ ...s, rangeEndMs: ms }))
          void estimateCredits({ durationMs: ms, rangeStartMs: 0, rangeEndMs: ms, settings }).then(setEstimate).catch(() => {})
        })
      }
      if (p.state === 'error' && p.error) toast.error(p.error)
    }).catch(() => {})
  }

  const submitUpload = async () => {
    if (!uploadId) {
      toast.error('Wait for the upload to finish')
      return
    }
    setSubmitting(true)
    try {
      const project = await createProject({ uploadId, settings })
      router.push(`/app/clips/${project.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create project')
    } finally {
      setSubmitting(false)
    }
  }

  const submitLink = async () => {
    const check = validateImportUrlForSubmit(linkUrl)
    if (!check.ok) {
      toast.error(check.message)
      return
    }
    setSubmitting(true)
    try {
      const project = await createProjectFromLink({ sourceUrl: linkUrl.trim(), settings })
      router.push(`/app/clips/${project.id}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not start import'
      toast.error(msg === YOUTUBE_UNSUPPORTED_MSG ? msg : msg)
    } finally {
      setSubmitting(false)
    }
  }

  const testMode = featuresAllUnlocked()

  return (
    <Page>
      <PageHeader
        icon={Plus}
        iconTone="brand"
        title="New project"
        description="Upload a file or import from Google Drive or Dropbox."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <fieldset className="grid grid-cols-1 gap-2 border-0 p-0 sm:grid-cols-3">
            <legend className="sr-only">Import source</legend>
            {(
              [
                { id: 'upload' as const, label: 'Upload file', hint: 'MP4, MOV, WebM', icon: UploadCloud },
                { id: 'link' as const, label: 'Paste link', hint: 'Drive or Dropbox', icon: Link2 },
                { id: 'streamer' as const, label: 'Streamer', hint: 'Twitch or Kick', icon: Radio },
              ] as const
            ).map((opt) => (
              <label
                key={opt.id}
                className={cn(
                  'flex cursor-pointer flex-col items-start gap-2 rounded-xl border p-3 text-left transition hover:border-primary/40',
                  tab === opt.id && 'border-primary bg-primary/8 ring-1 ring-primary/40',
                )}
              >
                <input
                  type="radio"
                  name="import-source"
                  value={opt.id}
                  checked={tab === opt.id}
                  onChange={() => setTab(opt.id)}
                  className="sr-only"
                />
                <span className="grid size-10 place-items-center rounded-lg bg-muted">
                  <opt.icon className="size-5 text-primary" aria-hidden />
                </span>
                <span className="text-sm font-semibold">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.hint}</span>
              </label>
            ))}
          </fieldset>
          {tab === 'streamer' ? (
            <StreamerImportPanel />
          ) : tab === 'upload' ? (
            <div className="flex flex-col gap-4">
              {(!upload || upload.state === 'error') && upload?.state !== 'error' ? (
                <Dropzone onFile={onFile} />
              ) : null}
              {upload ? (
                <UploadProgressItem
                  progress={upload}
                  onCancel={() => upload.uploadId && void cancelClipUpload(upload.uploadId)}
                  onRetry={upload.state === 'error' && pendingFile ? () => onFile(pendingFile) : undefined}
                />
              ) : null}
              {durationMs > 0 && (
                <p className="text-sm text-muted-foreground tabular-nums">
                  Detected duration {(durationMs / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Public Google Drive or Dropbox share links only (max 4GB, 3 hours). YouTube is not supported — upload
                the file instead.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="relative min-w-0 flex-1">
                  <Label htmlFor="import-link-url" className="text-xs font-medium">
                    Video link URL
                  </Label>
                  <div className="relative mt-1.5">
                    <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      id="import-link-url"
                      className="h-10 pl-9"
                      placeholder="Paste a Google Drive, Dropbox, or direct video URL"
                      value={linkUrl}
                      onChange={(e) => {
                        const v = e.target.value
                        setLinkUrl(v)
                        const kind = classifyImportUrl(v)
                        if (kind === 'twitch' || kind === 'kick') setTab('streamer')
                      }}
                      autoComplete="url"
                    />
                  </div>
                </div>
                <PrimaryButton
                  type="button"
                  className="shrink-0"
                  disabled={!linkUrl.trim() || submitting}
                  onClick={() => void submitLink()}
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Import'}
                </PrimaryButton>
              </div>
              <p className="flex items-center gap-3 text-xs text-muted-foreground">
                <Globe className="size-3.5" aria-hidden />
                Drive & Dropbox supported
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <ProjectSettingsForm settings={settings} onChange={setSettings} durationMs={durationMs} />
          {estimate && tab === 'upload' && (
            <p className="text-xs text-muted-foreground">
              {testMode
                ? `Test mode · est. provider cost $${(estimate.providerCostUsd ?? 0).toFixed(3)}`
                : `Est. ${estimate.credits} credits`}
            </p>
          )}
          {tab === 'upload' ? (
            <PrimaryButton
              disabled={!uploadId || upload?.state !== 'complete' || submitting}
              onClick={() => void submitUpload()}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Creating project…
                </>
              ) : (
                'Get clips'
              )}
            </PrimaryButton>
          ) : null}
        </div>
      </div>
    </Page>
  )
}

function probeDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Math.round(video.duration * 1000))
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('metadata'))
    }
    video.src = url
  })
}
