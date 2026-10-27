import { describe, expect, it } from 'vitest'
import { coalescePendingChunks, MULTIPART_MIN_PART_BYTES } from '@/lib/recording/coalesce-parts'
import type { StoredChunk } from '@/lib/recording/chunk-store'

function chunk(seq: number, bytes: number): StoredChunk {
  return {
    id: `c${seq}`,
    sessionId: 's1',
    takeId: 't1',
    trackId: 'tr1',
    seq,
    blob: new Blob([new Uint8Array(bytes)]),
    createdAt: 0,
  }
}

describe('coalescePendingChunks', () => {
  it('waits until 5MiB unless finalize', () => {
    const small = chunk(0, 1024)
    const { parts } = coalescePendingChunks([small], 1, false)
    expect(parts).toHaveLength(0)
  })

  it('emits a part at 5MiB', () => {
    const big = chunk(0, MULTIPART_MIN_PART_BYTES)
    const { parts } = coalescePendingChunks([big], 1, false)
    expect(parts).toHaveLength(1)
    expect(parts[0].partNumber).toBe(1)
    expect(parts[0].sizeBytes).toBe(MULTIPART_MIN_PART_BYTES)
  })

  it('flushes remainder on finalize', () => {
    const { parts } = coalescePendingChunks([chunk(0, 1000)], 1, true)
    expect(parts).toHaveLength(1)
    expect(parts[0].sizeBytes).toBe(1000)
  })
})
