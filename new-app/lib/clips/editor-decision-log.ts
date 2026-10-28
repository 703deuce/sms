/** Structured editor telemetry (Rick): no tokens, no signed query params. */

export type EditorDecisionKind =
  | 'clip_load'
  | 'edits_cuts'
  | 'preview_source'
  | 'caption_timeline'
  | 'caption_active_miss'
  | 'timeline_trim'
  | 'headline_seed'
  | 'layout'
  | 'export_request'
  | 'export_progress'

export function hostOnlyFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

export function logEditorDecision(kind: EditorDecisionKind, payload: Record<string, unknown>): void {
  console.log('[editor:decision]', JSON.stringify({ kind, ...payload }))
}
