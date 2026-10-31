/** G4a: workspace LUTs shared by the server, routes and the Color panel. */
export type WorkspaceLut = { id: string; name: string; filename: string; size: number; bytes: number }
export const LUT_MAX_BYTES = 12 * 1024 * 1024
export const LUTS_MAX_PER_WORKSPACE = 50
export const lutFileUrl = (id: string) => `/api/clips/luts/${encodeURIComponent(id)}/file`

/** Display name: TITLE line, else the file name without .cube. */
export function lutName(text: string, filename: string): string {
  const m = /^\s*TITLE\s+"?([^"\r\n]*)"?\s*$/m.exec(text.slice(0, 4096))
  const t = (m?.[1] ?? '').trim()
  const base = filename.replace(/\.cube$/i, '').trim()
  return (t || base || 'LUT').slice(0, 80)
}
