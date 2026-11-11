'use client'

import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react'
import { PreviewStage } from '@/components/clips/editor/preview-stage'
import { useRouter } from 'next/navigation'
import { VideoTemplateStudioExportSheet } from '@/components/clips/templates/video-template-studio-export-sheet'
import { VideoTemplateStudioShell } from '@/components/clips/templates/video-template-studio-shell'
import { uploadClipFile, type UploadProgress } from '@/lib/clips/upload'
import type { EditorMedia } from '@/lib/server/clips/clip-detail'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { TemplateAsset } from '@/lib/clips/real-video-templates/sequence-contract'
import { aspectCss, aspectRatioParts, type ExportAspect } from '@/lib/clips/export-aspect'
import type { VideoTemplateRelease } from '@/lib/clips/real-video-templates/gallery'
import { assignSelectionInOrder, fillProgress, materializeStudioDraft, moveSelection,
  newStudioDraft, type StudioDraft, type StudioSlotFill } from '@/lib/clips/real-video-templates/slot-workflow'

type Project = { id: string; status: string; version: number; draft: StudioDraft; clipId: string | null; editsSaveVersion?: number }
type MediaItem = { asset: TemplateAsset; label: string; mime?: string; durationMs: number | null;
  width: number | null; height: number | null; url: string | null; stillUrl?: string | null; available: boolean }
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
  const [knownMedia, setKnownMedia] = useState<Record<string, MediaItem>>({})
  const [mediaSearch, setMediaSearch] = useState('')
  const [mediaKind, setMediaKind] = useState<'all' | 'video' | 'image' | 'audio'>('all')
  const [selectedSlot, setSelectedSlot] = useState(release.family.slots[0]?.id ?? '')
  const [selectedUploads, setSelectedUploads] = useState<TemplateAsset[]>([])
  const [selectedAudio, setSelectedAudio] = useState(false)
  const [pendingMusic, setPendingMusic] = useState<MediaItem | null>(null)
  const [uploadStatus, setUploadStatus] = useState<UploadProgress | null>(null)
  const [clip, setClip] = useState<ClipDetail | null>(null)
  const [sourceUrls, setSourceUrls] = useState<Record<string, string>>({})
  const [render, setRender] = useState<RenderJob | null>(null)
  const [clockMs, setClockMs] = useState(0)
  const lastClockRounded = useRef(-1)
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
  const musicAudioRef = useRef<HTMLAudioElement | null>(null)
  const prepareLock = useRef(false)
  const recentUploads = useRef<TemplateAsset[]>([])
  const [rightTab, setRightTab] = useState<'text' | 'music' | 'style'>('text')
  const [exportOpen, setExportOpen] = useState(false)
  const [exportResolution, setExportResolution] = useState<'720p' | '1080p'>('720p')
  const [exportAspect, setExportAspect] = useState<ExportAspect>((release.family.aspects[0] ?? '9:16') as ExportAspect)
  const [previewPreparing, setPreviewPreparing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileStep, setMobileStep] = useState<'pick' | 'studio'>('pick')
  const [mobilePick, setMobilePick] = useState<TemplateAsset[]>([])
  const [librarySelection, setLibrarySelection] = useState<TemplateAsset[]>([])
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
    setKnownMedia(previous => ({ ...previous,
      ...Object.fromEntries(result.items.map(item => [item.asset.id, item])) }))
    return result
  }, [])
  const loadSelectedMedia = useCallback(async (ids: string[]): Promise<Map<string, MediaItem>> => {
    const selected = new Map<string, MediaItem>()
    const distinct = [...new Set(ids)]
    for (let index = 0; index < distinct.length; index += 50) {
      const chunk = distinct.slice(index, index + 50)
      if (!chunk.length) continue
      const result = await request<MediaPage>(
        '/api/clips/video-templates/media?ids=' + encodeURIComponent(chunk.join(',')))
      for (const item of result.items) selected.set(item.asset.id, item)
    }
    if (selected.size) setKnownMedia(previous => ({
      ...previous, ...Object.fromEntries(selected),
    }))
    return selected
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
        const assignedAssets = Object.values(saved.draft.slots).flatMap(fill =>
          [fill.asset, ...(fill.holdAsset ? [fill.holdAsset] : [])])
        if (saved.draft.music) assignedAssets.push(saved.draft.music)
        if (assignedAssets.length) await loadSelectedMedia(assignedAssets.map(asset => asset.id))
        if (!initialProjectId) router.replace(
          '/app/clips/video-templates/' + encodeURIComponent(release.id) + '?draft=' + encodeURIComponent(saved.id))
        if (saved.status === 'READY' && saved.clipId) await refreshClip(saved)
      } catch (e) { if (live) setError(readable(e, 'Could not resume template')) }
    }
    void start()
    return () => { live = false }
  }, [initialProjectId, release.id, refreshMedia, loadSelectedMedia, refreshClip, router])
  useEffect(() => {
    if (!release.musicRequired || !release.defaultMusic || !project || project.status !== 'DRAFT') return
    if (draft?.music && draft.templateMusic) return
    let canceled = false
    void (async () => {
      try {
        setNotice('Preparing first-party soundtrack…')
        const updated = await request<Project>(
          '/api/clips/video-templates/drafts/' + encodeURIComponent(project.id) + '/default-music', 'POST')
        if (canceled) return
        versionRef.current = updated.version
        setCurrentProject(updated)
        setCurrentDraft(updated.draft)
        if (updated.draft.music) await loadSelectedMedia([updated.draft.music.id])
        setNotice('First-party beat-synced soundtrack ready')
      } catch (e) {
        if (!canceled) setError(readable(e, 'Could not prepare first-party soundtrack'))
      }
    })()
    return () => { canceled = true }
  }, [project?.id, project?.status, release.musicRequired, release.defaultMusic, draft?.music, draft?.templateMusic, loadSelectedMedia])
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
    if (saveLock.current) { await saveLock.current; if (dirtyRef.current) return saveNow(); return }
    const value = draftRef.current, state = projectRef.current
    if (!dirtyRef.current || !state || !value || state.status === 'QUEUED') return
    if (state.status !== 'DRAFT' && state.status !== 'READY') return
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
      if (state.status === 'READY' && projectRef.current && clip) await refreshClip(projectRef.current)
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
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  useEffect(() => {
    const value = draftRef.current
    const state = projectRef.current
    if (!value || !state || state.status !== 'DRAFT' || busy || prepareLock.current) return
    const prog = fillProgress(release.family, value)
    const musicOk = !release.musicRequired || Boolean(value.music && value.templateMusic && value.musicRightsConfirmed)
    if (prog.filled !== prog.total || !musicOk) return
    const timer = window.setTimeout(() => {
      if (prepareLock.current || projectRef.current?.status !== 'DRAFT') return
      prepareLock.current = true
      setPreviewPreparing(true)
      void publish()
        .catch(e => setError(readable(e, 'Could not prepare preview')))
        .finally(() => {
          prepareLock.current = false
          setPreviewPreparing(false)
        })
    }, 900)
    return () => window.clearTimeout(timer)
  }, [draft, project?.status, project?.id, busy, release.family, release.musicRequired])
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
      await refreshMedia(1, '', 'all')
      const uploaded = await loadSelectedMedia(ids.map(item => item.id))
      const withMeta = ids.map(item => {
        const metadata = uploaded.get(item.id)
        if (!metadata?.available)
          throw new Error('Uploaded media is processing or unavailable; refresh the library and retry')
        return metadata.asset
      })
      setSelectedUploads(prev => [...prev, ...withMeta])
      recentUploads.current = [...withMeta, ...recentUploads.current].slice(0, 80)
      setLibrarySelection(prev => [...prev, ...withMeta])
      setNotice(withMeta.length + ' files uploaded')
    } catch (e) { setError(readable(e, 'Upload failed — retry or choose a different file')) }
    finally { setBusy(false);setUploadStatus(null) }
  }
  const fillSlot = (id: string, asset: TemplateAsset) => {
    if (!draft) return
    const slot = release.family.slots.find(s => s.id === id)
    if (!slot || asset.kind === 'audio' || (slot.media !== 'either' && slot.media !== asset.kind) ||
        (slot.playback && asset.kind !== 'video')) {
      setError('The selected file does not match the required slot media type')
      return
    }
    const fill: StudioSlotFill = {
      asset,
      sourceInFrame: asset.kind === 'video' ? (slot.handles?.headFrames ?? 0) : 0,
      fit: slot.fit,
      muteSourceAudio: slot.sourceAudio === 'mute',
      focalX: 50, focalY: 50, remedy: 'replace',
    }
    commitDraft({ ...draft, slots: { ...draft.slots, [id]: fill } })
  setNotice('Slot ' + slot.ordinal + ' updated without changing adjacent slots.')
    if (projectRef.current?.status === 'READY') {
      window.setTimeout(() => { void saveNow() }, 0)
    }
  }
  const autoFill = (source?: TemplateAsset[]) => {
    if (!draft) return
    const queue = (source ?? (selectedUploads.length ? selectedUploads : librarySelection.length
      ? librarySelection : recentUploads.current)).filter(item => item.kind !== 'audio')
    const { draft: updated, used, rejected } = assignSelectionInOrder(draft, release.family, queue)
    if (used) commitDraft(updated)
    setSelectedUploads(rejected)
    setLibrarySelection(rejected)
    setNotice(used + ' slots filled' + (rejected.length ? '; ' + rejected.length + ' files not assigned' : ''))
  }
  const patchFill = (id: string, changes: Partial<StudioSlotFill>) => {
    if (!draft?.slots[id]) return
    commitDraft({ ...draft, slots: { ...draft.slots, [id]: { ...draft.slots[id]!, ...changes } } })
  }
  const createHold = async (id: string) => {
    const fill = draft?.slots[id]
    const source = fill ? (knownMedia[fill.asset.id] ??
      (await loadSelectedMedia([fill.asset.id])).get(fill.asset.id)) : undefined
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
      if (dirtyRef.current) throw new Error('Draft still has unsaved changes. Retry preparation after saving.')
      const result = await request<{ projectId: string; clipId: string; status: string }>(
        '/api/clips/video-templates/drafts/' + encodeURIComponent(project.id) + '/publish', 'POST')
      const published = { ...project, status: result.status, clipId: result.clipId,
        draft, version: versionRef.current }
      setCurrentProject(published)
      if (published.status === 'READY') await refreshClip(published)
      setNotice(published.status === 'READY'
        ? 'Your complete template preview is ready.'
        : 'Project created. The template carrier is preparing for frame-accurate preview and export.')
    } catch (e) { setError(readable(e, 'Could not prepare template')) }
    finally { setBusy(false) }
  }
  const doExport = async () => {
    const state = projectRef.current
    if (!state?.clipId || state.status !== 'READY') return
    setBusy(true);setError('')
    try {
      await saveNow()
      if (dirtyRef.current) throw new Error('Save must finish before export')
      const result = await request<{ renderId: string; status: string; downloadUrl?: string | null }>(
        '/api/clips/clips/' + encodeURIComponent(state.clipId) + '/export', 'POST', {
          resolution: exportResolution,
          aspect: exportAspect,
          format: 'mp4',
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
  const activeMedia = activeFill ? knownMedia[activeFill.asset.id] : undefined
  const activeStillUrl = activeMedia?.asset.kind === 'image'
    ? (activeMedia.stillUrl ?? activeMedia.url)
    : activeMedia?.url
  const musicMedia = draft?.music ? knownMedia[draft.music.id] : undefined
  const musicConfig = clip?.edits.audio?.music ?? null
  const syncMusicPreview = (outputMs: number, play: boolean) => {
    const audio = musicAudioRef.current
    const config = musicConfig
    if (!audio || !config || !musicMedia?.url) return
    const startMs = config.startMs ?? 0
    const endMs = config.endMs ?? clip?.edits.trim?.out ?? release.family.totalFrames * 1000 / 30
    if (outputMs < startMs || outputMs >= endMs) {
      if (!audio.paused) audio.pause()
      return
    }
    let sourceMs = (config.inMs ?? 0) + outputMs - startMs
    const durationMs = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : 0
    if (config.loop && durationMs > 1) sourceMs = ((sourceMs % durationMs) + durationMs) % durationMs
    else if (durationMs > 1) sourceMs = Math.min(sourceMs, Math.max(0, durationMs - 20))
    if (Math.abs(audio.currentTime * 1000 - sourceMs) > 120) audio.currentTime = Math.max(0, sourceMs / 1000)
    const localMs = outputMs - startMs
    const remainingMs = endMs - outputMs
    const fadeIn = Math.max(0, config.fadeInMs ?? 0)
    const fadeOut = Math.max(0, config.fadeOutMs ?? 0)
    const fadeGain = Math.min(
      1,
      fadeIn ? localMs / fadeIn : 1,
      fadeOut ? remainingMs / fadeOut : 1,
    )
    audio.volume = Math.max(0, Math.min(1, (config.volume ?? 0.35) * Math.max(0, fadeGain)))
    if (play && audio.paused) void audio.play().catch(() => {})
    else if (!play && !audio.paused) audio.pause()
  }
  const ready = project?.status === 'READY' && Boolean(clip && project.clipId)
  const musicReady = !release.musicRequired || Boolean(draft?.music && draft?.templateMusic && draft.musicRightsConfirmed)
  const canPublish = progress.filled === progress.total && musicReady && project?.status === 'DRAFT' && !busy
  const slotsRemaining = Math.max(0, progress.total - progress.filled)
  const exportHint = slotsRemaining
    ? 'Fill ' + slotsRemaining + ' more slot' + (slotsRemaining === 1 ? '' : 's') + ' to export'
    : project?.status !== 'READY' ? 'Preview is preparing…' : null
  const saveStatus = dirty ? 'Saving…' : notice || 'All changes saved'
  const previewAspect = (release.family.aspects[0] ?? '9:16') as ExportAspect
  const previewFrameMaxH = 640
  const { aw: previewAw, ah: previewAh } = aspectRatioParts(previewAspect)
  const previewFrameStyle = {
    aspectRatio: aspectCss(previewAspect),
    maxHeight: previewFrameMaxH,
    width: '100%' as const,
    maxWidth: Math.round(previewFrameMaxH * (previewAw / previewAh)),
  }
  const toggleMobilePick = (asset: TemplateAsset) => {
    setMobilePick(prev => prev.some(a => a.id === asset.id)
      ? prev.filter(a => a.id !== asset.id)
      : [...prev, asset])
  }
  const mobileNext = () => {
    autoFill(mobilePick)
    setMobileStep('studio')
  }
  const toggleLibrarySelect = (asset: TemplateAsset) => {
    setLibrarySelection(prev => prev.some(a => a.id === asset.id)
      ? prev.filter(a => a.id !== asset.id)
      : [...prev, asset])
  }
  const refreshMediaPage = (page: number) => {
    void refreshMedia(page, mediaSearch, mediaKind).catch(e => setError(readable(e)))
  }
  return (
    <div className="min-h-[100dvh] bg-background">
      {error ? (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive" role="alert">
          {error}
          <button type="button" className="ml-2 underline" onClick={() => setError('')}>Dismiss</button>
        </p>
      ) : null}
      <VideoTemplateStudioShell
        release={release}
        project={project}
        draft={draft}
        progress={progress}
        ready={ready}
        previewPreparing={previewPreparing}
        saveStatus={saveStatus}
        exportHint={exportHint}
        busy={busy}
        dirty={dirty}
        historyLength={history.current.length}
        futureLength={future.current.length}
        canExport={ready}
        slotsRemaining={slotsRemaining}
        isMobile={isMobile}
        mobileStep={mobileStep}
        onMobileStep={setMobileStep}
        mobilePick={mobilePick}
        onToggleMobilePick={toggleMobilePick}
        onMobileNext={mobileNext}
        undo={undo}
        redo={redo}
        onExportOpen={() => setExportOpen(true)}
        rightTab={rightTab}
        onRightTab={setRightTab}
        mediaSearch={mediaSearch}
        onMediaSearch={setMediaSearch}
        mediaKind={mediaKind}
        onMediaKind={kind => { setMediaKind(kind); void refreshMedia(1, mediaSearch, kind) }}
        onBrowseMusic={() => { setSelectedAudio(true); setMediaKind('audio'); void refreshMedia(1, mediaSearch, 'audio') }}
        media={media}
        onRefreshMedia={refreshMediaPage}
        librarySelection={librarySelection}
        onToggleLibrarySelect={toggleLibrarySelect}
        onUpload={files => void uploadFiles(files)}
        uploadStatus={uploadStatus}
        selectedSlot={selectedSlot}
        onSelectSlot={id => { setSelectedSlot(id); setSelectedAudio(false) }}
        knownMedia={knownMedia}
        onAssignAsset={fillSlot}
        onBatchFill={() => autoFill()}
        onCommitDraft={commitDraft}
        patchFill={patchFill}
        onCreateHold={id => void createHold(id)}
        activeSlot={activeSlot}
        activeFill={activeFill}
        clip={clip}
        previewFrameStyle={previewFrameStyle}
        videoRef={videoRef}
        musicAudioRef={musicAudioRef}
        sourceUrls={sourceUrls}
        clockMs={clockMs}
        onClockMs={ms => { if (Math.floor(ms / 100) !== lastClockRounded.current) { lastClockRounded.current = Math.floor(ms / 100); setClockMs(ms) } }}
        syncMusicPreview={syncMusicPreview}
        releaseFamilySlots={release.family.slots}
        pendingMusic={pendingMusic}
        onPendingMusic={setPendingMusic}
        musicMedia={musicMedia}
        musicConfig={musicConfig}
      />
      <VideoTemplateStudioExportSheet
        open={exportOpen}
        onOpenChange={setExportOpen}
        aspects={release.family.aspects}
        aspect={exportAspect}
        onAspectChange={setExportAspect}
        resolution={exportResolution}
        onResolutionChange={setExportResolution}
        busy={busy}
        canExport={ready}
        hint={exportHint}
        onStartExport={() => void doExport()}
        render={render}
        onCancelQueued={() => void cancelQueuedRender()}
        onRetry={() => void retryRender()}
      />
    </div>
  )
}
