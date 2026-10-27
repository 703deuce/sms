/** Export-time sound effects (Kenney CC0 — worker/assets/sfx). */
export const EXPORT_SFX_MODES = ['off', 'subtle', 'meme'] as const
export type ExportSfxMode = (typeof EXPORT_SFX_MODES)[number]

/** Worker-relative paths (mirrored in worker/clips_worker/export_sfx.py). */
export const BUNDLED_CLIP_EXPORT_SFX_FILES = [
  'whoosh.wav',
  'pop.wav',
  'ding.wav',
  'boom.wav',
  'record-scratch.wav',
  'laugh-sting.wav',
] as const

export function exportSfxBundledAssetsAvailable(): boolean {
  return true
}

export function normalizeExportSfxMode(raw: unknown): ExportSfxMode {
  if (raw === 'subtle' || raw === 'meme') return raw
  return 'off'
}
