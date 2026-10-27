/** LiveKit mic subscription permissions for Rooms producer / PTT (§24). */

export type ProducerSubscriptionInput = {
  localIdentity: string
  localRole: 'host' | 'guest' | 'producer' | string
  producerMode: boolean
  pttActive: boolean
  pttTargetIdentity: string | null
  participantIdentities: { identity: string; role: string }[]
}

export type ParticipantTrackPermission = {
  participantIdentity: string
  allowAll: boolean
  trackSids?: string[]
}

export type ProducerSubscriptionPlan = {
  allParticipantsAllowed: boolean
  participantTrackPermissions: ParticipantTrackPermission[]
}

function isProducerRole(role: string) {
  return role.toLowerCase() === 'producer'
}

/** Who may subscribe to the local participant's published tracks (mic). */
export function computeLocalPublishSubscriptionPermissions(
  input: ProducerSubscriptionInput,
): ProducerSubscriptionPlan {
  const producers = input.participantIdentities
    .filter((p) => isProducerRole(p.role))
    .map((p) => p.identity)
  const host = input.participantIdentities.find((p) => p.role.toLowerCase() === 'host')?.identity

  const inProducerMode =
    input.producerMode || isProducerRole(input.localRole) || input.pttActive

  if (!inProducerMode) {
    return { allParticipantsAllowed: true, participantTrackPermissions: [] }
  }

  const allowed = new Set<string>()
  for (const id of producers) allowed.add(id)
  if (host) allowed.add(host)
  if (input.pttActive && input.pttTargetIdentity) allowed.add(input.pttTargetIdentity)
  allowed.delete(input.localIdentity)

  if (allowed.size === 0) {
    return { allParticipantsAllowed: false, participantTrackPermissions: [] }
  }

  return {
    allParticipantsAllowed: false,
    participantTrackPermissions: [...allowed].map((participantIdentity) => ({
      participantIdentity,
      allowAll: true,
    })),
  }
}

/** When listening as a guest: optionally restrict whose audio we subscribe to (producer talkback). */
export function computeLocalSubscribeFilter(input: {
  localRole: string
  producerMode: boolean
  pttSpeakerIdentity: string | null
}): { subscribeToProducersOnly: boolean } {
  const isProducer = isProducerRole(input.localRole) || input.producerMode
  return { subscribeToProducersOnly: isProducer && Boolean(input.pttSpeakerIdentity) }
}
