'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react'
import { useRouter } from 'next/navigation'
import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { uploadClipFile, type UploadProgress } from '@/lib/clips/upload'
import type { EditorMedia } from '@/lib/server/clips/clip-detail'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { TemplateAsset } from '@/lib/clips/real-video-templates/sequence-contract'
import type { VideoTemplateRelease } from '@/lib/clips/real-video-templates/gallery'
import { assignSelectionInOrder, fillProgress, materializeStudioDraft, moveSelection,
  newStudioDraft, type StudioDraft, type StudioSlotFill } from '@/lib/clips/real-video-templates/slot-workflow'

type Project = { id: string; status: string; version: number; draft: StudioDraft; clipId: string | null; editsSaveVersion?: number }
type MediaItem = { asset: TemplateAsset; label: string; durationMs: number | null;
  width: number | null; height: number | null; url: string | null; available: boolean }
type MediaPage = { items: MediaItem[]; page: number; pages: number; total: number }
type ClipDetail = {
  clip: { editsSaveVersion: number }
  edits: ClipEditsV2
  mediaUrls: { source: string | null; proxy: string | null; preview: string | null; poster: string | null }
  media: EditorMedia | null
  crop: { track: ComponentProps<typeof PreviewStage>['cropTrack'] }
}
type RenderJob = { id: string; status: string; progress: number | null; phase: string | null;
  error: string | null; downloadUrl: string | null; filename: string | null }
const inputClass = 'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'
const buttonClass = 'rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50'
const primaryClass = 'rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
function readable(error: unknown, fallback = 'Something went wrong') {
  return error instanceof Error ? error.message : fallback
}
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, { method,
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    cache: 'no-store' })
  const json = await response.json() as { data?: T; error?: string }
  if (!response.ok || !json.data) throw new Error(json.error || 'Request failed (' + response.status + ')')
  return json.data
}
/** Capture an actual frame, then upload it as an independent workspace-owned still. */
async function frameHoldFile(url: string, holdAtMs: number): Promise<File> {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true
  video.src = url
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Could not load source video for frame hold'))
    })
    video.currentTime = Math.max(0, Math.min(video.duration - 0.04, (holdAtMs - 40) / 1000))
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve()
      video.onerror = () => reject(new Error('Could not seek source video'))
    })
    const width = video.videoWidth || 0
    const height = video.videoHeight || 0
    if (!width || !height) throw new Error('Video has no usable frame')
    const scale = Math.min(1, 1280 / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(2, Math.round(width * scale))
    canvas.height = Math.max(2, Math.round(height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Frame capture is unavailable')
    try { ctx.drawImage(video, 0, 0, canvas.width, canvas.height) } catch {
      throw new Error('Media storage prevents frame capture; choose Loop or another clip')
    }
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      result => result ? resolve(result) : reject(new Error('Frame capture failed')), 'image/png'))
    return new File([blob], 'template-last-frame.png', { type: 'image/png' })
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
}

