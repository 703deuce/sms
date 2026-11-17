import { describe, expect, it } from 'vitest'
import { validateProducerCheckpoint } from '../../lib/motion-studio/checkpoint-contract'
describe('durable worker checkpoint contract', () => {
  it('accepts a new serializable checkpoint with stable asset IDs', () => {
    const next = validateProducerCheckpoint({ revision: 1, checkpoint: {
      stage: 'scenes', finishedSceneIds: ['scene1'], durableAssetIds: ['asset1'] } }, null)
    expect(next).toEqual({ revision: 1, state: { stage: 'scenes', finishedSceneIds: ['scene1'],
      durableAssetIds: ['asset1'] } })
  })
  it('rejects stale or conflicting revisions', () => {
    const old = { revision: 2, state: { stage: 'audio' } }
    expect(() => validateProducerCheckpoint({ revision: 1, checkpoint: { stage: 'audio' } }, old)).toThrow('Stale')
    expect(() => validateProducerCheckpoint({ revision: 2, checkpoint: { stage: 'video' } }, old)).toThrow('already used')
    expect(validateProducerCheckpoint({ revision: 2, checkpoint: { stage: 'audio' } }, old).revision).toBe(2)
  })
  it('rejects missing or oversized checkpoint state', () => {
    expect(() => validateProducerCheckpoint({ revision: 1, checkpoint: null }, null)).toThrow()
    expect(() => validateProducerCheckpoint({ revision: 1, checkpoint: { big: 'x'.repeat(257000) } }, null)).toThrow()
  })
})
