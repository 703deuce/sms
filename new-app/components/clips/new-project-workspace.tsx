'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dropzone } from '@/components/clips/dropzone'
import { UploadProgressItem } from '@/components/clips/upload-progress-item'
import { ProjectSettingsForm } from '@/components/clips/project-settings-form'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createProject, createProjectFromLink, estimateCredits } from '@/lib/clips-api'
import { validateImportUrlForSubmit, YOUTUBE_UNSUPPORTED_MSG } from '@/lib/clips/import-url'
import { defaultClipSettings, TOOL_PRESET_MAP, type ClipProjectSettings } from '@/lib/clips/settings'
import { cancelClipUpload, uploadClipFile, type UploadProgress } from '@/lib/clips/upload'
import { featuresAllUnlocked } from '@/lib/billing/entitlements'
import { Loader2 } from 'lucide-react'

export function NewProjectWorkspace() {
  const router = useRouter()
  const params = useSearchParams()
  const preset = params.get('preset')
  const initial = useMemo(() => {
    const base = defaultClipSettings()
    if (preset && TOOL_PRESET_MAP[preset]) return defaultClipSettings(TOOL_PRESET_MAP[preset])
    return base
  }, [preset])

  const [tab, setTab] = useState<'upload' | 'link'>('upload')
  const [settings, setSettings] = useState<ClipProjectSettings>(initial)
  const [upload, setUpload] = useState<UploadProgress | null>(null)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState(0)
  const [estimate, setEstimate] = useState<{ credits: number; providerCostUsd?: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const onFile = (file: File) => {
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
    }).catch((e) => {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
      setUpload((u) => (u ? { ...u, state: 'error', error: String(e) } : u))
    })
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
      <PageHeader title="New project" description="Upload a file or import from Google Drive or Dropbox." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'upload' | 'link')} className="flex flex-col gap-4">
          <TabsList>
            <TabsTrigger value="upload">Upload file</TabsTrigger>
            <TabsTrigger value="link">Paste a link</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="flex flex-col gap-4">
            {!upload && <Dropzone onFile={onFile} />}
            {upload && <UploadProgressItem progress={upload} onCancel={() => uploadId && void cancelClipUpload(uploadId)} />}
            {durationMs > 0 && (
              <p className="text-sm text-muted-foreground tabular-nums">Detected duration {(durationMs / 1000).toFixed(1)}s</p>
            )}
          </TabsContent>
          <TabsContent value="link" className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Public Google Drive or Dropbox share links only (max 4GB, 3 hours). YouTube is not supported — upload the file instead.
            </p>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="https://drive.google.com/... or https://www.dropbox.com/..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
          </TabsContent>
        </Tabs>
        <div className="flex flex-col gap-4">
          <ProjectSettingsForm settings={settings} onChange={setSettings} durationMs={durationMs} />
          {estimate && tab === 'upload' && (
            <p className="text-xs text-muted-foreground">
              {testMode
                ? `Test mode · est. provider cost $${(estimate.providerCostUsd ?? 0).toFixed(3)}`
                : `Est. ${estimate.credits} credits`}
            </p>
          )}
          {tab === 'upload' ? (
            <Button
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
            </Button>
          ) : (
            <Button disabled={!linkUrl.trim() || submitting} onClick={() => void submitLink()}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Starting import…
                </>
              ) : (
                'Import and get clips'
              )}
            </Button>
          )}
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
