import { describe, expect, it } from 'vitest'
import { computeLocalPublishSubscriptionPermissions } from '@/lib/recording/producer-subscriptions'

describe('producer subscription permissions', () => {
  const people = [
    { identity: 'host1', role: 'host' },
    { identity: 'prod1', role: 'producer' },
    { identity: 'guest1', role: 'guest' },
  ]

  it('allows everyone when not in producer mode', () => {
    const plan = computeLocalPublishSubscriptionPermissions({
      localIdentity: 'guest1',
      localRole: 'guest',
      producerMode: false,
      pttActive: false,
      pttTargetIdentity: null,
      participantIdentities: people,
    })
    expect(plan.allParticipantsAllowed).toBe(true)
    expect(plan.participantTrackPermissions).toHaveLength(0)
  })

  it('restricts mic to producers and host when producer mode', () => {
    const plan = computeLocalPublishSubscriptionPermissions({
      localIdentity: 'prod1',
      localRole: 'producer',
      producerMode: true,
      pttActive: false,
      pttTargetIdentity: null,
      participantIdentities: people,
    })
    expect(plan.allParticipantsAllowed).toBe(false)
    const ids = plan.participantTrackPermissions.map((p) => p.participantIdentity).sort()
    expect(ids).toEqual(['host1'])
  })

  it('adds PTT target to allowed subscribers', () => {
    const plan = computeLocalPublishSubscriptionPermissions({
      localIdentity: 'prod1',
      localRole: 'producer',
      producerMode: true,
      pttActive: true,
      pttTargetIdentity: 'guest1',
      participantIdentities: people,
    })
    const ids = plan.participantTrackPermissions.map((p) => p.participantIdentity).sort()
    expect(ids.sort()).toEqual(['guest1', 'host1'])
  })
})
