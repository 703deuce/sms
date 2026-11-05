import { describe, expect, it } from 'vitest'
import { vorbisDurationMs } from '@/lib/clips/editor/vorbis-duration'

function oggPage(granule: bigint, payload: Buffer): Buffer {
  const page = Buffer.alloc(27 + 1 + payload.length)
  page.write('OggS', 0, 'ascii')
  page[4] = 0
  page.writeBigUInt64LE(granule, 6)
  page[26] = 1
  page[27] = payload.length
  payload.copy(page, 28)
  return page
}

describe('F19 stock CC0 Ogg music metadata', () => {
  it('uses actual Vorbis sample rate and final granule to register duration', () => {
    const header = Buffer.alloc(30)
    header[0] = 1
    header.write('vorbis', 1, 'ascii')
    header.writeUInt32LE(48_000, 12)
    const audio = Buffer.from([1, 2, 3, 4])
    const bytes = Buffer.concat([oggPage(0n, header), oggPage(240_000n, audio)])
    expect(vorbisDurationMs(bytes)).toBe(5_000)
  })
  it('rejects corrupt/non-Vorbis bytes instead of inventing music lengths', () => {
    expect(vorbisDurationMs(Buffer.alloc(250))).toBe(0)
    const page = oggPage(10_000n, Buffer.from([0, 0, 0]))
    expect(vorbisDurationMs(page)).toBe(0)
  })
})
