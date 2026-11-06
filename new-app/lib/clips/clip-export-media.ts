import { isFullVideoSettings } from '@/lib/clips/full-video'

/** Full-video and AI Producer draft clips have no preview.mp4; export uses the source recording. */
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
  if (!project) return false
  const settings = project.settings
  const aiProducerDraft = settings && typeof settings === 'object' &&
    !Array.isArray(settings) && typeof (settings as { aiProducerRunId?: unknown }).aiProducerRunId === 'string'
  if (!isFullVideoSettings(settings) && !aiProducerDraft) return false
  return Boolean(clip.sourceSegKey || project.upload?.key || project.proxyKey)
}
