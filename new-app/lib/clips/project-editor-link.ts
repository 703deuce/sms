import { ASR_LANGUAGES, type AsrLanguageCode } from '@/lib/clips/asr-languages'

function isUsableId(id: string | null | undefined): id is string {
  if (id == null) return false
  const t = String(id).trim()
  return t.length > 0 && t !== 'null' && t !== 'undefined'
}

/** Prefer a polled id when valid; otherwise the project id from the route / page props. */
export function resolveEditorProjectId(
  routeProjectId: string,
  polledProjectId?: string | null,
): string | null {
  if (isUsableId(polledProjectId)) return polledProjectId
  if (isUsableId(routeProjectId)) return routeProjectId
  return null
}

/** Clip editor URL; never emits `/app/clips/null` when routeProjectId is set. */
export function buildOpenInEditorHref(input: {
  routeProjectId: string
  editorProjectId?: string | null
  clipId?: string | null
}): string | null {
  const projectId = resolveEditorProjectId(input.routeProjectId, input.editorProjectId)
  if (!projectId) return null
  if (!isUsableId(input.clipId)) return null
  return `/app/clips/${projectId}/edit/${input.clipId}`
}

export function asrLanguageEditorLabel(code?: AsrLanguageCode | string | null): string {
  const key = code ?? 'en'
  const hit = ASR_LANGUAGES.find((l) => l.code === key)
  if (hit) return hit.label
  if (key === 'auto') return 'Auto-detect'
  return 'English'
}

export function openInEditorLinkLabel(asrLanguage?: AsrLanguageCode | string | null): string {
  return `Open ${asrLanguageEditorLabel(asrLanguage).toLowerCase()} in editor`
}
