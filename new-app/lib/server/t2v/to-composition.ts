import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import type { T2vDraftV1 } from '@/lib/t2v/types'

export function draftToComposition(input: {
  draft: T2vDraftV1
  sourceMediaId: string
  words: { w: string; s: number; e: number; i: number }[]
  sceneStartsMs: Record<string, number>
  musicGenerationId?: string | null
  durationMs?: number
  previous?: ScriptDocumentV1 | null
}): ScriptDocumentV1 {
  const { draft, sourceMediaId, words } = input
  const allIds = words.map((w) => `${sourceMediaId}:${w.i}`)
  const prevDeleted = new Set(input.previous?.deletedWordIds ?? [])
  const deleted = allIds.filter((id) => prevDeleted.has(id))
  const kept = allIds.filter((id) => !prevDeleted.has(id))
  const fromWords = words.length ? Math.round(words[words.length - 1].e * 1000) : 0
  const totalMs = input.durationMs ?? fromWords

  const scenes = draft.scenes.map((sc) => {
    const first = words.find((w) => Math.floor(w.i / 10_000) === sc.slot)
    return {
      id: sc.id,
      startWordId: first ? `${sourceMediaId}:${first.i}` : undefined,
      label: sc.onScreenText || sc.narration.split(' ').slice(0, 5).join(' '),
      outStartMs: input.sceneStartsMs[sc.id],
    }
  })

  return {
    ...(input.previous ?? {}),
    v: 1,
    keptWordIds: kept,
    deletedWordIds: deleted,
    scenes,
    broll: input.previous?.broll ?? [],
    musicTracks: input.musicGenerationId
      ? [
          {
            id: 'm1',
            assetId: input.musicGenerationId,
            outStartMs: 0,
            durMs: totalMs,
            label: draft.music?.label ?? 'Music',
            duckUnderSpeech: draft.music?.duck ?? true,
            volume: draft.music?.volume ?? 0.25,
          },
        ]
      : [],
    settings: {
      ...(input.previous?.settings ?? {}),
      aspect: draft.settings.aspect,
      captionsEnabled: draft.settings.captionsEnabled,
      captions: {
        ...(input.previous?.settings?.captions ?? {}),
        enabled: draft.settings.captionsEnabled,
        presetId: draft.settings.captionPresetId,
      },
    },
  }
}
