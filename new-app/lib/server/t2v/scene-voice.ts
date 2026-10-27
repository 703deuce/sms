import 'server-only'
import { NextResponse } from 'next/server'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'
import { getOrSynthesizeVoiceClip } from '@/lib/server/t2v/voice-cache'
import { wordsFromAlignment } from '@/lib/server/t2v/tts-alignment'
import type { T2vDraftV1, T2vScene } from '@/lib/t2v/types'
import { ttsHash } from '@/lib/server/ai/elevenlabs-tts'
import { getClipStorage } from '@/lib/storage'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

function parseDraft(document: unknown): T2vDraftV1 {
  if (!document || typeof document !== 'object') throw new Error('invalid_draft')
  const d = document as T2vDraftV1
  if (d.v !== 1 || !Array.isArray(d.scenes)) throw new Error('invalid_draft')
  return d
}

export async function postSceneVoice(
  draftId: string,
  sceneId: string,
): Promise<NextResponse> {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  const workspaceId = await resolveWorkspaceId()
  const prisma = getPrisma()
  const row = await prisma.t2vDraft.findFirst({ where: { id: draftId, workspaceId } })
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const doc = parseDraft(row.document)
  const voice = doc.voice
  if (!voice) return NextResponse.json({ error: 'voice_not_configured' }, { status: 400 })

  const sceneIndex = doc.scenes.findIndex((s) => s.id === sceneId)
  if (sceneIndex < 0) return NextResponse.json({ error: 'scene_not_found' }, { status: 404 })
  const scene = doc.scenes[sceneIndex]
  if (scene.muted || !scene.narration.trim()) {
    return NextResponse.json({ error: 'scene_has_no_narration' }, { status: 400 })
  }

  const prev = doc.scenes[sceneIndex - 1]?.narration?.trim() || undefined
  const next = doc.scenes[sceneIndex + 1]?.narration?.trim() || undefined

  const clip = await getOrSynthesizeVoiceClip({
    workspaceId,
    text: scene.narration,
    voice,
    previousText: prev,
    nextText: next,
    projectId: row.projectId,
    draftId,
    sceneId,
  })

  const hash = ttsHash(scene.narration, voice)
  const updatedScene: T2vScene = {
    ...scene,
    voice: {
      clipId: clip.clipId,
      hash,
      durationMs: clip.durationMs,
      status: 'ready',
    },
  }
  const scenes = [...doc.scenes]
  scenes[sceneIndex] = updatedScene
  const nextDoc: T2vDraftV1 = { ...doc, scenes }

  await prisma.t2vDraft.update({
    where: { id: draftId },
    data: { document: nextDoc, revision: { increment: 1 } },
  })

  const url = await getClipStorage().createSignedDownloadUrl(clip.storageKey, 3600)
  const words = wordsFromAlignment(clip.alignment, { offsetS: 0, sceneSlot: scene.slot })

  return NextResponse.json({
    url,
    durationMs: clip.durationMs,
    cached: clip.cached,
    modelId: clip.modelId,
    words,
    scene: updatedScene,
  })
}
