'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { PageContainer, PageHeader } from '@/components/app/page-primitives'
import { OptionCard } from '@/components/app/option-card'
import { PrimaryButton } from '@/components/app/primary-button'
import { Dropzone } from '@/components/clips/dropzone'
import { BlankProjectCard } from '@/components/clips/blank-project-card'
import { UploadProgressItem } from '@/components/clips/upload-progress-item'
import { ProjectSettingsForm } from '@/components/clips/project-settings-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createProject, createProjectFromLink, estimateCredits } from '@/lib/clips-api'
import { validateImportUrlForSubmit, YOUTUBE_UNSUPPORTED_MSG } from '@/lib/clips/import-url'
import { defaultClipSettings, type ClipProjectSettings } from '@/lib/clips/settings'
import { aiProducerAgentPublicEnabled } from '@/lib/ai-producer-agent/flags'
import { initialNewProjectSettings } from '@/lib/clips/new-project-initial'
import { BYO_DURATION_ERROR } from '@/lib/clips/byo-project'
import {
  FULL_VIDEO_DURATION_ERROR,
  FULL_VIDEO_MAX_DURATION_MS,
  formatMediaDuration,
  sourceAspectRatio,
} from '@/lib/clips/full-video'
import { cancelClipUpload, uploadClipFile, type UploadProgress } from '@/lib/clips/upload'
import { featuresAllUnlocked } from '@/lib/billing/entitlements'
import { StreamerImportPanel } from '@/components/streamer/streamer-import-panel'
import { classifyImportUrl } from '@/lib/clips/import-url'
import { Clapperboard, Globe, Link2, Loader2, Radio, UploadCloud } from 'lucide-react'
import { isT2vFeatureEnabled } from '@/lib/features/t2v'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function NewProjectWorkspace({ reframeV2Enabled = false, forcedIntent }: { reframeV2Enabled?: boolean; forcedIntent?: 'full' }) {
  const router = useRouter()
  const params = useSearchParams()
  const preset = params.get('preset')
  // FV1: /app/video-editor/new opens "Edit a full video" (Home links here).
  const fullIntentParam = forcedIntent === 'full' || params.get('intent') === 'full'
  const initial = useMemo(() => {
    // FIX2 R1: default layout = Auto variety (see lib/clips/new-project-initial.ts)
    return initialNewProjectSettings(preset, Boolean(fullIntentParam))
  }, [preset, fullIntentParam])

  const tabParam = params.get('tab')
  const [tab, setTab] = useState<'upload' | 'link' | 'streamer'>(
    tabParam === 'streamer' ? 'streamer' : tabParam === 'link' ? 'link' : 'upload',
  )
  // Links elsewhere (Home chips, ?tab=…) can change the tab while this page stays mounted.
  useEffect(() => {
    if (tabParam === 'streamer' || tabParam === 'link' || tabParam === 'upload') setTab(tabParam)
  }, [tabParam])
  const [projectIntent, setProjectIntent] = useState<'find' | 'byo' | 'full'>(fullIntentParam ? 'full' : 'find')
  const [agentClipMode, setAgentClipMode] = useState<'clip_moment_v1'|'clip_story_v1'>('clip_moment_v1')
  const [agentClipSeconds, setAgentClipSeconds] = useState<30|60|90>(60)
  const [sourceAspect, setSourceAspect] = useState<ReturnType<typeof sourceAspectRatio> | null>(null)
  const [settings, setSettings] = useState<ClipProjectSettings>(initial)
  const [upload, setUpload] = useState<UploadProgress | null>(null)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [durationMs, setDurationMs] = useState(0)
  const [estimate, setEstimate] = useState<{ credits: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const byoAutoStartedRef = useRef(false)

  const onFile = (file: File, resumeUploadId?: string) => {
    byoAutoStartedRef.current = false
    setPendingFile(file)
    if (!resumeUploadId) setUploadId(null)
    void probeVideo(file)
      .then(({ durationMs: ms, width, height }) => {
        if (projectIntent === 'byo' && ms > 180_000) {
          toast.error(BYO_DURATION_ERROR)
          setUpload(null)
          setPendingFile(null)
          return
        }
        if (projectIntent === 'full' && ms > FULL_VIDEO_MAX_DURATION_MS) {
          toast.error(FULL_VIDEO_DURATION_ERROR)
          setUpload(null)
          setPendingFile(null)
          return
        }
        if (width > 0 && height > 0) {
          const aspect = sourceAspectRatio(width, height)
          setSourceAspect(aspect)
          // FV1: a full video keeps its own shape (16:9 stays 16:9); still editable in the form.
          if (projectIntent === 'full') setSettings((s) => ({ ...s, aspectRatio: aspect }))
        }
        setUpload({
          filename: file.name,
          bytes: file.size,
          loaded: 0,
          percent: 0,
          state: 'uploading',
        })
        return uploadClipFile(
          file,
          (p) => {
            setUpload(p)
            if (p.durationMs && p.durationMs > 0) {
              setDurationMs(p.durationMs)
              setSettings((s) => ({
                ...s,
                rangeEndMs: p.durationMs!,
                ...(projectIntent === 'byo' ? { byo: true as const, rangeStartMs: 0 } : {}),
                ...(projectIntent === 'full' ? { byo: true as const, fullVideo: true as const, rangeStartMs: 0 } : {}),
              }))
            }
            if (p.state === 'complete' && p.uploadId) {
              setUploadId(p.uploadId)
              const ms = p.durationMs ?? 0
              if (ms > 0 && projectIntent === 'find') {
                void estimateCredits({ durationMs: ms, rangeStartMs: 0, rangeEndMs: ms, settings }).then(setEstimate).catch(() => {})
              }
            }
            if (p.state === 'error' && p.error) toast.error(p.error)
          },
          resumeUploadId ? { resumeUploadId } : undefined,
        )
      })
      .catch(() => {
        setUpload({
          filename: file.name,
          bytes: file.size,
          loaded: 0,
          percent: 0,
          state: 'uploading',
        })
        void uploadClipFile(
          file,
          (p) => {
            setUpload(p)
            if (p.state === 'complete' && p.uploadId) setUploadId(p.uploadId)
            if (p.state === 'error' && p.error) toast.error(p.error)
          },
          resumeUploadId ? { resumeUploadId } : undefined,
        ).catch(() => {})
      })
  }

  const submitUpload = useCallback(async () => {
    if (!uploadId) {
      toast.error('Wait for the upload to finish')
      return
    }
    setSubmitting(true)
    try {
      const payloadSettings =
        projectIntent === 'full'
          ? defaultClipSettings({ ...settings, byo: true, fullVideo: true })
          : projectIntent === 'byo'
            ? defaultClipSettings({ ...settings, byo: true })
            : aiProducerAgentPublicEnabled()
              ? defaultClipSettings({...settings,autoAgentClipMode:agentClipMode,autoAgentClipSeconds:agentClipSeconds})
              : settings
      if (projectIntent === 'byo' && durationMs > 180_000) {
        toast.error(BYO_DURATION_ERROR)
        return
      }
      if (projectIntent === 'full' && durationMs > FULL_VIDEO_MAX_DURATION_MS) {
        toast.error(FULL_VIDEO_DURATION_ERROR)
        return
      }
      const project = await createProject({ uploadId, settings: payloadSettings })
      const open =
        projectIntent === 'byo' || projectIntent === 'full' ? '?open=editor' : ''
      router.push(`/app/clips/${project.id}${open}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create project')
    } finally {
      setSubmitting(false)
    }
  }, [agentClipMode,agentClipSeconds,durationMs, projectIntent, router, settings, uploadId])

  useEffect(() => {
    if (projectIntent === 'find') return
    if (upload?.state !== 'complete' || !uploadId || submitting) return
    if (byoAutoStartedRef.current) return
    byoAutoStartedRef.current = true
    void submitUpload()
  }, [projectIntent, upload?.state, uploadId, submitting, submitUpload])

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
    <PageContainer>
      <PageHeader
        title="New project"
        description={`Upload a file, import from Google Drive or Dropbox${isT2vFeatureEnabled() ? ', or start an AI Video project' : ''}.`}
      />
      {tab === 'upload' ? (
        <fieldset className="mb-6 flex flex-col gap-2 border-0 p-0 sm:flex-row" data-testid="new-project-intent">
          <legend className="sr-only">Project type</legend>
          {(
            [
              { id: 'find' as const, label: 'Find clips in a long video', hint: 'AI picks highlights from your upload' },
              { id: 'byo' as const, label: 'Edit a finished clip (up to 3 min)', hint: 'Transcribe and open the editor' },
              {
                id: 'full' as const,
                label: 'Edit a full video',
                hint: 'Up to 3 hours · edit start to finish, landscape stays landscape',
              },
            ] as const
          ).map((opt) => (
            <OptionCard
              key={opt.id}
              selected={projectIntent === opt.id}
              title={opt.label}
              hint={opt.hint}
              className="min-h-[72px] flex-1"
            >
              <input
                type="radio"
                name="project-intent"
                value={opt.id}
                checked={projectIntent === opt.id}
                onChange={() => {
                  setProjectIntent(opt.id)
                  if (opt.id === 'full') {
                    if (durationMs > FULL_VIDEO_MAX_DURATION_MS) toast.error(FULL_VIDEO_DURATION_ERROR)
                    setSettings(
                      defaultClipSettings({
                        byo: true,
                        fullVideo: true,
                        rangeStartMs: 0,
                        rangeEndMs: durationMs || 0,
                        aspectRatio: sourceAspect ?? '16:9',
                      }),
                    )
                  } else if (opt.id === 'byo') {
                    setSettings(defaultClipSettings({ byo: true, rangeStartMs: 0, rangeEndMs: durationMs || 0 }))
                  } else {
                    setSettings((s) => {
                      const { byo: _b, fullVideo: _f, ...rest } = s
                      return defaultClipSettings({ ...rest, byo: undefined, fullVideo: undefined })
                    })
                  }
                }}
                className="sr-only"
              />
            </OptionCard>
          ))}
        </fieldset>
      ) : null}
      {tab==='upload'&&projectIntent==='find'&&aiProducerAgentPublicEnabled()?(
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border p-3" data-testid="upload-agent-mode">
          <label className="text-sm font-medium" htmlFor="upload-agent-mode">Agent clip mode</label>
          <select id="upload-agent-mode" value={agentClipMode}
            onChange={e=>setAgentClipMode(e.target.value as 'clip_moment_v1'|'clip_story_v1')}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm">
            <option value="clip_moment_v1">Single continuous moment</option>
            <option value="clip_story_v1">AI story from multiple moments</option>
          </select>
          <select aria-label="Agent target length" value={agentClipSeconds}
            onChange={e=>setAgentClipSeconds(Number(e.target.value) as 30|60|90)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm">
            <option value={30}>30 seconds</option><option value={60}>60 seconds</option><option value={90}>90 seconds</option>
          </select>
          <span className="text-xs text-muted-foreground">The same Story, Footage, Flow and QA agents run when the upload is ready.</span>
        </div>
      ):null}
      <BlankProjectCard />
      {/* FVfix: ONE source row (was shown twice: link cards + "Import source" radios). */}
      <fieldset className="mb-6 grid gap-3 border-0 p-0 sm:grid-cols-2 lg:grid-cols-4" data-testid="new-project-source">
        <legend className="sr-only">Import source</legend>
        {(
          [
            { id: 'upload' as const, label: 'Upload file', hint: 'MP4, MOV, WebM', icon: UploadCloud },
            { id: 'link' as const, label: 'Paste link', hint: 'Drive or Dropbox', icon: Link2 },
            { id: 'streamer' as const, label: 'Streamer', hint: 'Twitch or Kick', icon: Radio },
          ] as const
        ).map((opt) => (
          <OptionCard
            key={opt.id}
            selected={tab === opt.id}
            icon={opt.icon}
            title={opt.label}
            hint={opt.hint}
            className="min-h-[72px]"
            data-testid={`new-project-source-${opt.id}`}
          >
            <input
              type="radio"
              name="import-source"
              value={opt.id}
              checked={tab === opt.id}
              onChange={() => setTab(opt.id)}
              className="sr-only"
            />
          </OptionCard>
        ))}
        {isT2vFeatureEnabled() ? (
          <Link href="/app/ai-video/new" className="block min-h-[72px]" data-testid="new-project-t2v-card">
            <OptionCard
              selected={false}
              icon={Clapperboard}
              title="AI Video"
              hint="Idea, script, or link → video"
              className="min-h-[72px] h-full pointer-events-none"
            />
          </Link>
        ) : null}
      </fieldset>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          {tab === 'streamer' ? (
            <StreamerImportPanel />
          ) : tab === 'upload' ? (
            <div className="flex flex-col gap-4">
              {!upload || upload.state === 'error' ? <Dropzone onFile={onFile} /> : null}
              {upload ? (
                <UploadProgressItem
                  progress={upload}
                  onCancel={() => upload.uploadId && void cancelClipUpload(upload.uploadId)}
                  onRetry={
                    upload.state === 'error' && pendingFile
                      ? () => onFile(pendingFile, upload.uploadId)
                      : undefined
                  }
                  onChooseFile={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'video/*'
                    input.onchange = () => {
                      const f = input.files?.[0]
                      if (f) onFile(f, upload.uploadId)
                    }
                    input.click()
                  }}
                />
              ) : null}
              {durationMs > 0 && (
                <p className="text-sm text-muted-foreground tabular-nums">
                  Detected duration {durationMs >= 600_000 ? formatMediaDuration(durationMs) : `${(durationMs / 1000).toFixed(1)}s`}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Google Drive, Dropbox, YouTube, or Twitch VOD/clip links (max 3GB, 3 hours). Resumable upload for large
                files on the Upload tab.
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
                      placeholder="YouTube, Twitch VOD, Drive, or Dropbox link"
                      value={linkUrl}
                      onChange={(e) => {
                        const v = e.target.value
                        setLinkUrl(v)
                        const kind = classifyImportUrl(v)
                        if (kind === 'kick') setTab('streamer')
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
                YouTube, Twitch, Drive & Dropbox
              </p>
            </div>
          )}
        </div>
        <div className="flex min-h-0 flex-col gap-4 pb-6 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-5.5rem)] lg:self-start">
          <div
            className="min-h-0 flex-1 overflow-y-auto scroll-pb-6 pr-1 pb-[calc(2.75rem+16px)]"
            data-testid="new-project-settings-scroll"
          >
            <ProjectSettingsForm
              settings={settings}
              onChange={setSettings}
              durationMs={durationMs}
              uploadState={upload?.state}
              reframeV2Enabled={reframeV2Enabled}
              byoMode={projectIntent !== 'find'}
            />
          </div>
          <div className="shrink-0 border-t border-border pt-3" data-testid="new-project-action-bar">
            {estimate && tab === 'upload' && projectIntent === 'find' && (
              <p className="mb-3 text-xs text-muted-foreground">
                {testMode
                  ? `Test mode · est. ${estimate.credits} credits`
                  : `Est. ${estimate.credits} credits`}
              </p>
            )}
            {tab === 'upload' ? (
              <PrimaryButton
                className="w-full"
                disabled={!uploadId || upload?.state !== 'complete' || submitting}
                onClick={() => void submitUpload()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Creating project…
                  </>
                ) : projectIntent !== 'find' ? (
                  'Start'
                ) : (
                  'Get clips'
                )}
              </PrimaryButton>
            ) : null}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}

function probeVideo(file: File): Promise<{ durationMs: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve({
        durationMs: Math.round(video.duration * 1000),
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
      })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('metadata'))
    }
    video.src = url
  })
}
