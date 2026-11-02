import { registerFontMetrics } from '@/lib/clips/caption-fit'
import { fontFileUrl, type WorkspaceFont } from '@/lib/clips/fonts-shared'
import { ensureWorkspaceFontLoaded } from '@/lib/clips/editor/workspace-fonts'
import { userFontId } from '@/lib/clips/render-plan/text-rich'

export function workspaceFontForCaption(raw: string | undefined | null, fonts: WorkspaceFont[]): WorkspaceFont | null {
  const id = userFontId(raw)
  if (!id) return null
  return fonts.find((f) => f.id === id) ?? null
}

/** Label for font pickers (never show raw `user:font_…`). */
export function captionFontDisplayLabel(
  raw: string | undefined,
  fonts: WorkspaceFont[],
  builtinLabels: Record<string, string> = {},
): string {
  const row = workspaceFontForCaption(raw, fonts)
  if (row) return row.family
  if (raw && builtinLabels[raw]) return builtinLabels[raw]
  return raw?.trim() || 'Poppins'
}

/** Register metrics + JASSUB URL (+ FontFace via workspace-fonts loader when fonts were fetched). */
export function registerCaptionUserFont(raw: string | undefined, fonts: WorkspaceFont[]): WorkspaceFont | null {
  const row = workspaceFontForCaption(raw, fonts)
  if (!row) return null
  ensureWorkspaceFontLoaded(row)
  return row
}

/** Mirror worker prepare_user_fonts caption rewrite for editor libass preview. */
export function captionEditsForAssPreview(
  cap: Record<string, unknown> | null | undefined,
  fonts: WorkspaceFont[],
): Record<string, unknown> {
  const c = cap && typeof cap === 'object' ? { ...cap } : {}
  const raw = String(c.font ?? '').trim()
  const row = registerCaptionUserFont(raw, fonts)
  if (!row) return c
  return { ...c, font: row.family, _userFont: true }
}
