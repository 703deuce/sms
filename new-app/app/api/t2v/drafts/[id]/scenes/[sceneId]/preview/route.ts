import { NextResponse } from 'next/server'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getClipStorage } from '@/lib/storage'
import { storageKeyAllowedForWorkspace } from '@/lib/server/t2v/validate-document'
import { assertValidT2vSceneId } from '@/lib/server/t2v/scene-id'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'

export async function GET(_: Request, { params }: { params: Promise<{ id: string; sceneId: string }> }) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  const { id, sceneId } = await params
  assertValidT2vSceneId(sceneId)
  const workspaceId = await resolveWorkspaceId()
  const row = await getPrisma().t2vDraft.findFirst({ where: { id, workspaceId } })
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const doc = row.document as T2vDraftV1
  const scene = doc.scenes.find((s) => s.id === sceneId)
  if (!scene) return NextResponse.json({ error: 'scene_not_found' }, { status: 404 })

  const storage = getClipStorage()
  let mediaUrl: string | null = scene.media.previewUrl ?? scene.media.thumbUrl ?? null
  const sk = scene.media.storageKey
  if (sk && storageKeyAllowedForWorkspace(workspaceId, sk)) {
    mediaUrl = await storage.createSignedDownloadUrl(sk, 3600)
  }

  let voiceUrl: string | null = null
  if (scene.voice?.clipId) {
    const clip = await getPrisma().t2vVoiceClip.findFirst({
      where: { id: scene.voice.clipId, workspaceId },
    })
    if (clip?.storageKey && storageKeyAllowedForWorkspace(workspaceId, clip.storageKey)) {
      voiceUrl = await storage.createSignedDownloadUrl(clip.storageKey, 3600)
    }
  }

  return NextResponse.json({
    data: {
      mediaUrl,
      voiceUrl,
      kind: scene.media.kind,
      kenBurns: scene.media.kenBurns ?? 'none',
      focalX: scene.media.focalX ?? 0.5,
      focalY: scene.media.focalY ?? 0.5,
      texts: scene.texts,
      captionsEnabled: doc.settings.captionsEnabled,
      captionPresetId: doc.settings.captionPresetId,
    },
  })
}
