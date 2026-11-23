import { AgentLabError, agentLabErrorResponse, agentLabFetch, agentLabJson } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

/**
 * Agent Lab vault: the agent server's encrypted secrets store (OpenHands FileSecretsStore, encrypted with its
 * OH_SECRET_KEY). Values are write-only from here: this route lists names and descriptions, adds or replaces a
 * value, and deletes; it never returns, logs or echoes a value. Conversations receive vault entries as lazy
 * LookupSecret references, so MCP servers can use `${NAME}` without the value passing through the page.
 */
const NAME = /^[A-Z][A-Z0-9_]{1,63}$/
const MAX_VALUE = 20_000

type SecretsList = { secrets?: { name: string; description?: string | null }[] }

export async function GET() {
  try {
    const data = await agentLabJson<SecretsList>('/api/settings/secrets')
    const secrets = (data.secrets ?? []).map((s) => ({ name: s.name, description: s.description ?? '' }))
    return Response.json({ secrets })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}

/** Add or replace one secret: `{ name, value, description? }`. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { name?: unknown; value?: unknown; description?: unknown }
    const name = typeof body.name === 'string' ? body.name.trim().toUpperCase() : ''
    const value = typeof body.value === 'string' ? body.value.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 300) : ''
    if (!NAME.test(name)) return Response.json({ error: 'Name must be UPPER_SNAKE_CASE (letters, digits, _), 2-64 chars' }, { status: 400 })
    if (!value) return Response.json({ error: 'Value is required' }, { status: 400 })
    if (value.length > MAX_VALUE) return Response.json({ error: 'Value is too long' }, { status: 400 })
    const res = await agentLabFetch('/api/settings/secrets', {
      method: 'PUT',
      body: JSON.stringify({ name, value, description: description || null }),
    })
    // never forward the server's error body: a validation error can echo the submitted value
    if (!res.ok) throw new AgentLabError(`Could not save the secret (agent server ${res.status})`, res.status >= 500 ? 502 : 400)
    return Response.json({ ok: true, name })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}

/** Delete one secret: `?name=NAME`. */
export async function DELETE(request: Request) {
  try {
    const name = (new URL(request.url).searchParams.get('name') ?? '').trim()
    if (!NAME.test(name)) return Response.json({ error: 'Invalid name' }, { status: 400 })
    const res = await agentLabFetch(`/api/settings/secrets/${encodeURIComponent(name)}`, { method: 'DELETE' })
    if (!res.ok) throw new AgentLabError(res.status === 404 ? 'No secret with that name' : `Delete failed (agent server ${res.status})`, res.status === 404 ? 404 : 502)
    return Response.json({ ok: true })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
