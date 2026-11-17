'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Clapperboard, FileText, Film, FolderOpen, Lightbulb, Paperclip, Plus, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { UploadProgressItem } from '@/components/clips/upload-progress-item'
import { EmptyState } from '@/components/app/page-primitives'
import { StatusBadge, type Tone } from '@/components/app/status'
import { cn } from '@/lib/utils'
import { getMotionStudioClient } from '@/lib/motion-studio'
import { assetKindForFile, MotionStudioHttpError, newIdempotencyKey, type MotionStudioClient } from '@/lib/motion-studio/client'
import {
  MOTION_STUDIO_NAME,
  MOTION_STUDIO_NEW_ROUTE,
  MOTION_STUDIO_ROUTE,
  MOTION_STUDIO_VISION,
  MS_LABELS,
  MS_MEDIA_PICKER_ENABLED,
  MS_MEDIA_POLICY_LABELS,
  MS_UPLOAD_ACCEPT,
  MS_WORKFLOWS,
  selectedWorkflowLine,
} from '@/lib/motion-studio/config'
import { formatClock, relativeTime } from '@/lib/motion-studio/format'
import { normalizeLogoUpload } from '@/lib/motion-studio/logo-upload'
import { MS_VIDEO_TYPES, MS_CREATIVE_STYLES, type MsVideoType, type MsCreativeStyle, type MsBrandMode, type MsBrandConsistency, type MsLogoPlacement, type MsSavedBrandKit } from '@/lib/motion-studio/creative-options'
import type { MsAssetKind, MsMediaPolicy, MsProjectSummary, MsWorkflow } from '@/lib/motion-studio/types'
import type { UploadProgress } from '@/lib/clips/upload'
import { InlineError, MockDataNotice } from './motion-studio-shared'
import { MotionPoster } from './motion-poster'

const MODE_ICON: Record<MsWorkflow, typeof Lightbulb> = { idea: Lightbulb, script: FileText, footage: Film }

type Attachment = {
  key: string
  file: File
  kind: MsAssetKind
  progress: UploadProgress
  uploadId: string | null
  role?: 'logo' | 'reference'
}

export const STATUS_TONE: Record<MsProjectSummary['status'], Tone> = {
  setup: 'neutral',
  planning: 'info',
  awaiting_review: 'warning',
  producing: 'info',
  review: 'success',
  preflight_ok: 'success',
  exporting: 'info',
  complete: 'success',
  failed: 'danger',
}

export const STATUS_LABEL: Record<MsProjectSummary['status'], string> = {
  setup: 'Setup',
  planning: 'Planning',
  awaiting_review: 'Ready for review',
  producing: 'Producing',
  review: 'Ready',
  preflight_ok: 'Pre-flight passed',
  exporting: 'Exporting',
  complete: 'Exported',
  failed: 'Failed',
}

