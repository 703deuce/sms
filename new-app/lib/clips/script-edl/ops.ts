import { applySymmetricGapTrim, symmetricGapTrimMs } from '@/lib/clips/script-edl/word-adjust'
import type { ReframeCropRect, ScriptDocumentV1, ScriptEditorSettings } from '@/lib/clips/script-edl/types'

export type DeleteWordsOp = { type: 'delete_words'; wordIds: string[] }
export type RestoreWordsOp = { type: 'restore_words'; wordIds: string[] }
export type AddSplitOp = { type: 'add_split'; outMs: number }
export type InsertGapOp = { type: 'insert_gap'; atOutMs: number; durMs: number }
export type RemoveGapOp = { type: 'remove_gap_at'; atOutMs: number }
export type ReplaceWithGapOp = { type: 'replace_with_gap'; wordIds: string[]; atOutMs: number; durMs: number }
export type SetPadBeforeOp = { type: 'set_pad_before'; wordId: string; padMs: number }
export type PatchSettingsOp = { type: 'patch_settings'; patch: Partial<ScriptEditorSettings> }
export type IgnoreWordsOp = { type: 'ignore_words'; wordIds: string[] }
export type RestoreIgnoredOp = { type: 'restore_ignored'; wordIds: string[] }
export type HideTranscriptWordsOp = { type: 'hide_transcript_words'; wordIds: string[] }
export type ShowTranscriptWordsOp = { type: 'show_transcript_words'; wordIds: string[] }
export type ShortenGapBeforeOp = {
  type: 'shorten_gap_before'
  wordId: string
  prevWordId: string
  gapMs: number
  targetGapMs: number
}
export type ShortenGapsBatchOp = {
  type: 'shorten_gaps_batch'
  items: { wordId: string; prevWordId: string; gapMs: number; targetGapMs: number }[]
}
export type SetReframeKeyframeOp = { type: 'set_reframe_keyframe'; srcMs: number; crop: ReframeCropRect }
export type WordBatchActionOp = {
  type: 'word_batch_action'
  action: 'delete' | 'ignore' | 'replace_with_gap' | 'hide_transcript'
  wordIds: string[]
  gapAtOutMs?: Record<string, number>
  gapDurMs?: number
}
export type PatchWordSourceAdjustOp = {
  type: 'patch_word_source_adjust'
  wordSourceAdjust?: ScriptDocumentV1['wordSourceAdjust']
}
export type PatchReframeKeyframesOp = {
  type: 'patch_reframe_keyframes'
  reframeKeyframes?: ScriptDocumentV1['reframeKeyframes']
}
export type IncludeContextWordsOp = { type: 'include_context_words'; wordIds: string[] }
export type AddSceneAtWordOp = {
  type: 'add_scene_at_word'
  wordId: string
  sceneId?: string
  label?: string
}
export type RemoveSceneOp = { type: 'remove_scene'; sceneId: string }
export type ReorderScenesOp = { type: 'reorder_scenes'; sceneIds: string[] }

export type ScriptCompositionOp =
  | DeleteWordsOp
  | RestoreWordsOp
  | AddSplitOp
  | InsertGapOp
  | RemoveGapOp
  | ReplaceWithGapOp
  | SetPadBeforeOp
  | PatchSettingsOp
  | IgnoreWordsOp
  | RestoreIgnoredOp
  | HideTranscriptWordsOp
  | ShowTranscriptWordsOp
  | ShortenGapBeforeOp
  | ShortenGapsBatchOp
  | SetReframeKeyframeOp
  | WordBatchActionOp
  | PatchWordSourceAdjustOp
  | PatchReframeKeyframesOp
  | IncludeContextWordsOp
  | AddSceneAtWordOp
  | RemoveSceneOp
  | ReorderScenesOp

export function emptyDocument(allWordIds: string[]): ScriptDocumentV1 {
  return { v: 1, keptWordIds: [...allWordIds], deletedWordIds: [], wordOrder: [...allWordIds] }
}

