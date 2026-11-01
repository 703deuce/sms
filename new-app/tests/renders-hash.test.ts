import { describe, expect, it } from 'vitest'
import { editsVersionHash, defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { renderVersionHash } from '@/lib/clips/export-aspect'
import { isDefaultDeliver, stableDeliverJson, type ExportDeliver } from '@/lib/clips/export-deliver'

describe('render hash material with deliver', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 60_000 }
  const edits = normalizeEdits(defaultEdits(bounds), bounds)
  const editsHash = editsVersionHash(edits)
  const baseMaterial = editsHash

  function hashWithDeliver(deliver: ExportDeliver | null, resolution: '720p' | '1080p' = '1080p') {
    let material = baseMaterial
    if (deliver && !isDefaultDeliver(deliver)) {
      material += `:${stableDeliverJson(deliver)}`
    }
    return renderVersionHash(material, '9:16', resolution)
  }

  it('default deliver matches today hash', () => {
    const today = renderVersionHash(baseMaterial, '9:16', '1080p')
    expect(hashWithDeliver(null, '1080p')).toBe(today)
  })

  it('HEVC vs H.264 differ', () => {
    const h264 = hashWithDeliver({ format: 'mp4', codec: 'h264', quality: 'standard', fps: 'source' })
    const hevc = hashWithDeliver({ format: 'mp4', codec: 'hevc', quality: 'standard', fps: 'source' })
    expect(h264).not.toBe(hevc)
  })
})
