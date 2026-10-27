import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import type { T2vDraftV1 } from '@/lib/t2v/types'

/**
 * Draft + assemble result -> FULL ScriptComposition document, so the existing Descript-style
 * editor (/app/clips/[projectId]/script) and RENDER_SCRIPT_COMPOSITION work unchanged.
 *
 * sourceMediaId = resolveSourceMediaId(project) = `clip_upload:{uploadId}` (T2V_ASSEMBLE creates a
 * ClipUpload kind="t2v_source"), word id = `${sourceMediaId}:${w.i}` with w.i = slot*10_000+k.
 */
export function draftToComposition(input: {
  draft: T2vDraftV1
  sourceMediaId: string
  words: { w: string; s: number; e: number; i: number }[]
  sceneStartsMs: Record<string, number>
  musicGenerationId?: string | null
  previous?: ScriptDocumentV1 | null
}): ScriptDocumentV1 {
  const { draft, sourceMediaId, words } = input
  const allIds = words.map((w) => `${sourceMediaId}:${w.i}`)
  // Preserve fine edits (deleted words) from the previous composition when their ids still exist.
  const prevDeleted = new Set(input.previous?.deletedWordIds ?? [])
  const deleted = allIds.filter((id) => prevDeleted.has(id))
  const kept = allIds.filter((id) => !prevDeleted.has(id))
  const totalMs = words.length ? Math.round(words[words.length - 1].e * 1000) : 0

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
    // Scene media is baked into the assembled source; only user-added overlays live in broll[].
    broll: input.previous?.broll ?? [],
    musicTracks: input.musicGenerationId
      ? [{ id: 'm1', assetId: input.musicGenerationId, outStartMs: 0, durMs: totalMs, label: draft.music?.label ?? 'Music', duckUnderSpeech: draft.music?.duck ?? true }]
      : [],
    settings: {
      ...(input.previous?.settings ?? {}),
      aspect: draft.settings.aspect,
      captionsEnabled: draft.settings.captionsEnabled,
      captions: { ...(input.previous?.settings?.captions ?? {}), enabled: draft.settings.captionsEnabled, presetId: draft.settings.captionPresetId },
    },
  }
}

/** Duration estimate shown before generation (150 wpm + per-scene padding). */
export function estimateDurationMs(draft: Pick<T2vDraftV1, 'scenes'>, wpm = 150): number {
  return draft.scenes.reduce((acc, s) => {
    const words = s.narration.trim() ? s.narration.trim().split(/\s+/).length : 0
    const voMs = (words / wpm) * 60_000
    return acc + Math.max(s.minDurMs ?? 2000, voMs + s.padMs)
  }, 0)
}