export function cloneDocument(document: ScriptDocumentV1): ScriptDocumentV1 {
  return JSON.parse(JSON.stringify(document)) as ScriptDocumentV1
}

function wordOrderOf(document: ScriptDocumentV1): string[] {
  if (document.wordOrder?.length) return document.wordOrder
  return [...document.keptWordIds, ...document.deletedWordIds]
}

function finalizeDoc(
  document: ScriptDocumentV1,
  order: string[],
  kept: Set<string>,
  deleted: Set<string>,
  partial: Partial<ScriptDocumentV1>,
): ScriptDocumentV1 {
  const keptWordIds = order.filter((id) => kept.has(id))
  return {
    v: 1,
    keptWordIds,
    deletedWordIds: [...deleted],
    wordOrder: order,
    gapInserts: partial.gapInserts ?? document.gapInserts,
    splitAtOutMs: partial.splitAtOutMs ?? document.splitAtOutMs,
    padBeforeMs: partial.padBeforeMs ?? document.padBeforeMs,
    scenes: partial.scenes !== undefined ? partial.scenes : document.scenes,
    markers: document.markers,
    overlays: document.overlays,
    musicTracks: document.musicTracks,
    settings: partial.settings ?? document.settings,
    ignoredWordIds:
      partial.ignoredWordIds !== undefined
        ? partial.ignoredWordIds.length
          ? partial.ignoredWordIds
          : undefined
        : document.ignoredWordIds,
    transcriptHiddenWordIds:
      partial.transcriptHiddenWordIds !== undefined
        ? partial.transcriptHiddenWordIds.length
          ? partial.transcriptHiddenWordIds
          : undefined
        : document.transcriptHiddenWordIds,
    wordSourceAdjust: partial.wordSourceAdjust ?? document.wordSourceAdjust,
    reframeKeyframes: partial.reframeKeyframes ?? document.reframeKeyframes,
  }
}

