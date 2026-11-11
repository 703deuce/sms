/**
 * Batch 5 template-only audio export manifest.
 * Do not infer music licensing from Pixabay VIDEO search, a stock search label,
 * an ElevenLabs optional manifest, or a CC0 string without verified bytes.
 */
import { CC0_MUSIC, KENNEY_SFX } from '@/lib/clips/stock-audio-catalog'
import type { AudioLicenseRecord } from './music-timing'
import pinnedStock from './stock-music-approved.json'

export type TemplateAudioAssetLicense = {
  id: string
  kind: 'music' | 'sfx'
  origin: string
  author: string
  license: string
  revision: string
  sha256: string | null
  verifiedDurationFrames: number | null
  commercialUse: boolean
  exportAllowed: boolean
  redistributionAllowed: boolean
  attribution: string | null
  status: 'verified' | 'unverified'
  reason?: string
}

/**
 * Historical stock catalog references were not shipped with SHA-256 and a
 * verified duration. All are intentionally ineligible for template export.
 * They remain untouched in the legacy music / SFX pickers.
 */
/** Only explicitly reviewed, content-hash-pinned files can be first-party template music. */
export const TEMPLATE_APPROVED_STOCK_AUDIO_V1: readonly TemplateAudioAssetLicense[] =
  pinnedStock as TemplateAudioAssetLicense[]
export const TEMPLATE_STOCK_AUDIO_AUDIT_V1: readonly TemplateAudioAssetLicense[] = [
  ...CC0_MUSIC.map(row => ({
    id: row.id, kind: 'music' as const,
    origin: row.src ?? '', author: 'See source repository credit record',
    license: row.license, revision: 'legacy-unverified',
    sha256: null, verifiedDurationFrames: null,
    commercialUse: false, exportAllowed: false, redistributionAllowed: false,
    attribution: null, status: 'unverified' as const,
    reason: 'Remote audio bytes/duration/rights provenance not independently pinned',
  })),
  ...KENNEY_SFX.map(row => ({
    id: row.id, kind: 'sfx' as const,
    origin: row.src ?? '', author: 'Kenney (catalog attribution only)',
    license: row.license, revision: 'legacy-unverified',
    sha256: null, verifiedDurationFrames: null,
    commercialUse: false, exportAllowed: false, redistributionAllowed: false,
    attribution: null, status: 'unverified' as const,
    reason: 'Bundled bytes and end-user redistribution rights not audited for templates',
  })),
]

/**
 * Only manifest entries with verified bytes, author/license evidence and
 * commercial/export rights may become first-party template beds.
 */
export function requireClearedTemplateStockAudio(
  id: string,
  actual: { sha256: string; durationFrames: number },
  manifest: readonly TemplateAudioAssetLicense[] = [...TEMPLATE_APPROVED_STOCK_AUDIO_V1, ...TEMPLATE_STOCK_AUDIO_AUDIT_V1],
): AudioLicenseRecord {
  const row = manifest.find(x => x.id === id && x.kind === 'music')
  if (!row || row.status !== 'verified' || !row.sha256 ||
      !Number.isInteger(row.verifiedDurationFrames) ||
      !row.verifiedDurationFrames || !row.origin || !row.author ||
      !row.license || !row.revision ||
      !row.commercialUse || !row.exportAllowed)
    throw new Error('This stock soundtrack is not cleared for template export')
  if (row.sha256.toLowerCase() !== actual.sha256.toLowerCase() ||
      row.verifiedDurationFrames !== actual.durationFrames)
    throw new Error('Stock music asset bytes or duration differ from the approved license manifest')
  return {
    assetId: row.id, origin: row.origin, author: row.author,
    license: row.license, revision: row.revision, sha256: row.sha256,
    commercialUse: row.commercialUse, exportAllowed: row.exportAllowed,
    redistributionAllowed: row.redistributionAllowed,
    ...(row.attribution ? { attribution: row.attribution } : {}),
    verifiedDurationFrames: row.verifiedDurationFrames, verifiedAt: row.revision,
  }
}
