import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

const MAX_STACK = 80

export type PersistedUndoState = {
  v: 2
  revision: number
  document?: ScriptDocumentV1
  undo: ScriptDocumentV1[]
  redo: ScriptDocumentV1[]
}

function storageKey(compositionId: string): string {
  return `transovo:script-undo:${compositionId}`
}

export function loadPersistedUndo(compositionId: string): PersistedUndoState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(compositionId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedUndoState
    if (parsed?.v !== 1 && parsed?.v !== 2) return null
    if (!Array.isArray(parsed.undo) || !Array.isArray(parsed.redo)) return null
    return parsed
  } catch {
    return null
  }
}

export function savePersistedUndo(
  compositionId: string,
  revision: number,
  undo: ScriptDocumentV1[],
  redo: ScriptDocumentV1[],
  document?: ScriptDocumentV1,
): void {
  if (typeof window === 'undefined') return
  try {
    const payload: PersistedUndoState = {
      v: 2,
      revision,
      document,
      undo: undo.slice(-MAX_STACK),
      redo: redo.slice(-MAX_STACK),
    }
    window.localStorage.setItem(storageKey(compositionId), JSON.stringify(payload))
  } catch {
    // quota / private mode — ignore
  }
}

export function clearPersistedUndo(compositionId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey(compositionId))
  } catch {
    // ignore
  }
}