export function applyCompositionOp(document: ScriptDocumentV1, op: ScriptCompositionOp): ScriptDocumentV1 {
  const order = wordOrderOf(document)
  const deleted = new Set(document.deletedWordIds)
  const kept = new Set(document.keptWordIds)
  let gapInserts = document.gapInserts ? [...document.gapInserts] : undefined
  let splitAtOutMs = document.splitAtOutMs ? [...document.splitAtOutMs] : undefined
  let padBeforeMs = document.padBeforeMs ? { ...document.padBeforeMs } : undefined
  let ignoredWordIds = [...(document.ignoredWordIds ?? [])]
  let transcriptHiddenWordIds = [...(document.transcriptHiddenWordIds ?? [])]
  let wordSourceAdjust = document.wordSourceAdjust ? { ...document.wordSourceAdjust } : undefined
  let reframeKeyframes = document.reframeKeyframes ? [...document.reframeKeyframes] : undefined
  let settings = document.settings
  let scenes = document.scenes ? [...document.scenes] : undefined

  if (op.type === 'delete_words') {
    for (const id of op.wordIds) {
      kept.delete(id)
      deleted.add(id)
    }
  } else if (op.type === 'restore_words') {
    for (const id of op.wordIds) {
      deleted.delete(id)
      kept.add(id)
    }
  } else if (op.type === 'add_split') {
    const ms = Math.max(0, Math.round(op.outMs))
    splitAtOutMs = splitAtOutMs ?? []
    if (!splitAtOutMs.some((x) => Math.abs(x - ms) < 2)) {
      splitAtOutMs.push(ms)
      splitAtOutMs.sort((a, b) => a - b)
    }
  } else if (op.type === 'insert_gap') {
    gapInserts = gapInserts ?? []
    gapInserts.push({ atOutMs: Math.max(0, Math.round(op.atOutMs)), durMs: Math.max(1, Math.round(op.durMs)) })
  } else if (op.type === 'remove_gap_at') {
    const at = Math.round(op.atOutMs)
    gapInserts = (gapInserts ?? []).filter((g) => typeof g.atOutMs !== 'number' || Math.abs(g.atOutMs - at) > 2)
  } else if (op.type === 'replace_with_gap') {
    for (const id of op.wordIds) {
      kept.delete(id)
      deleted.add(id)
    }
    gapInserts = gapInserts ?? []
    gapInserts.push({
      atOutMs: Math.max(0, Math.round(op.atOutMs)),
      durMs: Math.max(1, Math.round(op.durMs)),
    })
  } else if (op.type === 'set_pad_before') {
    padBeforeMs = padBeforeMs ?? {}
    padBeforeMs[op.wordId] = Math.max(0, Math.round(op.padMs))
  }

  if (op.type === 'patch_settings') {
    settings = {
      ...(settings ?? {}),
      ...op.patch,
      captions: op.patch.captions
        ? { ...(settings?.captions ?? {}), ...op.patch.captions }
        : settings?.captions,
    }
  } else if (op.type === 'ignore_words') {
    const ign = new Set(ignoredWordIds)
    for (const id of op.wordIds) {
      ign.add(id)
      deleted.delete(id)
      kept.add(id)
    }
    ignoredWordIds = [...ign]
  } else if (op.type === 'restore_ignored') {
    const ign = new Set(ignoredWordIds)
    for (const id of op.wordIds) ign.delete(id)
    ignoredWordIds = [...ign]
  } else if (op.type === 'hide_transcript_words') {
    const hid = new Set(transcriptHiddenWordIds)
    for (const id of op.wordIds) hid.add(id)
    transcriptHiddenWordIds = [...hid]
  } else if (op.type === 'show_transcript_words') {
    const hid = new Set(transcriptHiddenWordIds)
    for (const id of op.wordIds) hid.delete(id)
    transcriptHiddenWordIds = [...hid]
  } else if (op.type === 'set_reframe_keyframe') {
    const ms = Math.max(0, Math.round(op.srcMs))
    const list = [...(reframeKeyframes ?? [])].filter((k) => Math.abs(k.srcMs - ms) > 2)
    list.push({ srcMs: ms, crop: op.crop })
    list.sort((a, b) => a.srcMs - b.srcMs)
    reframeKeyframes = list
  } else if (op.type === 'word_batch_action') {
    if (op.action === 'delete') {
      for (const id of op.wordIds) {
        kept.delete(id)
        deleted.add(id)
      }
    } else if (op.action === 'ignore') {
      const ign = new Set(ignoredWordIds)
      for (const id of op.wordIds) {
        ign.add(id)
        deleted.delete(id)
        kept.add(id)
      }
      ignoredWordIds = [...ign]
    } else if (op.action === 'hide_transcript') {
      const hid = new Set(transcriptHiddenWordIds)
      for (const id of op.wordIds) hid.add(id)
      transcriptHiddenWordIds = [...hid]
    } else if (op.action === 'replace_with_gap') {
      const durDefault = Math.max(1, op.gapDurMs ?? 400)
      for (const id of op.wordIds) {
        kept.delete(id)
        deleted.add(id)
      }
      gapInserts = gapInserts ?? []
      for (const id of op.wordIds) {
        const at = op.gapAtOutMs?.[id]
        if (typeof at === 'number') {
          gapInserts.push({ atOutMs: Math.max(0, Math.round(at)), durMs: durDefault })
        }
      }
    }
  }

  if (op.type === 'patch_word_source_adjust') {
    wordSourceAdjust = op.wordSourceAdjust ? { ...op.wordSourceAdjust } : undefined
  } else if (op.type === 'patch_reframe_keyframes') {
    reframeKeyframes = op.reframeKeyframes ? [...op.reframeKeyframes] : undefined
  }

  if (op.type === 'shorten_gap_before') {
    const removeMs = symmetricGapTrimMs(op.gapMs, op.targetGapMs)
    if (removeMs > 0) {
      const trimmed = applySymmetricGapTrim(
        { ...document, wordSourceAdjust },
        op.prevWordId,
        op.wordId,
        removeMs,
      )
      wordSourceAdjust = trimmed.wordSourceAdjust
    }
  }

  if (op.type === 'shorten_gaps_batch') {
    let doc: ScriptDocumentV1 = { ...document, wordSourceAdjust }
    for (const item of op.items) {
      const removeMs = symmetricGapTrimMs(item.gapMs, item.targetGapMs)
      if (removeMs > 0) doc = applySymmetricGapTrim(doc, item.prevWordId, item.wordId, removeMs)
    }
    wordSourceAdjust = doc.wordSourceAdjust
  }

  if (op.type === 'include_context_words') {
    const hid = new Set(transcriptHiddenWordIds)
    for (const id of op.wordIds) {
      kept.add(id)
      deleted.delete(id)
      hid.delete(id)
    }
    transcriptHiddenWordIds = [...hid]
  }

  if (op.type === 'add_scene_at_word') {
    scenes = scenes ?? []
    if (!scenes.some((s) => s.startWordId === op.wordId)) {
      scenes.push({
        id: op.sceneId ?? `scn_${op.wordId.replace(/:/g, '_')}`,
        startWordId: op.wordId,
        label: op.label,
      })
    }
    scenes.sort((a, b) => {
      const ia = order.indexOf(a.startWordId ?? '')
      const ib = order.indexOf(b.startWordId ?? '')
      return ia - ib
    })
  } else if (op.type === 'remove_scene') {
    scenes = (scenes ?? []).filter((s) => s.id !== op.sceneId)
    if (!scenes.length) scenes = undefined
  } else if (op.type === 'reorder_scenes') {
    const byId = new Map((scenes ?? []).map((s) => [s.id, s]))
    const next = op.sceneIds.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s))
    scenes = next.length ? next : undefined
  }

  return finalizeDoc(document, order, kept, deleted, {
    gapInserts,
    splitAtOutMs,
    padBeforeMs,
    settings,
    ignoredWordIds,
    transcriptHiddenWordIds,
    wordSourceAdjust,
    reframeKeyframes,
    scenes,
  })
}

