import 'server-only'
import { ttsHash, ttsWithTimestamps, type TtsAlignment } from '@/lib/server/ai/elevenlabs-tts'
import { durationMsFromAlignment } from '@/lib/server/t2v/tts-alignment'
import type { T2vVoiceSettings } from '@/lib/t2v/types'
import { getClipStorage } from '@/lib/storage'
import { createId } from '@/lib/supabase/id'
import { recordAiUsage } from '@/lib/server/clips/ai-usage'
import { getPrisma } from '@/lib/server/db'
import { logT2v } from '@/lib/server/t2v/log'

export type CachedVoiceClip = {
  clipId: string
  storageKey: string
  durationMs: number
  alignment: TtsAlignment
  hash: string
  cached: boolean
  modelId: string
}

export async function getOrSynthesizeVoiceClip(input: {
  workspaceId: string
  text: string
  voice: T2vVoiceSettings
  previousText?: string
  nextText?: string
  projectId?: string | null
  draftId?: string | null
  sceneId?: string | null
}): Promise<CachedVoiceClip> {
  const hash = ttsHash(input.text, input.voice)
  const prisma = getPrisma()
  const existing = await prisma.t2vVoiceClip.findUnique({
    where: { workspaceId_hash: { workspaceId: input.workspaceId, hash } },
  })
  if (existing) {
    return {
      clipId: existing.id,
      storageKey: existing.storageKey,
      durationMs: existing.durationMs,
      alignment: existing.alignment as TtsAlignment,
      hash,
      cached: true,
      modelId: existing.modelId,
    }
  }

  const { audio, alignment, modelUsed, usage } = await ttsWithTimestamps({
    text: input.text,
    voice: input.voice,
    previousText: input.previousText,
    nextText: input.nextText,
  })
  const durationMs = durationMsFromAlignment(alignment)
  const storageKey = `t2v/voice/${hash}.mp3`
  const storage = getClipStorage()
  await storage.putBytes(storageKey, audio, 'audio/mpeg')

  const clipId = createId('t2v')
  await prisma.t2vVoiceClip.create({
    data: {
      id: clipId,
      workspaceId: input.workspaceId,
      hash,
      voiceId: input.voice.voiceId,
      modelId: modelUsed,
      text: input.text,
      storageKey,
      durationMs,
      alignment,
      chars: usage.units,
      costUsdMicros: usage.costUsdMicros,
    },
  })

  if (usage.costUsdMicros > 0) {
    await recordAiUsage({
      workspaceId: input.workspaceId,
      projectId: input.projectId ?? null,
      usage: {
        provider: usage.provider,
        model: usage.model,
        units: usage.units,
        unitType: usage.unitType,
        costUsdMicros: usage.costUsdMicros,
      },
    })
    logT2v('cost', 'voice', {
      projectId: input.projectId,
      draftId: input.draftId,
      sceneId: input.sceneId,
      model: usage.model,
      chars: usage.units,
      costUsdMicros: usage.costUsdMicros,
    })
  }

  return {
    clipId,
    storageKey,
    durationMs,
    alignment,
    hash,
    cached: false,
    modelId: modelUsed,
  }
}
