import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { sourceMsToOutputTime } from '@/lib/clips/script-edl/derive-edl'
import type { EdlSegment } from '@/lib/clips/script-edl/types'

function sceneOutMs(
  scene: NonNullable<ScriptDocumentV1['scenes']>[number],
  orderedWords: EditorWord[],
  edl: EdlSegment[],
): number | null {
  if (typeof scene.outStartMs === 'number') return scene.outStartMs
  if (!scene.startWordId) return null
  const w = orderedWords.find((x) => x.id === scene.startWordId)
  if (!w) return null
  return sourceMsToOutputTime(w.t0Ms, edl)
}

export function nextSceneOutMs(
  document: ScriptDocumentV1,
  orderedWords: EditorWord[],
  edl: EdlSegment[],
  currentOutMs: number,
): number | null {
  const scenes = document.scenes ?? []
  const outs = scenes
    .map((s) => sceneOutMs(s, orderedWords, edl))
    .filter((x): x is number => x != null)
    .sort((a, b) => a - b)
  for (const o of outs) {
    if (o > currentOutMs + 40) return o
  }
  return null
}

export function prevSceneOutMs(
  document: ScriptDocumentV1,
  orderedWords: EditorWord[],
  edl: EdlSegment[],
  currentOutMs: number,
): number | null {
  const scenes = document.scenes ?? []
  const outs = scenes
    .map((s) => sceneOutMs(s, orderedWords, edl))
    .filter((x): x is number => x != null)
    .sort((a, b) => a - b)
  let prev: number | null = null
  for (const o of outs) {
    if (o >= currentOutMs - 40) break
    prev = o
  }
  return prev
}