/** First screen (concept §1): one prompt, optional uploads, three mode tiles. No timeline or panels. */
export function MotionStudioCreate({
  client: injected,
  initialView = 'create',
  mediaPickerEnabled = MS_MEDIA_PICKER_ENABLED,
}: {
  client?: MotionStudioClient
  initialView?: 'create' | 'projects'
  /** ST-UI-107: hidden in v1. Only the flag-on test (and the later Media Researcher) turns it on. */
  mediaPickerEnabled?: boolean
}) {
  const client = useMemo(() => injected ?? getMotionStudioClient(), [injected])
  const router = useRouter()
  const view = initialView
  const [workflow, setWorkflow] = useState<MsWorkflow>('idea')
  const [durationSeconds, setDurationSeconds] = useState<30 | 60 | 120 | 180 | 300>(30)
  const [durationTouched, setDurationTouched] = useState(false)
  const [formatTouched, setFormatTouched] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [videoType, setVideoType] = useState<MsVideoType>('anything')
  const [style, setStyle] = useState<MsCreativeStyle>('automatic')
  const [customStyle, setCustomStyle] = useState('')
  const [format, setFormat] = useState<'16:9' | '9:16' | '1:1'>('16:9')
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('480p')
  const [brandMode, setBrandMode] = useState<MsBrandMode>('none')
  const [brandKitId, setBrandKitId] = useState('')
  const [editingBrandKitId, setEditingBrandKitId] = useState('')
  const [existingLogoUploadId, setExistingLogoUploadId] = useState('')
  const [brandKits, setBrandKits] = useState<MsSavedBrandKit[]>([])
  const [brandName, setBrandName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#D6AD55')
  const [secondaryColor, setSecondaryColor] = useState('#171717')
  const [accentColor, setAccentColor] = useState('#FFFFFF')
  const [fontPreference, setFontPreference] = useState('')
  const [brandTone, setBrandTone] = useState('')
  const [brandGuidelines, setBrandGuidelines] = useState('')
  const [consistency, setConsistency] = useState<MsBrandConsistency>('guided')
  const [logoPlacement, setLogoPlacement] = useState<MsLogoPlacement>('ai_decides')
  const [creativeInstructions, setCreativeInstructions] = useState('')
  const [savingBrand, setSavingBrand] = useState(false)
  const [script, setScript] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<MsProjectSummary[] | null>(null)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [projectsErrorStatus, setProjectsErrorStatus] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const referenceRef = useRef<HTMLInputElement>(null)
  const idemKey = useRef(newIdempotencyKey('ms_create'))

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('type')
    if (requested && MS_VIDEO_TYPES.some(t => t.id === requested)) {
      const category = requested as MsVideoType
      setVideoType(category)
      if (['documentary','educational','explainer'].includes(category)) setDurationSeconds(180)
      if (['social_video','audiogram'].includes(category)) setFormat('9:16')
      if (category === 'video_editing') setWorkflow('footage')
    }
  }, [])
  useEffect(() => {
    // Folder upload needs the non-standard attribute (interviews, photos, charts, narration).
    folderRef.current?.setAttribute('webkitdirectory', '')
    folderRef.current?.setAttribute('directory', '')
  }, [])

  const loadProjects = useCallback(async () => {
    setProjectsError(null)
    setProjectsErrorStatus(null)
    try {
      setProjects(await client.listProjects())
    } catch (err) {
      setProjectsErrorStatus(err instanceof MotionStudioHttpError ? err.status : null)
      setProjectsError(err instanceof Error ? err.message : 'Could not load your projects.')
    }
  }, [client])
  useEffect(() => {
    void loadProjects()
  }, [loadProjects])

  const loadBrandKits = useCallback(async () => {
    if (client.mode !== 'live') return
    try {
      const response = await fetch('/api/motion-studio/brand-kits', { cache: 'no-store' })
      if (response.ok) setBrandKits(((await response.json()) as { kits: MsSavedBrandKit[] }).kits)
    } catch { /* optional */ }
  }, [client.mode])
  useEffect(() => { void loadBrandKits() }, [loadBrandKits])

  const uploadOne = useCallback(
    async (att: Attachment) => {
      const update = (patch: Partial<Attachment>) => setAttachments((prev) => prev.map((a) => (a.key === att.key ? { ...a, ...patch } : a)))
      try {
        const { uploadId } = await client.uploadFile(att.file, (percent) =>
          update({ progress: { ...att.progress, percent, loaded: Math.round((att.file.size * percent) / 100), state: percent >= 100 ? 'finalizing' : 'uploading' } }),
        )
        update({ uploadId, progress: { ...att.progress, percent: 100, loaded: att.file.size, state: 'complete', uploadId } })
      } catch (err) {
        update({ progress: { ...att.progress, state: 'error', error: err instanceof Error ? err.message : 'Upload failed', retryable: true } })
      }
    },
    [client],
  )

  const addFiles = useCallback(
    (files: FileList | File[] | null, role?: 'logo' | 'reference') => {
      if (!files) return
      const list = [...files].filter((f) => !f.name.startsWith('.'))
      if (!list.length) return
      const next: Attachment[] = list.map((file) => ({
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        kind: assetKindForFile(file),
        uploadId: null,
        role,
        progress: { filename: file.name, bytes: file.size, loaded: 0, percent: 0, state: 'uploading' },
      }))
      setAttachments((prev) => role === 'logo' ? [...prev.filter(a => a.role !== 'logo'), ...next] : [...prev, ...next])
      // Scripts are read as text and routed to Story; media goes through the upload path.
      for (const att of next) {
        if (att.kind === 'script' && /\.(txt|md)$/i.test(att.file.name)) {
          void att.file.text().then((text) => {
            setScript((s) => (s ? `${s}\n\n${text}` : text))
            setWorkflow((w) => (w === 'idea' ? 'script' : w))
          })
        }
        void uploadOne(att)
      }
      if (next.some((a) => a.kind === 'video' && !a.role) && !prompt.trim()) setWorkflow((w) => (w === 'idea' ? 'footage' : w))
    },
    [uploadOne, prompt],
  )

  const selectLogo = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    try {
      const normalized = await normalizeLogoUpload(file)
      addFiles([normalized], 'logo')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not read the logo.')
    }
  }

  const brandProfile = {
    name: brandName || undefined, primaryColor, secondaryColor, accentColor,
    fontPreference: fontPreference || undefined, tone: brandTone || undefined,
    guidelines: brandGuidelines || undefined,
    logoUploadId: attachments.find(a => a.role === 'logo' && a.uploadId)?.uploadId || existingLogoUploadId || undefined,
    logoPlacement, consistency,
  }
  const saveBrand = async () => {
    if (!brandName.trim() || client.mode !== 'live') return
    setSavingBrand(true)
    setError(null)
    try {
      if (uploading) throw new Error('Finish uploads before saving the brand.')
      const response = await fetch('/api/motion-studio/brand-kits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(editingBrandKitId ? { id: editingBrandKitId } : {}), name: brandName, profile: brandProfile }),
      })
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error || 'Could not save brand.')
      const { kit } = await response.json() as { kit: MsSavedBrandKit }
      await loadBrandKits()
      setBrandKitId(kit.id)
      setEditingBrandKitId('')
      setBrandMode('saved')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save brand.') }
    finally { setSavingBrand(false) }
  }

  const editSavedBrand = () => {
    const kit = brandKits.find(k => k.id === brandKitId)
    if (!kit) return
    const b = kit.profile
    setEditingBrandKitId(kit.id)
    setBrandName(kit.name)
    setPrimaryColor(b.primaryColor || '#D6AD55')
    setSecondaryColor(b.secondaryColor || '#171717')
    setAccentColor(b.accentColor || '#FFFFFF')
    setFontPreference(b.fontPreference || '')
    setBrandTone(b.tone || '')
    setBrandGuidelines(b.guidelines || '')
    setConsistency(b.consistency || 'guided')
    setLogoPlacement(b.logoPlacement || 'ai_decides')
    setExistingLogoUploadId(b.logoUploadId || '')
    setBrandMode('project')
  }
  const deleteSavedBrand = async () => {
    if (!brandKitId || client.mode !== 'live') return
    try {
      const response = await fetch('/api/motion-studio/brand-kits/' + encodeURIComponent(brandKitId), { method: 'DELETE' })
      if (!response.ok) throw new Error('Could not delete saved brand.')
      setBrandKitId('')
      setBrandMode('none')
      await loadBrandKits()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete brand.') }
  }
  const removeAttachment = (key: string) => setAttachments((prev) => prev.filter((a) => a.key !== key))

  const uploading = attachments.some((a) => a.progress.state === 'uploading' || a.progress.state === 'finalizing')
  const ready = attachments.filter((a) => a.uploadId)
  const hasInput =
    workflow === 'idea' ? prompt.trim().length > 0 || (videoType !== 'anything' && ready.length > 0) : workflow === 'script' ? script.trim().length > 0 || ready.some((a) => a.kind === 'script' || a.kind === 'audio') || prompt.trim().length > 0 : ready.some((a) => a.kind === 'video' && !a.role)
  const canStart = hasInput && !uploading && !starting && (brandMode !== 'saved' || !!brandKitId)

  const start = async () => {
    if (!canStart) return
    setStarting(true)
    setError(null)
    console.info('[motion-studio:ui] start', { workflow, uploads: ready.length, promptChars: prompt.length })
    try {
      const project = await client.createProject({
        workflow,
        prompt: prompt.trim(),
        script: workflow === 'idea' ? null : script.trim() || null,
        uploads: ready.filter(a => a.role !== 'logo' || brandMode === 'project').map((a) => ({ uploadId: a.uploadId as string, kind: a.kind, label: a.file.name })),
        mediaPolicy: 'auto_plus_uploads',
        durationSeconds,
        format: `${format}_${resolution}`,
        creative: { videoType, style, customStyle: style === 'custom' ? customStyle : undefined,
          instructions: creativeInstructions, brandMode,
          brandKitId: brandMode === 'saved' ? brandKitId : undefined,
          brand: brandMode === 'project' ? brandProfile : undefined,
          referenceUploadIds: ready.filter(a => a.role === 'reference').map(a => a.uploadId as string) },
        idempotencyKey: idemKey.current,
      })
      if (client.mode === 'live') {
        // Keep the existing Motion Studio project and route. The autonomous
        // production bot is dispatched from the server; never expose its key.
        const response = await fetch('/api/motion-studio/agent/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'create-' + project.id },
          body: JSON.stringify({ projectId: project.id }),
        })
        if (!response.ok) {
          const issue = await response.json().catch(() => ({})) as { error?: string }
          throw new Error(issue.error || 'Could not submit the project to the production bot.')
        }
      }
      router.push(`${MOTION_STUDIO_ROUTE}/${encodeURIComponent(project.id)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the project. Try again.')
      setStarting(false)
    }
  }

  return (
    <div className="relative min-h-full" data-testid="motion-studio-create">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-grid-fade" />
      <div className="relative mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-6 py-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
              <Clapperboard className="size-4" aria-hidden />
            </span>
            <h1 className="text-page-title tracking-tight">{MOTION_STUDIO_NAME}</h1>
          </div>
          <nav className="flex items-center gap-1" aria-label="Motion Studio">
            <Link href={MOTION_STUDIO_NEW_ROUTE} className={buttonVariants({ variant: view === 'create' ? 'secondary' : 'ghost', size: 'sm' })} aria-current={view === 'create' ? 'page' : undefined} data-testid="ms-nav-create">
              <Plus className="size-3.5" aria-hidden />
              New video
            </Link>
            <Link href={MOTION_STUDIO_ROUTE} className={buttonVariants({ variant: view === 'projects' ? 'secondary' : 'ghost', size: 'sm' })} aria-current={view === 'projects' ? 'page' : undefined} data-testid="ms-nav-projects">
              {MS_LABELS.myProjects}
            </Link>
          </nav>
        </header>

        {client.mode === 'mock' ? <MockDataNotice className="mx-auto w-full max-w-3xl" /> : null}

        {view === 'create' ? (
          <section className="mx-auto flex w-full max-w-3xl flex-col items-stretch gap-6 pt-6 md:pt-12" aria-labelledby="ms-headline">
            <div className="flex flex-col items-center gap-2 text-center">
              <h2 id="ms-headline" className="text-2xl font-semibold tracking-tight text-balance">
                {MS_LABELS.headline}
              </h2>
              <p className="text-sm text-muted-foreground">{MS_LABELS.subhead}</p>
            </div>
            <section className="rounded-xl border border-border bg-card p-4" aria-label="Video type">
              <label htmlFor="ms-video-type" className="mb-2 block text-sm font-medium">What kind of video are you creating?</label>
              <select id="ms-video-type" data-testid="ms-video-type" value={videoType} onChange={e => { const type = e.target.value as MsVideoType; setVideoType(type);
                  if (type === 'video_editing') setWorkflow('footage')
                  if (!durationTouched) setDurationSeconds(['documentary','educational','explainer'].includes(type) ? 180 : type === 'product_demo' ? 60 : 30)
                  if (!formatTouched) setFormat(['social_video','audiogram'].includes(type) ? '9:16' : '16:9') }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {['General','Stories & Content','Marketing','Motion Design','Editing & Repurposing'].map(group => <optgroup key={group} label={group}>
                  {MS_VIDEO_TYPES.filter(t => t.group === group).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </optgroup>)}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">Types guide the AI; every video gets original scene designs.</p>
            </section>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
              <label htmlFor="ms-duration" className="text-sm font-medium">Video length</label>
              <select id="ms-duration" data-testid="ms-duration" value={durationSeconds}
                onChange={e => { setDurationSeconds(Number(e.target.value) as 30 | 60 | 120 | 180 | 300); setDurationTouched(true) }}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={120}>2 minutes</option>
                <option value={180}>3 minutes</option>
                <option value={300}>5 minutes</option>
              </select>
            </div>

            <section className="rounded-xl border border-border bg-card p-4" aria-label="Creative direction and branding" data-testid="ms-creative-options">
              <h3 className="mb-3 text-sm font-semibold">Creative direction and branding <span className="font-normal text-muted-foreground">(optional)</span></h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">Visual style
                  <select data-testid="ms-creative-style" value={style} onChange={e => setStyle(e.target.value as MsCreativeStyle)} className="h-10 rounded-md border border-input bg-background px-3">
                    {MS_CREATIVE_STYLES.map(v => <option key={v} value={v}>{v === 'automatic' ? 'AI decides' : v[0]!.toUpperCase() + v.slice(1)}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">Canvas
                  <select data-testid="ms-aspect-ratio" value={format} onChange={e => { setFormat(e.target.value as typeof format); setFormatTouched(true) }} className="h-10 rounded-md border border-input bg-background px-3">
                    <option value="16:9">16:9 · Landscape</option><option value="9:16">9:16 · Vertical</option><option value="1:1">1:1 · Square</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">Output resolution
                  <select data-testid="ms-resolution" value={resolution} onChange={e => setResolution(e.target.value as typeof resolution)} className="h-10 rounded-md border border-input bg-background px-3">
                    <option value="480p">480p · Faster preview</option><option value="720p">720p · HD</option><option value="1080p">1080p · Full HD</option>
                  </select>
                </label>
              </div>
              {style === 'custom' ? <input aria-label="Custom visual style" value={customStyle} onChange={e => setCustomStyle(e.target.value)} placeholder="Describe your desired look" className="mt-3 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" /> : null}
              <div className="mt-4 border-t border-border pt-3">
                <label htmlFor="ms-brand-mode" className="mb-1 block text-sm font-medium">Brand identity</label>
                <select id="ms-brand-mode" data-testid="ms-brand-mode" value={brandMode} onChange={e => setBrandMode(e.target.value as MsBrandMode)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="none">No brand · AI decides</option><option value="project">Customize this video</option><option value="saved">Use saved Brand Kit</option>
                </select>
                {brandMode === 'saved' ? <div className="mt-3">
                  <select aria-label="Saved Brand Kit" data-testid="ms-brand-kit" value={brandKitId} onChange={e => setBrandKitId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Choose a saved brand</option>{brandKits.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                  {!brandKits.length ? <p className="mt-2 text-xs text-muted-foreground">Create a kit from “Customize this video” first.</p> : null}
                  {brandKitId ? <div className="mt-2 flex gap-2"><Button type="button" size="sm" variant="outline" onClick={editSavedBrand}>Edit Brand Kit</Button><Button type="button" size="sm" variant="outline" onClick={() => void deleteSavedBrand()}>Delete Brand Kit</Button></div> : null}
                </div> : null}
                {brandMode === 'project' ? <div className="mt-3 space-y-3">
                  <label className="flex flex-col gap-1 text-sm">Brand or channel name
                    <input data-testid="ms-brand-name" value={brandName} onChange={e => setBrandName(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3" placeholder="Optional" />
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {([['Primary',primaryColor,setPrimaryColor],['Secondary',secondaryColor,setSecondaryColor],['Accent',accentColor,setAccentColor]] as const).map(([label,value,update]) =>
                      <label key={label} className="flex flex-col gap-1 text-xs">{label}
                        <input type="color" aria-label={label + ' brand color'} value={value} onChange={e => update(e.target.value)} className="h-9 w-full cursor-pointer rounded border border-input bg-background p-1" />
                        <span className="font-mono text-[11px] text-muted-foreground">{value}</span>
                      </label>)}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">Typography
                      <input value={fontPreference} onChange={e => setFontPreference(e.target.value)} placeholder="Font or style" className="h-10 rounded-md border border-input bg-background px-3" />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">Brand personality
                      <input value={brandTone} onChange={e => setBrandTone(e.target.value)} placeholder="e.g. confident, warm" className="h-10 rounded-md border border-input bg-background px-3" />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">Consistency
                      <select value={consistency} onChange={e => setConsistency(e.target.value as MsBrandConsistency)} className="h-10 rounded-md border border-input bg-background px-3">
                        <option value="guided">Guided · original scenes</option><option value="strict">Strict brand rules</option><option value="creative">Creative freedom</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm">Logo placement
                      <select value={logoPlacement} onChange={e => setLogoPlacement(e.target.value as MsLogoPlacement)} className="h-10 rounded-md border border-input bg-background px-3">
                        <option value="ai_decides">AI decides</option><option value="intro">Intro</option><option value="outro">Outro</option><option value="watermark">Watermark</option><option value="none">Don't show</option>
                      </select>
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-sm">Brand guidelines
                    <Textarea rows={2} value={brandGuidelines} onChange={e => setBrandGuidelines(e.target.value)} placeholder="What should the AI respect or avoid?" />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => logoRef.current?.click()}>Upload logo</Button>
                    <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" className="hidden" onChange={e => { void selectLogo(e.target.files); e.target.value = '' }} />
                    {attachments.filter(a => a.role === 'logo').map(a => <span key={a.key} className="text-xs text-muted-foreground">{a.file.name}</span>)}
                    <Button type="button" variant="outline" size="sm" disabled={!brandName.trim() || savingBrand || uploading || client.mode !== 'live'} onClick={() => void saveBrand()}>{savingBrand ? 'Saving…' : editingBrandKitId ? 'Update Brand Kit' : 'Save as Brand Kit'}</Button>
                  </div>
                </div> : null}
              </div>
              <div className="mt-4 border-t border-border pt-3">
                <label htmlFor="ms-creative-notes" className="mb-1 block text-sm font-medium">Additional creative instructions</label>
                <Textarea id="ms-creative-notes" data-testid="ms-creative-notes" rows={2} value={creativeInstructions} onChange={e => setCreativeInstructions(e.target.value)} placeholder="Audience, mood, pacing, creative rules…" />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => referenceRef.current?.click()}>Add visual references</Button>
                  <input ref={referenceRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => { addFiles(e.target.files, 'reference'); e.target.value = '' }} />
                  <span className="text-xs text-muted-foreground">{attachments.filter(a => a.role === 'reference').length} reference files</span>
                </div>
              </div>
            </section>
            <div
              className="rounded-2xl border border-border bg-card shadow-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30"
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('Files')) e.preventDefault()
              }}
              onDrop={(e) => {
                e.preventDefault()
                addFiles(e.dataTransfer.files)
              }}
            >
              <label htmlFor="ms-prompt" className="sr-only">
                Describe your video
              </label>
              <Textarea
                id="ms-prompt"
                data-testid="ms-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={videoType === 'documentary' ? 'Describe your documentary topic, people, story arc and facts to verify…' : videoType === 'animated_ad' || videoType === 'video_ad' ? 'Describe your business, audience, product benefits and desired call to action…' : videoType === 'logo_animation' ? 'Describe how your logo should appear, move and reveal…' : videoType === 'product_demo' ? 'Describe the product and what its demo must show…' : MS_LABELS.promptPlaceholder}
                
                rows={4}
                className="min-h-28 resize-none border-0 bg-transparent px-4 pt-4 text-[15px] leading-6 shadow-none focus-visible:ring-0 dark:bg-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void start()
                }}
              />
              {workflow === 'script' ? (
                <div className="border-t border-border/70 px-4 py-3">
                  <label htmlFor="ms-script" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Script or narration (kept word for word)
                  </label>
                  <Textarea
                    id="ms-script"
                    data-testid="ms-script"
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    placeholder="Paste your script here, or attach a script or narration file."
                    rows={5}
                    className="min-h-28 text-sm"
                  />
                </div>
              ) : null}
              {attachments.length ? (
                <ul className="flex flex-col gap-2 border-t border-border/70 px-4 py-3" aria-label="Attachments" data-testid="ms-attachments">
                  {attachments.map((a) => (
                    <li key={a.key} className="relative">
                      <UploadProgressItem progress={a.progress} onCancel={() => removeAttachment(a.key)} onRetry={a.progress.state === 'error' ? () => void uploadOne(a) : undefined} />
                      <span className="pointer-events-none absolute top-3 right-12">
                        <Badge variant="outline" className="capitalize">{a.kind === 'audio' ? 'music / audio' : a.kind}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-3 py-2.5">
                <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} data-testid="ms-attach">
                  <Paperclip className="size-3.5" aria-hidden />
                  {MS_LABELS.attach}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => folderRef.current?.click()} aria-label="Add a folder">
                  <FolderOpen className="size-3.5" aria-hidden />
                  <span className="hidden sm:inline">Folder</span>
                </Button>
                <input ref={fileRef} type="file" multiple accept={MS_UPLOAD_ACCEPT} className="hidden" data-testid="ms-file-input" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
                <input ref={folderRef} type="file" multiple className="hidden" data-testid="ms-folder-input" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
                <div className="ml-auto flex items-center gap-2">
                  <span className="hidden text-xs text-muted-foreground md:inline">Optional · photos, video, music</span>
                  <Button onClick={() => void start()} disabled={!canStart} data-testid="ms-start" className="min-w-24">
                    {starting ? 'Starting…' : MS_LABELS.start}
                    {!starting ? <ArrowUp className="size-3.5" aria-hidden /> : null}
                  </Button>
                </div>
              </div>
            </div>

            <div role="radiogroup" aria-label="How do you want to start?" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {MS_WORKFLOWS.map((w) => {
                const Icon = MODE_ICON[w.id]
                const active = workflow === w.id
                return (
                  <button
                    key={w.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`ms-mode-${w.id}`}
                    onClick={() => setWorkflow(w.id)}
                    className={cn(
                      'group flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                      active ? 'border-primary/60 bg-primary/10' : 'border-border bg-card hover:bg-surface-raised',
                    )}
                  >
                    <span className={cn('grid size-8 place-items-center rounded-lg ring-1 ring-inset', active ? 'bg-primary text-primary-foreground ring-primary/30' : 'bg-muted text-muted-foreground ring-border')}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="text-sm font-medium">{w.label}</span>
                    <span className="text-xs leading-relaxed text-muted-foreground">{w.description}</span>
                  </button>
                )
              })}
            </div>

            <p className="text-center text-sm text-muted-foreground" data-testid="ms-selected-workflow" aria-live="polite">
              {selectedWorkflowLine(workflow, { uploads: ready.length })}
            </p>
            {/* ST-UI-107: the "Where should we get the media?" picker stays hidden in v1 (mediaPolicy = uploads_only). */}
            {mediaPickerEnabled ? <MediaSourcePicker /> : null}
            {error ? <InlineError message={error} onDismiss={() => setError(null)} /> : null}
          </section>
        ) : (
          <>
            <section className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-8 shadow-xs md:px-10 md:py-10" aria-labelledby="ms-landing-title" data-testid="ms-landing">
              <div className="flex max-w-2xl flex-col gap-3">
                <p className="text-xs font-medium text-primary">Original video production</p>
                <h2 id="ms-landing-title" className="text-2xl font-semibold tracking-tight text-balance">Original videos from an idea, a script, or your footage.</h2>
                <p className="text-sm leading-relaxed text-muted-foreground" data-testid="ms-vision">{MOTION_STUDIO_VISION}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link href={MOTION_STUDIO_NEW_ROUTE} className={buttonVariants({ size: 'lg' })} data-testid="ms-landing-cta">
                    <Plus className="size-4" aria-hidden />
                    New video
                  </Link>
                </div>
              </div>
            </section>
            <ProjectsList projects={projects} error={projectsError} errorStatus={projectsErrorStatus} onRetry={() => void loadProjects()} onNew={() => router.push(MOTION_STUDIO_NEW_ROUTE)} />
          </>
        )}
      </div>
    </div>
  )
}

/** Later (Media Researcher). Rendered only behind the flag; v1 always sends uploads_only. */
function MediaSourcePicker() {
  const [value, setValue] = useState<MsMediaPolicy>('auto_plus_uploads')
  return (
    <fieldset className="flex flex-col gap-2" data-testid="ms-media-picker">
      <legend className="mb-1 text-sm font-medium">Where should we get the media?</legend>
      {(Object.keys(MS_MEDIA_POLICY_LABELS) as MsMediaPolicy[]).map((k) => (
        <label key={k} className="flex items-center gap-2 text-sm">
          <input type="radio" name="ms-media-policy" checked={value === k} onChange={() => setValue(k)} className="accent-[var(--primary)]" />
          {MS_MEDIA_POLICY_LABELS[k]}
        </label>
      ))}
    </fieldset>
  )
}

function ProjectsList({ projects, error, errorStatus, onRetry, onNew }: { projects: MsProjectSummary[] | null; error: string | null; errorStatus?: number | null; onRetry: () => void; onNew: () => void }) {
  if (error)
    return (
      <div data-testid="ms-projects-error" data-status={errorStatus ?? undefined}>
        <InlineError
          message={error}
          action={
            errorStatus === 401 ? (
              <Button size="xs" variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
            ) : (
              <Button size="xs" variant="outline" onClick={onRetry}>Retry</Button>
            )
          }
        />
      </div>
    )
  if (!projects)
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-video animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
        ))}
      </div>
    )
  if (!projects.length)
    return <EmptyState icon={Clapperboard} title="No videos yet" description="Start with an idea, a script, or your footage." action={<Button onClick={onNew}>New video</Button>} />
  return (
    <section aria-labelledby="ms-projects-title" className="flex flex-col gap-4">
      <h2 id="ms-projects-title" className="text-section-title">{MS_LABELS.myProjects}</h2>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4" data-testid="ms-projects">
        {projects.map((p) => (
          <li key={p.id} className="relative">
            <Link
              href={`${MOTION_STUDIO_ROUTE}/${encodeURIComponent(p.id)}`}
              prefetch
              aria-label={`Open ${p.title}${p.isExample ? ' (example project)' : ''}`}
              data-testid="ms-project-card"
              className="group relative isolate flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-foreground/20 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {/* Decorative layers never take pointer events, so the whole card is the link target. */}
              <div className="pointer-events-none relative aspect-video overflow-hidden bg-panel">
                {p.thumbnailUrl ? (
                  <img src={p.thumbnailUrl} alt="" className="size-full object-cover" draggable={false} />
                ) : (
                  <MotionPoster kind={p.posterKind ?? (p.workflow === 'footage' ? 'footage' : 'text')} seed={p.id} title={p.title} eyebrow="Motion Studio" showCaption={false} className="transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none" />
                )}
                <Badge variant="onMedia" className="absolute right-2 bottom-2 font-mono tabular-nums">{formatClock(p.durationMs)}</Badge>
                {p.isExample ? (
                  <Badge variant="onMedia" className="absolute top-2 left-2">{MS_LABELS.exampleProject}</Badge>
                ) : null}
              </div>
              <div className="pointer-events-none flex flex-col gap-1.5 p-3">
                <p className="truncate text-sm font-medium" title={p.title}>{p.title}</p>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">{p.sceneCount ? `${p.sceneCount} scenes` : 'Not planned yet'} · {relativeTime(p.updatedAt)}</span>
                  <StatusBadge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</StatusBadge>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
