'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ClipperSurfaceErrorBoundary } from '@/components/clips/clipper-surface-error-boundary'
import { EditorShell } from '@/components/clips/editor/editor-shell'
import type { EditorMedia } from '@/lib/server/clips/clip-detail'
import { editorMediaLoadFallbacks, type EditorMediaUrls } from '@/lib/server/clips/editor-clip-media'
import type { ClipBounds, ClipEditsV2, ClipWord } from '@/lib/clips/edits'
import type { BrollMediaRow } from '@/lib/server/clips/broll-media'
import type { CropShot, FacecamLayoutState } from '@/lib/server/clips/clip-detail'
import type { EditorAssets } from '@/lib/clips/editor/editor-assets'
import type { CropTrack } from '@/lib/clips/crop-track'
import type { VodChatMeta } from '@/lib/streamer/vod-chat-status'

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
}) {
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
  const tried = useRef(new Set<string>())

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

  return (
    <ClipperSurfaceErrorBoundary surface="Clip editor">
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
        editorMedia={media}
        posterUrl={props.posterUrl}
        aiMeta={props.aiMeta}
        brollMedia={props.brollMedia}
        reframeV2Enabled={props.reframeV2Enabled}
        vodChat={props.vodChat}
        projectStatus={props.projectStatus}
        streamChannelId={props.streamChannelId}
        fullVideo={props.fullVideo}
        editorAssets={props.editorAssets}
        onEditorMediaError={onPrimaryMediaError}
        compact={!props.fullVideo}
      />
    </ClipperSurfaceErrorBoundary>
  )
}