export function VideoTemplateStudio({ release, initialProjectId }: {
  release: VideoTemplateRelease
  initialProjectId?: string | null
}) {
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const projectRef = useRef<Project | null>(null)
  const [draft, setDraft] = useState<StudioDraft | null>(null)
  const draftRef = useRef<StudioDraft | null>(null)
  const [media, setMedia] = useState<MediaPage>({ items: [], total: 0, page: 1, pages: 1 })
  const [mediaSearch, setMediaSearch] = useState('')
  const [mediaKind, setMediaKind] = useState<'all' | 'video' | 'image' | 'audio'>('all')
  const [selectedSlot, setSelectedSlot] = useState(release.family.slots[0]?.id ?? '')
  const [selectedUploads, setSelectedUploads] = useState<TemplateAsset[]>([])
  const [selectedAudio, setSelectedAudio] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadProgress | null>(null)
  const [clip, setClip] = useState<ClipDetail | null>(null)
  const [sourceUrls, setSourceUrls] = useState<Record<string, string>>({})
  const [render, setRender] = useState<RenderJob | null>(null)
  const [clockMs, setClockMs] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)
  const dirtyRef = useRef(false)
  const versionRef = useRef(0)
  const editsVersionRef = useRef(0)
  const saveLock = useRef<Promise<void> | null>(null)
  const initKey = useRef<string | null>(null)
  const history = useRef<StudioDraft[]>([])
  const future = useRef<StudioDraft[]>([])
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const setCurrentProject = (value: Project | null) => { projectRef.current = value; setProject(value) }
  const setCurrentDraft = (value: StudioDraft | null) => { draftRef.current = value; setDraft(value) }
  const commitDraft = (value: StudioDraft) => {
    const previous = draftRef.current
    if (previous) history.current = [...history.current.slice(-49), previous]
    future.current = []
    setCurrentDraft(value)
    dirtyRef.current = true
    setDirty(true)
    setNotice('Unsaved changes')
  }
  const undo = () => {
    const previous = history.current.pop()
    const current = draftRef.current
    if (!previous || !current) return
    future.current.push(current)
    setCurrentDraft(previous)
    dirtyRef.current = true; setDirty(true)
  }
  const redo = () => {
    const next = future.current.pop()
    const current = draftRef.current
    if (!next || !current) return
    history.current.push(current)
    setCurrentDraft(next)
    dirtyRef.current = true; setDirty(true)
  }
  const refreshMedia = useCallback(async (page = 1, q = '', kind = 'all') => {
    const params = new URLSearchParams({ page: String(page) })
    if (q.trim()) params.set('q', q.trim())
    if (kind !== 'all') params.set('kind', kind)
    const result = await request<MediaPage>('/api/clips/video-templates/media?' + params.toString())
    setMedia(result)
    return result
  }, [])
  const refreshClip = useCallback(async (value: Project) => {
    if (!value.clipId || value.status !== 'READY') return
    const [detail, projectMedia] = await Promise.all([
      request<ClipDetail>('/api/clips/clips/' + encodeURIComponent(value.clipId)),
      request<{ items: Array<{ refId: string; url: string | null }> }>(
        '/api/clips/projects/' + encodeURIComponent(value.id) + '/library'),
    ])
    const urls: Record<string, string> = {}
    for (const item of projectMedia.items) if (item.url) urls[item.refId] = item.url
    setSourceUrls(urls)
    setClip(detail)
    editsVersionRef.current = detail.clip.editsSaveVersion
    setCurrentProject({ ...value, editsSaveVersion: detail.clip.editsSaveVersion })
  }, [])
  useEffect(() => {
    let live = true
    void refreshMedia().catch(e => live && setError(readable(e, 'Could not load workspace media')))
    const start = async () => {
      try {
        let saved: Project
        if (initialProjectId) {
          saved = await request<Project>('/api/clips/video-templates/drafts/' + encodeURIComponent(initialProjectId))
        } else {
          const key = initKey.current ?? ('draft_' + crypto.randomUUID().replaceAll('-', ''))
          initKey.current = key
          saved = await request<Project>('/api/clips/video-templates/drafts', 'POST',
            { releaseId: release.id, idempotencyKey: key })
        }
        if (!live) return
        versionRef.current = saved.version
        setCurrentProject(saved)
        setCurrentDraft(saved.draft)
        if (!initialProjectId) router.replace(
          '/app/clips/video-templates/' + encodeURIComponent(release.id) + '?draft=' + encodeURIComponent(saved.id))
        if (saved.status === 'READY' && saved.clipId) await refreshClip(saved)
      } catch (e) { if (live) setError(readable(e, 'Could not resume template')) }
    }
    void start()
    return () => { live = false }
  }, [initialProjectId, release.id, refreshMedia, refreshClip, router])
  useEffect(() => {
    if (!project || project.status === 'DRAFT' || project.status === 'READY' || project.status === 'CANCELED') return
    const timer = window.setInterval(() => {
      void request<Project>('/api/clips/video-templates/drafts/' + encodeURIComponent(project.id))
        .then(next => {
          if (!projectRef.current || projectRef.current.id !== next.id) return
          setCurrentProject({ ...next, draft: draftRef.current ?? next.draft })
          if (next.status === 'READY') void refreshClip(next).catch(e => setError(readable(e)))
        }).catch(e => setError(readable(e)))
    }, 4000)
    return () => window.clearInterval(timer)
  }, [project?.id, project?.status, refreshClip])
  const saveNow = useCallback(async (): Promise<void> => {
    if (saveLock.current) { await saveLock.current; return }
    const value = draftRef.current, state = projectRef.current
    if (!dirtyRef.current || !state || !value || state.status === 'QUEUED') return
    if (state.status !== 'DRAFT' && (state.status !== 'READY' || !clip)) return
    const snapshot = value
    const action = (async () => {
      const url = '/api/clips/video-templates/drafts/' + encodeURIComponent(state.id)
      const response = state.status === 'DRAFT'
        ? await request<Project>(url, 'PATCH', { expectedVersion: versionRef.current, draft: snapshot })
        : await request<{ version: number; editsSaveVersion: number }>(url + '/studio', 'PATCH',
          { expectedVersion: versionRef.current, expectedEditsSaveVersion: editsVersionRef.current, draft: snapshot })
      const newVersion = response.version
      versionRef.current = newVersion
      if ('editsSaveVersion' in response && typeof response.editsSaveVersion === 'number')
        editsVersionRef.current = response.editsSaveVersion
      const savedProject = projectRef.current
      if (savedProject) setCurrentProject({ ...savedProject, version: newVersion,
        editsSaveVersion: editsVersionRef.current })
      if (draftRef.current === snapshot) {
        dirtyRef.current = false
        setDirty(false)
        setNotice('Saved in your workspace')
      }
      if (state.status === 'READY' && projectRef.current) await refreshClip(projectRef.current)
    })()
    saveLock.current = action
    try { await action } finally { saveLock.current = null }
  }, [clip, refreshClip])
  useEffect(() => {
    if (!dirty || !project || (project.status !== 'DRAFT' && project.status !== 'READY')) return
    const timer = window.setTimeout(() => {
      void saveNow().catch(e => { setError(readable(e)); setNotice('Save failed') })
    }, 700)
    return () => window.clearTimeout(timer)
  }, [draft, dirty, project?.id, project?.status, saveNow])
  useEffect(() => {
    if (!render || (render.status !== 'QUEUED' && render.status !== 'RENDERING')) return
    const timer = window.setInterval(() => {
      void request<RenderJob>('/api/clips/renders/' + encodeURIComponent(render.id))
        .then(setRender).catch(e => setError(readable(e)))
    }, 3000)
    return () => window.clearInterval(timer)
  }, [render?.id, render?.status])
  const uploadFiles = async (files: File[]) => {
    if (!files.length) return
    setBusy(true);setError('')
    const ids: TemplateAsset[] = []
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/'))
          throw new Error('Select photos, video clips or audio files')
        const result = await uploadClipFile(file, setUploadStatus, { kind: 'media' })
        const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'video'
        ids.push({ id: result.uploadId, kind,
          license: { id: 'user_owned', provenance: 'user-owned', reference: 'workspace_upload' } })
      }
      const all = await refreshMedia(1, '', 'all')
      const withMeta = ids.map(item => all.items.find(a => a.asset.id === item.id)?.asset ?? item)
      setSelectedUploads(prev => [...prev, ...withMeta])
      setNotice(withMeta.length + ' files uploaded. Place them in the numbered slots.')
    } catch (e) { setError(readable(e, 'Upload failed — retry or choose a different file')) }
    finally { setBusy(false);setUploadStatus(null) }
  }
  const fillSlot = (id: string, asset: TemplateAsset) => {
    if (!draft) return
    const slot = release.family.slots.find(s => s.id === id)
    if (!slot || asset.kind === 'audio' || (slot.media !== 'either' && slot.media !== asset.kind)) {
      setError('The selected file does not match the required slot media type')
      return
    }
    const fill: StudioSlotFill = { asset, sourceInFrame: slot.handles?.headFrames ?? 0,
      fit: slot.fit, muteSourceAudio: slot.sourceAudio === 'mute',
      focalX: 50, focalY: 50, remedy: 'replace' }
    commitDraft({ ...draft, slots: { ...draft.slots, [id]: fill } })
    setNotice('Slot ' + slot.ordinal + ' updated without changing adjacent slots.')
  }
  const autoFill = () => {
    if (!draft) return
    const { draft: updated, used, rejected } = assignSelectionInOrder(draft, release.family,
      selectedUploads.filter(item => item.kind !== 'audio'))
    if (used) commitDraft(updated)
    setSelectedUploads(rejected)
    setNotice(used + ' slots filled in selection order' + (rejected.length ? '; ' + rejected.length + ' files not assigned' : ''))
  }
  const patchFill = (id: string, changes: Partial<StudioSlotFill>) => {
    if (!draft?.slots[id]) return
    commitDraft({ ...draft, slots: { ...draft.slots, [id]: { ...draft.slots[id]!, ...changes } } })
  }
  const createHold = async (id: string) => {
    const fill = draft?.slots[id]
    const source = media.items.find(x => x.asset.id === fill?.asset.id)
    if (!fill || !source?.url || !source.durationMs) { setError('Selected video must be accessible to capture a still'); return }
    setBusy(true);setError('')
    try {
      const slot = release.family.slots.find(s => s.id === id)!
      const speed = slot.speed ?? 1
      const visible = Math.floor(((fill.asset.durationFrames ?? 0) - fill.sourceInFrame -
        (slot.handles?.tailFrames ?? 0)) / speed)
      if (!visible || visible < 3) throw new Error('Not enough video frames for a hold')
      const still = await frameHoldFile(source.url, Math.round((fill.sourceInFrame +
        Math.min(slot.durationFrames - 3, visible) * speed) * 1000 / 30))
      const created = await uploadClipFile(still, setUploadStatus, { kind: 'media' })
      patchFill(id, { holdAsset: {
        id: created.uploadId, kind: 'image',
        license: { id: 'user_owned', provenance: 'user-owned', reference: 'workspace_upload' },
      }, remedy: 'hold' })
      await refreshMedia()
    } catch (e) { setError(readable(e)) }
    finally { setBusy(false);setUploadStatus(null) }
  }
  const publish = async () => {
    if (!project || !draft) return
    setBusy(true);setError('')
    try {
      materializeStudioDraft(release.family, draft, 'preview_instance')
      await saveNow()
      const result = await request<{ projectId: string; clipId: string; status: string }>(
        '/api/clips/video-templates/drafts/' + encodeURIComponent(project.id) + '/publish', 'POST')
      setCurrentProject({ ...project, status: result.status, clipId: result.clipId, draft, version: versionRef.current })
      setNotice('Project created. The template carrier is preparing for frame-accurate preview and export.')
    } catch (e) { setError(readable(e, 'Could not prepare template')) }
    finally { setBusy(false) }
  }
  const doExport = async () => {
    const state = projectRef.current
    if (!state?.clipId || state.status !== 'READY') return
    setBusy(true);setError('')
    try {
      await saveNow()
      const result = await request<{ renderId: string; status: string; downloadUrl?: string | null }>(
        '/api/clips/clips/' + encodeURIComponent(state.clipId) + '/export', 'POST', {
          resolution: '720p', aspect: release.family.aspects[0], format: 'mp4',
        })
      const job = await request<RenderJob>('/api/clips/renders/' + encodeURIComponent(result.renderId))
      setRender(job)
    } catch (e) { setError(readable(e, 'Export could not start')) }
    finally { setBusy(false) }
  }
  const cancelQueuedRender = async () => {
    if (!render || render.status !== 'QUEUED') return
    setBusy(true);setError('')
    try {
      await request<{ canceled: boolean }>('/api/clips/renders/' + encodeURIComponent(render.id) + '/cancel', 'POST')
      setRender({ ...render, status: 'FAILED', error: 'Canceled before render started' })
    } catch (e) { setError(readable(e)) } finally { setBusy(false) }
  }
  const retryRender = async () => {
    if (!render) return
    setBusy(true);setError('')
    try {
      await request<unknown>('/api/clips/renders/' + encodeURIComponent(render.id) + '/retry', 'POST')
      setRender({ ...render, status: 'QUEUED', error: null, progress: 0 })
    } catch (e) { setError(readable(e)) } finally { setBusy(false) }
  }
  const cancelProject = async () => {
    if (!project) return
    setBusy(true)
    try {
      if (project.status === 'DRAFT') {
        await request<{ discarded: boolean }>('/api/clips/video-templates/drafts/' + encodeURIComponent(project.id), 'DELETE')
      } else {
        await request<{ canceled: boolean }>('/api/clips/projects/' + encodeURIComponent(project.id) + '/template-instance', 'DELETE')
      }
      router.push('/app/clips/video-templates')
    } catch (e) { setError(readable(e)) } finally { setBusy(false) }
  }
  const progress = draft ? fillProgress(release.family, draft) : { filled: 0, total: release.family.slots.length }
  const activeSlot = release.family.slots.find(s => s.id === selectedSlot)
  const activeFill = activeSlot && draft?.slots[activeSlot.id]
  const activeMedia = media.items.find(m => m.asset.id === activeFill?.asset.id)
  const ready = project?.status === 'READY' && Boolean(clip && project.clipId)
  const canPublish = progress.filled === progress.total && project?.status === 'DRAFT' && !busy
  return (
    <div className="mx-auto max-w-[1560px] space-y-5 px-4 py-6 sm:px-6" data-testid="video-template-studio">
      <nav className="text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link className="hover:underline" href="/app/clips/video-templates">Video templates</Link>
        <span aria-hidden="true"> / </span>{release.title}
      </nav>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">{release.category} · {release.family.aspects.join(', ')}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{release.title}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{release.description}</p>
          <p className="text-xs text-muted-foreground">{release.family.totalFrames / 30}s · {release.family.slots.length} media slots · {release.family.texts.length} text fields</p>
          <p className="text-xs text-muted-foreground">Music and demo rights: {release.rights}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={!history.current.length || busy} onClick={undo} aria-label="Undo template change">Undo</button>
          <button type="button" className={buttonClass} disabled={!future.current.length || busy} onClick={redo} aria-label="Redo template change">Redo</button>
          <button type="button" className={buttonClass} disabled={!dirty || busy} onClick={() => void saveNow().catch(e => setError(readable(e)))}>Save</button>
          <span className="self-center text-xs text-muted-foreground" role="status">{notice || (project ? 'Workspace draft' : 'Creating project draft…')}</span>
        </div>
      </header>
      {error && <div role="alert" className="rounded-xl border border-destructive/50 p-3 text-sm text-destructive">
        {error}
        <button type="button" className="ml-3 underline" onClick={() => setError('')}>Dismiss</button>
      </div>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(330px,0.8fr)]">
        <section className="space-y-4">
          <div className="overflow-hidden rounded-2xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Template preview</h2>
              <span className="text-xs text-muted-foreground">{ready ? 'Shared editor/worker frame mapping' : 'Source review'}</span>
            </div>
            {ready && clip ? <>
              <PreviewStage clipId={project?.clipId} edits={clip.edits} videoUrl={clip.mediaUrls.source ?? clip.mediaUrls.proxy}
                posterUrl={clip.mediaUrls.poster} media={clip.media} cropTrack={clip.crop.track}
                words={[]} videoRef={videoRef} sourceUrls={sourceUrls}
                onTick={tick => setClockMs(tick.outputMs)} />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" className={buttonClass} onClick={() => void videoRef.current?.play()}>Play</button>
                <button type="button" className={buttonClass} onClick={() => videoRef.current?.pause()}>Pause</button>
                <input aria-label="Seek template preview" type="range" className="min-w-36 flex-1" min={0}
                  max={release.family.totalFrames * 1000 / 30} value={Math.min(clockMs, release.family.totalFrames * 1000 / 30)}
                  onChange={e => { if (videoRef.current) videoRef.current.currentTime = Number(e.target.value) / 1000 }} />
                <span className="text-xs tabular-nums">{(clockMs / 1000).toFixed(1)}s</span>
              </div>
            </> : <>
              <div className="relative mx-auto flex aspect-[9/16] max-h-[460px] w-full max-w-sm items-center justify-center overflow-hidden rounded-xl bg-black">
                {activeMedia?.url ? (activeMedia.asset.kind === 'image'
                  ? <img src={activeMedia.url} alt={activeMedia.label} className="h-full w-full object-cover"
                      style={{ objectPosition: (activeFill?.focalX ?? 50) + '% ' + (activeFill?.focalY ?? 50) + '%' }} />
                  : <video key={activeMedia.asset.id} src={activeMedia.url} controls playsInline muted
                      className="h-full w-full object-contain" preload="metadata" />)
                  : <div className="p-6 text-center text-sm text-white/70">
                      {project?.status === 'QUEUED' ? 'Preparing the exact-frame preview…' :
                        'Select a slot to inspect its photo or video. The full composed preview is prepared after filling the slots.'}
                    </div>}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Source review is not the final render. After selecting all slots, Prepare preview creates a new project and uses the established ClipEditsV2 preview/export path.
              </p>
            </>}
          </div>
          <section className="space-y-3 rounded-2xl border bg-card p-4" aria-label="Template slots">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Fill numbered slots</h2>
              <span role="status" className="text-xs tabular-nums">{progress.filled} of {progress.total} filled</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full bg-primary transition-all" style={{ width: (progress.total ? 100 * progress.filled / progress.total : 0) + '%' }} />
            </div>
            <div className="grid max-h-[430px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="group" aria-label="Select a template slot">
              {release.family.slots.map(slot => {
                const fill = draft?.slots[slot.id]
                return <button key={slot.id} type="button" aria-pressed={selectedSlot === slot.id}
                  className={'flex items-center gap-3 rounded-xl border p-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ' +
                    (selectedSlot === slot.id ? 'border-primary bg-primary/10' : 'border-border')}
                  onClick={() => { setSelectedSlot(slot.id); setSelectedAudio(false) }}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted font-semibold tabular-nums">{slot.ordinal}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{fill ? 'Filled · ' + fill.asset.id : slot.role}</span>
                    <span className="block text-xs text-muted-foreground">{slot.media} · {(slot.durationFrames / 30).toFixed(1)}s</span></span>
                  <span className={'size-2 rounded-full ' + (fill ? 'bg-emerald-500' : 'bg-muted-foreground/40')} aria-label={fill ? 'Filled' : 'Empty'} />
                </button>
              })}
            </div>
          </section>
          <section className="space-y-3 rounded-2xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Text and appearance</h2>
            {release.family.texts.map(text => <label key={text.id} className="block space-y-1 text-xs font-medium">
              {text.id} · maximum {text.maxChars} characters
              <input className={inputClass} maxLength={text.maxChars}
                value={draft?.texts[text.id] ?? text.defaultText}
                onChange={e => draft && commitDraft({ ...draft, texts: { ...draft.texts, [text.id]: e.target.value } })} />
            </label>)}
            <label className="flex flex-wrap items-center gap-3 text-xs font-medium">Brand accent
              <input aria-label="Brand accent color" type="color" value={draft?.brandColor ?? '#ffffff'}
                onChange={e => draft && commitDraft({ ...draft, brandColor: e.target.value })} />
              <span className="text-muted-foreground">Updates authored text and graphic colors</span>
            </label>
            <h3 className="pt-2 text-sm font-semibold">Music</h3>
            <p className="text-xs text-muted-foreground">{release.design.musicPolicy === 'none'
              ? 'This template has no music track.' : 'Choose a workspace-owned audio recording. Keep timing preserves the authored beat-cut schedule.'}</p>
            {release.design.musicPolicy !== 'none' && <>
              <button type="button" className={buttonClass} onClick={() => { setSelectedAudio(true);setMediaKind('audio');void refreshMedia(1,'','audio') }}>Choose approved music</button>
              {draft?.music && <button type="button" className={buttonClass}
                onClick={() => commitDraft({ ...draft, music: undefined })}>Remove music ({draft.music.id})</button>}
              <label className="block space-y-1 text-xs">Music timing
                <select className={inputClass} value="keep" disabled>
                  <option value="keep">Keep existing cuts and timing</option>
                </select>
                <span className="text-muted-foreground">Re-sync requires a verified beat map and is not available yet.</span>
              </label>
            </>}
          </section>
        </section>
        <aside className="space-y-4">
          <section className="space-y-3 rounded-2xl border bg-card p-4">
            <h2 className="text-sm font-semibold">{selectedAudio ? 'Select music' : 'Media for slot ' + (activeSlot?.ordinal ?? 1)}</h2>
            {activeSlot && !selectedAudio && <>
              <p className="text-xs text-muted-foreground">Accepts {activeSlot.media} · {(activeSlot.durationFrames / 30).toFixed(1)} seconds · Source audio: {activeSlot.sourceAudio}</p>
              {activeFill && <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-xs">Fit
                    <select className={inputClass} value={activeFill.fit}
                      onChange={e => patchFill(activeSlot.id, { fit: e.target.value as 'cover' | 'contain' })}>
                      <option value="cover">Cover</option><option value="contain">Contain</option>
                    </select>
                  </label>
                  {activeFill.asset.kind === 'video' && <label className="space-y-1 text-xs">Trim start (seconds)
                    <input type="number" className={inputClass} min={0} step={1 / 30}
                      value={(activeFill.sourceInFrame / 30).toFixed(2)}
                      onChange={e => patchFill(activeSlot.id, { sourceInFrame: Math.max(0, Math.round(Number(e.target.value) * 30)) })} />
                  </label>}
                </div>
                <label className="block space-y-1 text-xs">Focal point X · {activeFill.focalX}%
                  <input type="range" min={0} max={100} value={activeFill.focalX} className="w-full"
                    onChange={e => patchFill(activeSlot.id, { focalX: Number(e.target.value) })} />
                </label>
                <label className="block space-y-1 text-xs">Focal point Y · {activeFill.focalY}%
                  <input type="range" min={0} max={100} value={activeFill.focalY} className="w-full"
                    onChange={e => patchFill(activeSlot.id, { focalY: Number(e.target.value) })} />
                </label>
                {activeFill.asset.kind === 'video' && <>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={activeFill.muteSourceAudio}
                      onChange={e => patchFill(activeSlot.id, { muteSourceAudio: e.target.checked })} />
                    Mute source clip audio
                  </label>
                  <label className="block space-y-1 text-xs">If this clip is too short
                    <select className={inputClass} value={activeFill.remedy}
                      onChange={e => patchFill(activeSlot.id, { remedy: e.target.value as StudioSlotFill['remedy'] })}>
                      <option value="replace">Choose another video</option>
                      <option value="loop">Loop full source (visible hard cuts)</option>
                      <option value="hold">Hold the final frame</option>
                    </select>
                  </label>
                  {activeFill.remedy === 'hold' && <button type="button" className={buttonClass} disabled={busy}
                    onClick={() => void createHold(activeSlot.id)}>
                    {activeFill.holdAsset ? 'Recapture last frame' : 'Capture and upload last frame'}
                  </button>}
                </>}
                <button type="button" className={buttonClass}
                  onClick={() => { const next = { ...draft!.slots };delete next[activeSlot.id];commitDraft({ ...draft!, slots: next }) }}>
                  Clear selected slot
                </button>
              </>}
            </>}
          </section>
          <section className="space-y-3 rounded-2xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Upload or choose workspace media</h2>
            <label className="block cursor-pointer rounded-xl border border-dashed border-primary/40 p-4 text-center text-sm hover:bg-primary/5">
              Select photos, clips or music
              <input className="sr-only" type="file" accept="image/*,video/*,audio/*" multiple
                disabled={busy} onChange={e => { const chosen = Array.from(e.target.files ?? []);e.target.value = '';void uploadFiles(chosen) }} />
            </label>
            {uploadStatus && <div role="status" className="text-xs text-muted-foreground">
              {uploadStatus.filename}: {uploadStatus.percent}% · {uploadStatus.state}
            </div>}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <label className="sr-only" htmlFor="video-template-media-search">Search media</label>
              <input id="video-template-media-search" className={inputClass} placeholder="Search uploaded files"
                value={mediaSearch} onChange={e => setMediaSearch(e.target.value)} />
              <button type="button" className={buttonClass} onClick={() => void refreshMedia(1,mediaSearch,mediaKind).catch(e => setError(readable(e)))}>Search</button>
            </div>
            <label className="sr-only" htmlFor="video-template-media-kind">Media type</label>
            <select id="video-template-media-kind" className={inputClass} value={mediaKind}
              onChange={e => { const value=e.target.value as typeof mediaKind;setMediaKind(value);void refreshMedia(1,mediaSearch,value) }}>
              <option value="all">All workspace files</option><option value="video">Video</option>
              <option value="image">Photos</option><option value="audio">Audio</option>
            </select>
            <ul className="max-h-[330px] space-y-2 overflow-y-auto" aria-label="Workspace media">
              {media.items.map(item => <li key={item.asset.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.label}</span>
                  <span className="text-muted-foreground">{item.asset.kind} · {item.durationMs ? (item.durationMs / 1000).toFixed(1) + 's' : 'still'}{!item.available ? ' · unavailable' : ''}</span>
                </span>
                <button type="button" className={buttonClass} disabled={!item.available || busy}
                  aria-label={'Use ' + item.label} onClick={() => {
                    if (item.asset.kind === 'audio' || selectedAudio) {
                      if (item.asset.kind !== 'audio') { setError('Select an audio file');return }
                      if (draft && release.design.musicPolicy !== 'none') commitDraft({ ...draft, music: item.asset })
                    } else fillSlot(selectedSlot, item.asset)
                  }}>Use</button>
                <button type="button" className={buttonClass} disabled={!item.available || busy}
                  aria-label={'Add ' + item.label + ' to selection'}
                  onClick={() => setSelectedUploads(prev => [...prev, item.asset])}>Queue</button>
              </li>)}
            </ul>
            <div className="flex items-center justify-between text-xs">
              <button type="button" className={buttonClass} disabled={media.page === 1}
                onClick={() => void refreshMedia(media.page - 1,mediaSearch,mediaKind)}>Previous</button>
              <span>Page {media.page} of {media.pages} · {media.total} files</span>
              <button type="button" className={buttonClass} disabled={media.page >= media.pages}
                onClick={() => void refreshMedia(media.page + 1,mediaSearch,mediaKind)}>Next</button>
            </div>
            {selectedUploads.length > 0 && <div className="space-y-2">
              <h3 className="text-xs font-semibold">Ordered selection ({selectedUploads.length})</h3>
              <ol className="max-h-36 space-y-1 overflow-y-auto">
                {selectedUploads.map((item, index) => <li key={index} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2 py-1 text-xs">
                  <span className="truncate">{index + 1}. {item.id}</span>
                  <div className="flex gap-1">
                    <button type="button" className={buttonClass} aria-label={'Move selected file ' + (index+1) + ' up'} disabled={!index}
                      onClick={() => setSelectedUploads(a => moveSelection(a,index,index-1))}>↑</button>
                    <button type="button" className={buttonClass} aria-label={'Move selected file ' + (index+1) + ' down'} disabled={index === selectedUploads.length-1}
                      onClick={() => setSelectedUploads(a => moveSelection(a,index,index+1))}>↓</button>
                    <button type="button" className={buttonClass} aria-label={'Remove selected file ' + (index+1)}
                      onClick={() => setSelectedUploads(a => a.filter((_,i)=>i!==index))}>×</button>
                  </div>
                </li>)}
              </ol>
              <button type="button" className={primaryClass} disabled={!draft || busy} onClick={autoFill}>
                Autofill empty slots in this order
              </button>
            </div>}
          </section>
          <section className="space-y-3 rounded-2xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Project and export</h2>
            <p className="text-xs text-muted-foreground">A template always creates a separate project. Existing clip timelines are never replaced.</p>
            <p className="text-xs">Project status: <strong>{project?.status ?? 'Creating draft'}</strong></p>
            {project?.status === 'DRAFT' && <button type="button" className={primaryClass}
              disabled={!canPublish || dirty && busy} onClick={() => void publish()}>Prepare full preview and project</button>}
            {ready && <button type="button" className={primaryClass} disabled={busy}
              onClick={() => void doExport()}>Save and export video · 720p</button>}
            {render && <div className="space-y-2 rounded-xl border p-3" role="status">
              <p className="text-xs font-medium">Render {render.status}{render.progress != null ? ' · ' + render.progress + '%' : ''}</p>
              {render.phase && <p className="text-xs text-muted-foreground">{render.phase}</p>}
              {render.error && <p className="text-xs text-destructive">{render.error}</p>}
              {render.downloadUrl && render.status === 'READY' && <a className={primaryClass} href={render.downloadUrl} download={render.filename ?? undefined}>Download video</a>}
              {render.status === 'QUEUED' && <button type="button" className={buttonClass} disabled={busy}
                onClick={() => void cancelQueuedRender()}>Cancel queued render</button>}
              {render.status === 'RENDERING' && <p className="text-xs text-muted-foreground">This render is already running and cannot be safely canceled.</p>}
              {render.status === 'FAILED' && render.error !== 'Canceled before render started' && <button type="button" className={buttonClass} disabled={busy}
                onClick={() => void retryRender()}>Retry failed render</button>}
            </div>}
            {project && project.status !== 'READY' && <button type="button" className={buttonClass} disabled={busy}
              onClick={() => void cancelProject()}>{project.status === 'DRAFT' ? 'Discard draft' : 'Cancel preparation'}</button>}
            {ready && <p className="text-xs text-muted-foreground">Edit and export are template-owned here. No new Compact or Timeline integration is added.</p>}
          </section>
        </aside>
      </div>
    </div>
  )
}
