/** Export-time sound effects (research / future — no bundled clip SFX yet). */
export const EXPORT_SFX_MODES = ['off', 'subtle', 'meme'] as const
export type ExportSfxMode = (typeof EXPORT_SFX_MODES)[number]

/** CC0 / repo-bundled SFX paths relative to worker root (empty until assets land). */
export const BUNDLED_CLIP_EXPORT_SFX: Record<
  ExportSfxMode,
  { whoosh?: string; pop?: string; meme?: string }
> = {
  off: {},
  subtle: {},
  meme: {},
}

export function exportSfxBundledAssetsAvailable(): boolean {
  return Object.values(BUNDLED_CLIP_EXPORT_SFX).some((m) => Object.keys(m).length > 0)
}

export function normalizeExportSfxMode(raw: unknown): ExportSfxMode {
  if (raw === 'subtle' || raw === 'meme') return raw
  return 'off'
}
