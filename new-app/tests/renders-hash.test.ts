import { describe, expect, it } from 'vitest'
import { editsVersionHash, defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { renderVersionHash } from '@/lib/clips/export-aspect'
import { isDefaultDeliver, type ExportDeliver } from '@/lib/clips/export-deliver'
import { clipRenderHashMaterial } from '@/lib/clips/render-cache-key'

describe('render hash material with deliver', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 60_000 }
  const edits = normalizeEdits(defaultEdits(bounds), bounds)
  const editsHash = editsVersionHash(edits)

  function hashWithDeliver(deliver: ExportDeliver | null, resolution: '720p' | '1080p' = '1080p') {
    const material = clipRenderHashMaterial(editsHash, { deliver })
    return renderVersionHash(material, '9:16', resolution)
  }

  it('default deliver matches today hash (stems=0)', () => {
    const today = renderVersionHash(clipRenderHashMaterial(editsHash, { deliver: null }), '9:16', '1080p')
    expect(hashWithDeliver(null, '1080p')).toBe(today)
  })

  it('stems flag changes hash even when other deliver fields are default', () => {
    const withStems = hashWithDeliver({
      format: 'mp4',
      codec: 'h264',
      quality: 'standard',
      fps: 'source',
      stems: true,
    })
    const without = hashWithDeliver(null, '720p')
    expect(withStems).not.toBe(without)
  })

  it('codec changes hash when deliver is non-default', () => {
    const h264 = hashWithDeliver({ format: 'mp4', codec: 'h264', quality: 'standard', fps: 'source' })
    const hevc = hashWithDeliver({ format: 'mp4', codec: 'hevc', quality: 'standard', fps: 'source' })
    expect(h264).not.toBe(hevc)
    expect(isDefaultDeliver({ format: 'mp4', codec: 'h264', quality: 'standard', fps: 'source' })).toBe(true)
  })
})
