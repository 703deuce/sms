import 'server-only'
import { ttsHash, ttsWithTimestamps, type TtsAlignment } from '@/lib/server/ai/elevenlabs-tts'
import { durationMsFromAlignment } from '@/lib/server/t2v/tts-alignment'
import type { T2vVoiceSettings } from '@/lib/t2v/types'
import { getClipStorage } from '@/lib/storage'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'

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
