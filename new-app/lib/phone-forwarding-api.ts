async function parse<T>(res: Response): Promise<T> {
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || res.statusText)
  return json.data as T
}

function headers(): HeadersInit {
  return { 'Content-Type': 'application/json' }
}

export type ForwardingDestinationDto = {
  id: string
  name: string
  phoneE164: string
  enabled: boolean
  press1Required: boolean
  screeningEnabled: boolean
  ringTimeoutSec: number
  lastTestedAt: string | null
}

export type ForwardingConfigDto = {
  destinations: ForwardingDestinationDto[]
  policies: Array<{ phoneNumberId: string; answeringMode: string; paused: boolean; primaryDestinationId: string | null }>
  policy: { phoneNumberId: string; answeringMode: string; paused: boolean; primaryDestinationId: string | null } | null
  numbers: Array<{ id: string; e164: string; friendlyName: string | null }>
  usage: {
    forwardedCalls: number
    bridgedMinutes: number
    missedCalls: number
  } | null
}

export async function fetchCallForwarding(phoneNumberId?: string) {
  const q = phoneNumberId ? `?phoneNumberId=${encodeURIComponent(phoneNumberId)}` : ''
  return parse<ForwardingConfigDto>(await fetch(`/api/phone/forwarding${q}`))
}

export async function saveAnsweringPolicy(phoneNumberId: string, patch: Record<string, unknown>) {
  return parse(
    await fetch('/api/phone/forwarding', {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ phoneNumberId, ...patch }),
    }),
  )
}

export async function createForwardingDestination(body: Record<string, unknown>) {
  return parse<ForwardingDestinationDto>(
    await fetch('/api/phone/forwarding/destinations', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    }),
  )
}

export async function patchForwardingDestination(id: string, patch: Record<string, unknown>) {
  return parse(
    await fetch(`/api/phone/forwarding/destinations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(patch),
    }),
  )
}

export async function deleteForwardingDestination(id: string) {
  return parse(
    await fetch(`/api/phone/forwarding/destinations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: headers(),
    }),
  )
}

export async function testForwardingDestination(destinationId: string, confirm = false) {
  return parse(
    await fetch('/api/phone/forwarding/test', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ destinationId, confirm }),
    }),
  )
}

export type AutoAttendantMenuDto = {
  id: string
  name: string
  description: string | null
  status: string
  options: Array<{ digit: string; label: string; actionType: string }>
  updatedAt: string
}

export async function fetchAutoAttendantMenus() {
  return parse<AutoAttendantMenuDto[]>(await fetch('/api/phone/auto-attendant'))
}

export async function createAutoAttendantMenu(name: string) {
  return parse<{ id: string }>(
    await fetch('/api/phone/auto-attendant', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name }),
    }),
  )
}

export async function fetchAutoAttendantMenu(id: string) {
  return parse<AutoAttendantMenuDto & { greetingText: string | null; options: unknown[] }>(
    await fetch(`/api/phone/auto-attendant/${encodeURIComponent(id)}`),
  )
}

export async function saveAutoAttendantMenu(id: string, patch: Record<string, unknown>) {
  return parse(
    await fetch(`/api/phone/auto-attendant/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(patch),
    }),
  )
}

export async function publishAutoAttendantMenu(id: string) {
  return parse(
    await fetch(`/api/phone/auto-attendant/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      headers: headers(),
    }),
  )
}

export async function duplicateAutoAttendantMenu(id: string) {
  return parse(
    await fetch(`/api/phone/auto-attendant/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
      headers: headers(),
    }),
  )
}
