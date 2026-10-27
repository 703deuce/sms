/** Session storage keys for Rooms prejoin → studio handoff. */

export type RoomsJoinPayload = {
  token: string
  url: string
  identity: string
  displayName: string
  role: string
  headphones: string
  micEnabled?: boolean
  camEnabled?: boolean
}

const joinKey = (sessionId: string) => `rooms:${sessionId}`
const hostKey = (sessionId: string) => `rooms:${sessionId}:isHost`
const pendingKey = (sessionId: string) => `rooms:${sessionId}:pending`

export function markSessionHost(sessionId: string) {
  sessionStorage.setItem(hostKey(sessionId), '1')
}

export function isSessionHostClient(sessionId: string): boolean {
  return sessionStorage.getItem(hostKey(sessionId)) === '1'
}

export function setPendingGuestPrejoin(sessionId: string, data: Omit<RoomsJoinPayload, 'headphones'>) {
  sessionStorage.setItem(pendingKey(sessionId), JSON.stringify({ ...data, headphones: 'yes' }))
}

export function readPendingGuestPrejoin(sessionId: string): RoomsJoinPayload | null {
  const raw = sessionStorage.getItem(pendingKey(sessionId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as RoomsJoinPayload
  } catch {
    return null
  }
}

export function clearPendingGuestPrejoin(sessionId: string) {
  sessionStorage.removeItem(pendingKey(sessionId))
}

export function writeJoinPayload(sessionId: string, payload: RoomsJoinPayload) {
  sessionStorage.setItem(joinKey(sessionId), JSON.stringify(payload))
}

export function readJoinPayload(sessionId: string): RoomsJoinPayload | null {
  const raw = sessionStorage.getItem(joinKey(sessionId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as RoomsJoinPayload
  } catch {
    return null
  }
}
