/**
 * G3b: workspace font rows as the editor sees them (GET /api/clips/fonts) + the font-file URL the
 * preview hands JASSUB. Shared by the routes, the text panel and preview-scripts.
 */
import type { FontMetricsRow } from '@/lib/clips/font-parse'

export type WorkspaceFont = { id: string; family: string; filename: string; bytes: number; metrics: FontMetricsRow }

export const FONTS_MAX_PER_WORKSPACE = 50
export const fontFileUrl = (id: string) => `/api/clips/fonts/${encodeURIComponent(id)}/file`

/** Families the bundled fonts already use — an upload with one of these names is refused. */
export const RESERVED_FONT_FAMILIES = [
  'Anton',
  'Archivo Black',
  'Bangers',
  'Bebas Neue',
  'DejaVu Sans',
  'Inter',
  'Lato',
  'Lato Black',
  'Luckiest Guy',
  'Montserrat',
  'Montserrat Black',
  'Oswald',
  'Poppins',
  'Poppins ExtraBold',
]

export function isReservedFamily(family: string): boolean {
  const f = family.trim().toLowerCase()
  return RESERVED_FONT_FAMILIES.some((r) => r.toLowerCase() === f)
}