export function applyCompositionOps(document: ScriptDocumentV1, ops: ScriptCompositionOp[]): ScriptDocumentV1 {
  return ops.reduce((doc, op) => applyCompositionOp(doc, op), document)
}

/** Ops to transform `from` document into `to` (for undo/redo server sync). */
export function opsBetweenDocuments(from: ScriptDocumentV1, to: ScriptDocumentV1): ScriptCompositionOp[] {
  const fromDel = new Set(from.deletedWordIds)
  const toDel = new Set(to.deletedWordIds)
  const restoreIds = [...fromDel].filter((id) => !toDel.has(id))
  const deleteIds = [...toDel].filter((id) => !fromDel.has(id))
  const ops: ScriptCompositionOp[] = []
  if (restoreIds.length) ops.push({ type: 'restore_words', wordIds: restoreIds })
  if (deleteIds.length) ops.push({ type: 'delete_words', wordIds: deleteIds })

  const fromIgn = new Set(from.ignoredWordIds ?? [])
  const toIgn = new Set(to.ignoredWordIds ?? [])
  const restoreIgnored = [...fromIgn].filter((id) => !toIgn.has(id))
  const ignoreIds = [...toIgn].filter((id) => !fromIgn.has(id))
  if (restoreIgnored.length) ops.push({ type: 'restore_ignored', wordIds: restoreIgnored })
  if (ignoreIds.length) ops.push({ type: 'ignore_words', wordIds: ignoreIds })

  const fromHid = new Set(from.transcriptHiddenWordIds ?? [])
  const toHid = new Set(to.transcriptHiddenWordIds ?? [])
  const showTranscript = [...fromHid].filter((id) => !toHid.has(id))
  const hideTranscript = [...toHid].filter((id) => !fromHid.has(id))
  if (showTranscript.length) ops.push({ type: 'show_transcript_words', wordIds: showTranscript })
  if (hideTranscript.length) ops.push({ type: 'hide_transcript_words', wordIds: hideTranscript })

  if (JSON.stringify(from.wordSourceAdjust ?? null) !== JSON.stringify(to.wordSourceAdjust ?? null)) {
    ops.push({ type: 'patch_word_source_adjust', wordSourceAdjust: to.wordSourceAdjust })
  }
  if (JSON.stringify(from.reframeKeyframes ?? null) !== JSON.stringify(to.reframeKeyframes ?? null)) {
    ops.push({ type: 'patch_reframe_keyframes', reframeKeyframes: to.reframeKeyframes })
  }

  const fromSplits = (from.splitAtOutMs ?? []).join(',')
  const toSplits = (to.splitAtOutMs ?? []).join(',')
  if (fromSplits !== toSplits) {
    for (const ms of to.splitAtOutMs ?? []) {
      if (!(from.splitAtOutMs ?? []).some((x) => Math.abs(x - ms) < 2)) {
        ops.push({ type: 'add_split', outMs: ms })
      }
    }
  }

  const gapKey = (g: { afterWordId?: string; atOutMs?: number; durMs: number }) =>
    `${g.afterWordId ?? ''}:${g.atOutMs ?? ''}:${g.durMs}`
  const fromGaps = new Set((from.gapInserts ?? []).map(gapKey))
  const toGaps = to.gapInserts ?? []
  for (const g of toGaps) {
    if (!fromGaps.has(gapKey(g)) && typeof g.atOutMs === 'number') {
      ops.push({ type: 'insert_gap', atOutMs: g.atOutMs, durMs: g.durMs })
    }
  }
  for (const g of from.gapInserts ?? []) {
    if (!toGaps.some((t) => gapKey(t) === gapKey(g)) && typeof g.atOutMs === 'number') {
      ops.push({ type: 'remove_gap_at', atOutMs: g.atOutMs })
    }
  }

  const fromPad = from.padBeforeMs ?? {}
  const toPad = to.padBeforeMs ?? {}
  for (const wordId of Object.keys(toPad)) {
    if (fromPad[wordId] !== toPad[wordId]) {
      ops.push({ type: 'set_pad_before', wordId, padMs: toPad[wordId] })
    }
  }

  if (JSON.stringify(from.settings ?? {}) !== JSON.stringify(to.settings ?? {})) {
    ops.push({ type: 'patch_settings', patch: to.settings ?? {} })
  }

  const fromScenes = from.scenes ?? []
  const toScenes = to.scenes ?? []
  if (JSON.stringify(fromScenes) !== JSON.stringify(toScenes)) {
    const fromIds = new Set(fromScenes.map((s) => s.id))
    for (const s of toScenes) {
      if (!fromScenes.some((f) => f.startWordId === s.startWordId)) {
        if (s.startWordId) {
          ops.push({ type: 'add_scene_at_word', wordId: s.startWordId, sceneId: s.id, label: s.label })
        }
      }
    }
    for (const s of fromScenes) {
      if (!toScenes.some((t) => t.id === s.id)) {
        ops.push({ type: 'remove_scene', sceneId: s.id })
      }
    }
    const toOrder = toScenes.map((s) => s.id).join(',')
    const fromOrder = fromScenes.map((s) => s.id).join(',')
    if (toOrder !== fromOrder && toScenes.length === fromScenes.length) {
      ops.push({ type: 'reorder_scenes', sceneIds: toScenes.map((s) => s.id) })
    }
  }

  return ops
}

export function documentsEqual(a: ScriptDocumentV1, b: ScriptDocumentV1): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
