'use client'

import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { clipsFetch } from '@/lib/clips-api'
import { uploadClipFile, type UploadProgress } from '@/lib/clips/upload'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import {
  addVoiceoverClip,
  mimeExt,
  placeRecordedVideo,
  takeFileName,
  type VideoPlaceMode,
} from '@/lib/clips/editor/recording'
import { sourceFromItem, type ProjectMediaItem } from '@/lib/clips/editor/media-add'
import type { ClipRecorderFinished } from '@/components/clips/editor/recording/use-clip-recorder'

export function useClipRecordingPlacement(opts: {
  projectId: string
  getEdits: () => ClipEditsV2
  mediaLabels: string[]
  onCommitEdits: (next: ClipEditsV2) => void
  refreshMedia: () => Promise<void>
}) {
  const { projectId, getEdits, mediaLabels, onCommitEdits, refreshMedia } = opts
  const placementRef = useRef<{ atMs: number; mode: VideoPlaceMode; kind: 'voiceover' | 'camera' } | null>(null)

  const uploadTake = useCallback(
    async (take: ClipRecorderFinished, atMs: number, placeMode: VideoPlaceMode) => {
      const ext = mimeExt(take.mimeType)
      const filename = takeFileName(take.kind, mediaLabels, ext)
      placementRef.current = { atMs, mode: placeMode, kind: take.kind === 'voiceover' ? 'voiceover' : 'camera' }
      const file = new File([take.blob], filename, { type: take.mimeType })
      let last: UploadProgress | null = null
      try {
        const { uploadId } = await uploadClipFile(file, (p) => {
          last = p
          if (p.state === 'uploading') {
            toast.loading(`Uploading ${filename}… ${p.percent}%`, { id: 'clip-rec-upload' })
          }
        }, { kind: 'media' })
        await clipsFetch<{ item: ProjectMediaItem }>(`/api/clips/projects/${projectId}/library`, {
          method: 'POST',
          body: JSON.stringify({
            uploadId,
            label: filename,
            durationMs: take.measuredMs,
            width: take.width ?? null,
            height: take.height ?? null,
          }),
        })
        await refreshMedia()
        toast.success(`Uploaded ${filename}`, { id: 'clip-rec-upload' })
        return uploadId
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Upload failed', { id: 'clip-rec-upload' })
        if (last?.state === 'error' && take.blob) {
          toast.message('Retry from the upload chip or save the take locally', { id: 'clip-rec-retry' })
        }
        throw e
      }
    },
    [mediaLabels, projectId, refreshMedia],
  )

  const placeUploaded = useCallback(
    (uploadId: string, take: ClipRecorderFinished) => {
      const slot = placementRef.current
      if (!slot) return
      const item: ProjectMediaItem = {
        id: uploadId,
        ref: 'upload',
        refId: uploadId,
        mediaType: take.kind === 'voiceover' ? 'audio' : 'video',
        label: takeFileName(take.kind, mediaLabels, mimeExt(take.mimeType)),
        durationMs: take.measuredMs,
        width: take.width ?? null,
        height: take.height ?? null,
        url: null,
        syncMs: null,
        syncStatus: 'none',
      }
      if (slot.kind === 'voiceover') {
        const next = addVoiceoverClip(getEdits(), uploadId, slot.atMs, take.measuredMs, () => crypto.randomUUID())
        onCommitEdits(next)
        toast.message('Voiceover placed on the timeline')
        return
      }
      const edits = getEdits()
      const tb = timebaseFor(edits)
      const res = placeRecordedVideo(edits, tb, item, slot.mode, slot.atMs, () => crypto.randomUUID())
      if (!res.edits) {
        toast.error(res.message ?? 'Could not place recording')
        return
      }
      onCommitEdits(res.edits)
      toast.message(res.message ?? 'Recording placed')
    },
    [getEdits, mediaLabels, onCommitEdits],
  )

  const finishTake = useCallback(
    async (take: ClipRecorderFinished, atMs: number, placeMode: VideoPlaceMode) => {
      const uploadId = await uploadTake(take, atMs, placeMode)
      placeUploaded(uploadId, take)
      placementRef.current = null
    },
    [placeUploaded, uploadTake],
  )

  return { finishTake, uploadTake, placeUploaded }
}
