import { describe, expect, it } from 'vitest'
import { resolveTracksForImport } from '@/lib/server/recording/resolve-import-tracks'

describe('resolveTracksForImport', () => {
  const base = {
    participantId: 'p1',
    kind: 'MICROPHONE' as const,
    participant: { displayName: 'A' },
  }

  it('prefers HQ over backup', () => {
    const tracks = [
      { ...base, id: '1', qualitySource: 'HIGH_QUALITY' as const, status: 'UPLOADING' as const, storageKey: null },
      { ...base, id: '2', qualitySource: 'BACKUP' as const, status: 'UPLOADED' as const, storageKey: 'k' },
      { ...base, id: '3', qualitySource: 'HIGH_QUALITY' as const, status: 'UPLOADED' as const, storageKey: 'hq' },
    ]
    const picked = resolveTracksForImport(tracks as never)
    expect(picked.map((t) => t.id)).toEqual(['3'])
  })

  it('uses backup when HQ missing', () => {
    const tracks = [
      { ...base, id: '2', qualitySource: 'BACKUP' as const, status: 'UPLOADED' as const, storageKey: 'k' },
    ]
    const picked = resolveTracksForImport(tracks as never)
    expect(picked[0]?.qualitySource).toBe('BACKUP')
  })

  it('preferCloudBackup selects backup track', () => {
    const tracks = [
      { ...base, id: '3', qualitySource: 'HIGH_QUALITY' as const, status: 'UPLOADED' as const, storageKey: 'hq' },
      { ...base, id: '2', qualitySource: 'BACKUP' as const, status: 'UPLOADED' as const, storageKey: 'k' },
    ]
    const picked = resolveTracksForImport(tracks as never, { preferCloudBackup: true })
    expect(picked[0]?.id).toBe('2')
  })
})
