import { describe, expect, it } from 'vitest'

describe('take import gate', () => {
  it('documents pending track rule', () => {
    const tracks = [{ status: 'UPLOADED', storageKey: 'k' }, { status: 'UPLOADING', storageKey: null }]
    const pending = tracks.filter((t) => t.status !== 'UPLOADED' || !t.storageKey)
    expect(pending).toHaveLength(1)
  })
})
