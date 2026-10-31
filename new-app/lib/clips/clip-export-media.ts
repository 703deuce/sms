import { isFullVideoSettings } from '@/lib/clips/full-video'

/** FVfix2: full-video clips have no preview.mp4; export uses upload/proxy/segment keys. */
export function clipExportMediaReady(
  clip: {
    previewKey: string | null
    sourceSegKey: string | null
  },
  project: {
    settings: unknown
    proxyKey?: string | null
    upload?: { key: string | null } | null
  } | null,
): boolean {
  if (clip.previewKey) return true
  if (!project || !isFullVideoSettings(project.settings)) return false
  return Boolean(clip.sourceSegKey || project.upload?.key || project.proxyKey)
}
