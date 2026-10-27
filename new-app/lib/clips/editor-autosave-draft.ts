import type { ClipEditsV2 } from '@/lib/clips/edits'
import { canonicalEditsJson } from '@/lib/clips/edits'

const PREFIX = 'clipper:edits:'

export type EditorAutosaveDraft = {
  edits: ClipEditsV2
  savedAt: string
  serverUpdatedAt?: string
}

export function editorDraftKey(clipId: string) {
  return `${PREFIX}${clipId}`
}

export function readEditorAutosaveDraft(clipId: string): EditorAutosaveDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(editorDraftKey(clipId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as EditorAutosaveDraft
    if (!parsed?.edits || !parsed.savedAt) return null
    return parsed
  } catch {
    return null
  }
}

export function writeEditorAutosaveDraft(clipId: string, draft: EditorAutosaveDraft) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(editorDraftKey(clipId), JSON.stringify(draft))
  } catch {
    /* quota */
  }
}

export function clearEditorAutosaveDraft(clipId: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(editorDraftKey(clipId))
  } catch {
    /* ignore */
  }
}

export function draftDiffersFromServer(draft: EditorAutosaveDraft, serverEdits: ClipEditsV2): boolean {
  return canonicalEditsJson(draft.edits) !== canonicalEditsJson(serverEdits)
}
