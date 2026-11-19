'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import { EditorShell } from '@/components/clips/editor/editor-shell'
import { MotionStudioEditorLanes } from '@/components/motion-studio/motion-studio-editor-lanes'
import {MotionStudioCompactLiveCanvas} from '@/components/motion-studio/motion-studio-compact-live-canvas'
import type { EditorPanelId } from './editor-rail'
import type { EditorMedia } from '@/lib/server/clips/clip-detail'
import { editorMediaLoadFallbacks, type EditorMediaUrls } from '@/lib/server/clips/editor-clip-media'
import type { ClipBounds, ClipEditsV2, ClipWord } from '@/lib/clips/edits'
import type { BrollMediaRow } from '@/lib/server/clips/broll-media'
import type { CropShot, FacecamLayoutState } from '@/lib/server/clips/clip-detail'
import type { EditorAssets } from '@/lib/clips/editor/editor-assets'
import type { CropTrack } from '@/lib/clips/crop-track'
import type { VodChatMeta } from '@/lib/streamer/vod-chat-status'
import { clipsFetch } from '@/lib/clips-api'

export function EditorClipShell(props: {
  projectId: string
  projectTitle: string
  clipId: string
  initialTitle: string
  serverUpdatedAt: string
  editsSaveVersion: number
  bounds: ClipBounds
  initialEdits: ClipEditsV2
  words: ClipWord[]
  cropShots: CropShot[]
  cropTrack: CropTrack | null
  facecamLayout: FacecamLayoutState | null
  primaryMedia: EditorMedia | null
  mediaUrls: EditorMediaUrls
  sourceSegStartMs: number | null
  sourceSegEndMs: number | null
  clipStartMs: number
  clipEndMs: number
  posterUrl: string | null
  aiMeta: { brollIdeas?: string[] } | null
  brollMedia: BrollMediaRow[]
  reframeV2Enabled: boolean
  vodChat: {
    chatSource?: string | null
    chatMessages?: number | null
    sourceType?: string | null
    chatError?: string | null
    chatMeta?: VodChatMeta | null
  } | null
  projectStatus: string
  streamChannelId: string | null
  fullVideo: boolean
  editorAssets: EditorAssets | null
  clipperStudio?: boolean
  initialPanel?: EditorPanelId
  initialProducerOpen?: boolean
  /** Motion Studio project id (?motionStudio=) — opens the Compact Editor with the Motion Studio lanes. */
  motionStudioProjectId?: string | null
}) {
  const router = useRouter()
  const syncAttempted = useRef(false)
  // The editor itself must render before the optional agent manifest import.
  // A slow storage read or media registration must never hold the page skeleton.
  useEffect(() => {
    if (!props.motionStudioProjectId || syncAttempted.current) return
    syncAttempted.current = true
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), 12000)
    void fetch('/api/motion-studio/projects/' + encodeURIComponent(props.motionStudioProjectId) + '/sync-editor', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({clipId:props.clipId}),
      signal:ctrl.signal,
    }).then(async response => {
      if (!response.ok) return
      const result = await response.json() as {updated?:boolean}
      if (result.updated) router.refresh()
    }).catch(() => {
      // The MP4-based editor remains usable; the project may retry import later.
    }).finally(() => window.clearTimeout(timer))
    return () => { window.clearTimeout(timer);ctrl.abort() }
  }, [props.motionStudioProjectId, props.clipId, router])

  // A native motion-graphic edit creates a new immutable portable version.
  // Keep Compact's saved timeline lane metadata in sync with that version,
  // while retaining the existing clip IDs and the user's ClipEditsV2 edits.
  useEffect(()=>{
    if(!props.motionStudioProjectId)return
    let pending=false
    const updated=(event:Event)=>{
      const detail=(event as CustomEvent<{projectId?:string}>).detail
      if(detail?.projectId!==props.motionStudioProjectId||pending)return
      pending=true
      void fetch('/api/motion-studio/projects/'+encodeURIComponent(props.motionStudioProjectId)+
        '/sync-editor',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({clipId:props.clipId})})
        .then(async response=>{
          if(!response.ok)return
          const result=await response.json() as {updated?:boolean}
          if(result.updated)router.refresh()
        }).catch(()=>undefined).finally(()=>{pending=false})
    }
    window.addEventListener('motion-studio:portable-updated',updated)
    return()=>window.removeEventListener('motion-studio:portable-updated',updated)
  },[props.motionStudioProjectId,props.clipId,router])

  const fallbacks = useMemo(
    () =>
      editorMediaLoadFallbacks(props.primaryMedia, props.mediaUrls, {
        sourceSegStartMs: props.sourceSegStartMs,
        sourceSegEndMs: props.sourceSegEndMs,
        clipStartMs: props.clipStartMs,
        clipEndMs: props.clipEndMs,
      }),
    [props.primaryMedia, props.mediaUrls, props.sourceSegStartMs, props.sourceSegEndMs, props.clipStartMs, props.clipEndMs],
  )

  const [media, setMedia] = useState<EditorMedia | null>(props.primaryMedia)
  // The project page already has a signed master preview. If signing the
  // initial editor payload timed out, recover it in the browser without
  // delaying the editor layout or any manifest sync.
  useEffect(() => {
    if (!props.motionStudioProjectId || props.primaryMedia?.url) return
    let live = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    void fetch('/api/motion-studio/agent/jobs?projectId=' + encodeURIComponent(props.motionStudioProjectId), {
      cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      if (!response.ok) return
      const data = await response.json() as { job?: { videoUrl?: string | null } }
      if (live && data.job?.videoUrl) setMedia({ url: data.job.videoUrl, kind: 'proxy', offsetMs: 0 })
    }).catch(() => {/* Keep the editor visible even if preview recovery fails. */})
      .finally(() => clearTimeout(timeout))
    return () => { live = false; clearTimeout(timeout); controller.abort() }
  }, [props.motionStudioProjectId, props.primaryMedia?.url])

  const [liveAssets, setLiveAssets] = useState(props.editorAssets)
  const [preparation, setPreparation] = useState<{ stage: string; progress: number; status: string } | null>(
    props.fullVideo && props.projectStatus !== 'READY'
      ? { stage: 'queued', progress: 0, status: props.projectStatus }
      : null,
  )
  const tried = useRef(new Set<string>())
  const attemptedProxy = useRef(props.primaryMedia?.kind === 'proxy' ? props.primaryMedia.url : null)

  useEffect(() => {
    if (!props.fullVideo) return
    let active = true
    let timeout: ReturnType<typeof setTimeout> | null = null
    const poll = async () => {
      try {
        const data = await clipsFetch<{
          status: string
          stage: string | null
          progress: number
          error: string | null
          proxy: string | null
          editorAssets: typeof props.editorAssets
        }>(`/api/clips/projects/${props.projectId}/full-video-prepare`)
        if (!active) return
        setPreparation(data.status === 'READY'
          ? null
          : { stage: data.stage || data.status.toLowerCase(), progress: data.progress, status: data.status })
        if (data.editorAssets?.fullVideo && (data.editorAssets.peaksUrl || data.editorAssets.filmstrip)) {
          setLiveAssets(data.editorAssets)
        }
        if (data.proxy && attemptedProxy.current !== data.proxy) {
          attemptedProxy.current = data.proxy
          console.log('[clipper:fullvideo-open] step=proxy_ready', { projectId: props.projectId })
          setMedia({ url: data.proxy, kind: 'proxy', offsetMs: 0 })
        }
        if (data.status === 'FAILED') {
          console.log('[clipper:fullvideo-open] step=assets_failed', { projectId: props.projectId, error: data.error })
          return
        }
        if (data.status === 'READY' && data.proxy) return
      } catch (error) {
        if (!active) return
        console.log('[clipper:fullvideo-open] step=progress_retry', {
          projectId: props.projectId,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        })
      }
      if (active) timeout = setTimeout(() => void poll(), 8000)
    }
    console.log('[clipper:fullvideo-open] step=editor_usable', { projectId: props.projectId, clipId: props.clipId })
    void poll()
    return () => { active = false; if (timeout) clearTimeout(timeout) }
  }, [props.fullVideo, props.projectId, props.clipId])

  useEffect(() => {
    setMedia(props.primaryMedia)
    tried.current = new Set()
  }, [props.primaryMedia?.url, props.clipId])

  const onPrimaryMediaError = useCallback(() => {
    const currentUrl = media?.url
    if (currentUrl) tried.current.add(currentUrl)
    for (const next of fallbacks) {
      if (tried.current.has(next.url)) continue
      tried.current.add(next.url)
      setMedia(next)
      return
    }
  }, [fallbacks, media?.url])

  const videoUrl =
    media?.url ??
    props.mediaUrls.proxy ??
    props.mediaUrls.segment ??
    props.mediaUrls.source ??
    props.mediaUrls.preview

  const matteMediaKind = (Object.entries(props.mediaUrls).find(([, url]) => url && url === videoUrl)?.[0] ?? null)

  return (
    <ClipperSurfaceErrorBoundary surface="Clip editor">
      {props.fullVideo && preparation && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-4 right-4 z-[65] rounded-lg border border-border bg-background/95 px-3 py-2 text-xs text-foreground shadow-sm"
          data-testid="full-video-preparation"
        >
          <span className="font-medium">Video ready to edit</span>
          <span className="ml-2 text-muted-foreground">
            {preparation.status === 'FAILED'
              ? 'Background preparation failed'
              : `Preparing ${preparation.stage.replace(/_/g, ' ')} · ${Math.max(0, Math.min(100, preparation.progress))}%`}
          </span>
        </div>
      )}
      <EditorShell
        projectId={props.projectId}
        projectTitle={props.projectTitle}
        clipId={props.clipId}
        initialTitle={props.initialTitle}
        serverUpdatedAt={props.serverUpdatedAt}
        editsSaveVersion={props.editsSaveVersion}
        bounds={props.bounds}
        initialEdits={props.initialEdits}
        words={props.words}
        cropShots={props.cropShots}
        cropTrack={props.cropTrack}
        facecamLayout={props.facecamLayout}
        videoUrl={videoUrl}
        matteMediaKind={matteMediaKind}
        editorMedia={media}
        posterUrl={props.posterUrl}
        aiMeta={props.aiMeta}
        brollMedia={props.brollMedia}
        reframeV2Enabled={props.reframeV2Enabled}
        vodChat={props.vodChat}
        projectStatus={props.projectStatus}
        streamChannelId={props.streamChannelId}
        fullVideo={props.fullVideo}
        editorAssets={liveAssets}
        onEditorMediaError={onPrimaryMediaError}
        compact={!props.fullVideo || props.initialPanel === 'captions' || Boolean(props.motionStudioProjectId)}
        clipperStudio={props.clipperStudio === true}
        initialPanel={props.initialPanel}
        initialProducerOpen={props.initialProducerOpen}
        motionStudioSlot={
          props.motionStudioProjectId
            ? (ctx) => <MotionStudioEditorLanes projectId={props.motionStudioProjectId as string} outputMs={ctx.outputMs} onSeek={ctx.seekOutput} />
            : undefined
        }
        motionStudioCanvasSlot={props.motionStudioProjectId
          ? (ctx)=><MotionStudioCompactLiveCanvas projectId={props.motionStudioProjectId as string} outputMs={ctx.outputMs}/>
          :undefined}
      />
    </ClipperSurfaceErrorBoundary>
  )
}
