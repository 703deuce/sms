import { EXPORT_PLATFORM_PRESETS, type ExportPlatformId } from '@/lib/clips/export-platform-presets'
import { outputDurationMs, type ClipEditsV2 } from '@/lib/clips/edits'
import { countPolishOverlays } from '@/lib/clips/overlay-safe-zone'

export type ExportPolishLintItem = {
  id: string
  ok: boolean
  message: string
}

export function exportPolishLint(
  edits: ClipEditsV2,
  opts: {
    exportPlatform?: ExportPlatformId | null
    hookPresent?: boolean
  } = {},
): ExportPolishLintItem[] {
  const items: ExportPolishLintItem[] = []
  const durationMs = outputDurationMs(edits)
  const durationSec = durationMs / 1000

  const captionsOn = edits.captions?.enabled !== false
  items.push({
    id: 'captions',
    ok: captionsOn,
    message: captionsOn
      ? 'Captions enabled for burn-in'
      : 'Captions are off — export will have no burned subtitles',
  })

  items.push({
    id: 'hook',
    ok: Boolean(opts.hookPresent || edits.hookOverlay?.enabled && edits.hookOverlay.text?.trim()),
    message:
      opts.hookPresent || (edits.hookOverlay?.text?.trim() && edits.hookOverlay.enabled)
        ? 'Hook overlay text is set'
        : 'No hook overlay — first seconds may feel cold on social',
  })

  if (opts.exportPlatform) {
    const p = EXPORT_PLATFORM_PRESETS[opts.exportPlatform]
    const inBand =
      durationSec >= p.recommendedMinSec - 1 && durationSec <= p.recommendedMaxSec + 15
    items.push({
      id: 'length',
      ok: inBand,
      message: inBand
        ? `Length ~${Math.round(durationSec)}s fits ${p.recommendedMinSec}–${p.recommendedMaxSec}s guidance`
        : `Length ~${Math.round(durationSec)}s — target ${p.recommendedMinSec}–${p.recommendedMaxSec}s for ${p.label}`,
    })
    items.push({
      id: 'safe_zone',
      ok: (edits.captions?.marginVPct ?? 0) >= p.captionSafeMarginVPct - 1,
      message: 'Caption margin accounts for platform safe zone (export preset)',
    })
  }

  const lufs = edits.loudnessLufs
  items.push({
    id: 'audio',
    ok: lufs === -14 || lufs === undefined,
    message:
      lufs === -14 || lufs === undefined
        ? 'Loudness normalized to about −14 LUFS on export'
        : `Custom loudness ${lufs} LUFS — −14 LUFS is recommended for shorts`,
  })

  const overlayCount = countPolishOverlays({
    captions: edits.captions,
    hookOverlay: edits.hookOverlay,
    brand: edits.brand as { logoKey?: string } | undefined,
  })
  items.push({
    id: 'overlays',
    ok: overlayCount <= 3,
    message:
      overlayCount <= 3
        ? `${overlayCount} overlay layer(s) (max 3 recommended)`
        : `${overlayCount} overlays — keep ≤3 for a clean frame`,
  })

  return items
}

export function exportPolishLintWarnings(items: ExportPolishLintItem[]): ExportPolishLintItem[] {
  return items.filter((i) => !i.ok)
}
