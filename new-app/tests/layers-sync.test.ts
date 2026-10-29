import { describe, expect, it } from 'vitest'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { resolveLayers, syncLayersFromLegacy, type BadgeLayer, type HeadlineLayer } from '@/lib/clips/layers'
import cases from './fixtures/layers_sync_cases.json'

type SyncCase = {
  name: string
  edits: ClipEditsV2 & { layersV?: number; layers?: unknown }
  expectBadge?: { enabled: boolean; showLogo: boolean; handle?: string }
  expectHeadlinePreset?: string
  expectHeadlineText?: string
  expectCaptionsPreset?: string
  expectStickerText?: string
  expectFromLegacy?: boolean
}

describe('layers sync (T2.1)', () => {
  for (const row of cases as SyncCase[]) {
    it(row.name, () => {
      const synced = syncLayersFromLegacy(row.edits)
      const layers = row.expectFromLegacy ? resolveLayers(row.edits) : resolveLayers(synced)

      if (row.expectFromLegacy) {
        expect(row.edits.layersV).toBeUndefined()
        expect(layers.some((l) => l.id === 'headline')).toBe(true)
        return
      }

      expect(synced.layersV).toBe(3)
      expect(Array.isArray(synced.layers)).toBe(true)

      if (row.expectHeadlinePreset) {
        const hl = layers.find((l): l is HeadlineLayer => l.id === 'headline' && l.type === 'headline')
        expect(hl?.style.preset).toBe(row.expectHeadlinePreset)
      }
      if (row.expectHeadlineText) {
        const hl = layers.find((l): l is HeadlineLayer => l.id === 'headline' && l.type === 'headline')
        expect(hl?.text).toBe(row.expectHeadlineText)
      }
      if (row.expectCaptionsPreset) {
        const cap = layers.find((l) => l.id === 'captions' && l.type === 'captions')
        expect((cap as { settings?: { presetId?: string } } | undefined)?.settings?.presetId).toBe(
          row.expectCaptionsPreset,
        )
      }
      if (row.expectBadge) {
        const badge = layers.find((l): l is BadgeLayer => l.id === 'badge' && l.type === 'badge')
        expect(badge?.enabled).toBe(row.expectBadge.enabled)
        expect(badge?.showLogo).toBe(row.expectBadge.showLogo)
        if (row.expectBadge.handle) expect(badge?.handle).toBe(row.expectBadge.handle)
      }
      if (row.expectStickerText) {
        const sticker = layers.find((l) => l.type === 'sticker')
        expect(sticker && 'text' in sticker ? sticker.text : '').toBe(row.expectStickerText)
      }
    })
  }
})
