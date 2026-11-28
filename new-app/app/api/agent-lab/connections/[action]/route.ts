import { agentLabErrorResponse, runnerFetch, runnerJson } from '@/lib/server/agent-lab'
import { clientIp, rateLimit, rateLimitedResponse } from '@/lib/server/agent-lab-rate-limit'

export const dynamic = 'force-dynamic'

const TOOLKIT = /^[A-Za-z0-9_-]{1,80}$/
const ACTIONS = new Set(['connected', 'auth-fields', 'link', 'connect', 'disconnect', 'trigger-pause', 'trigger-retry'])

function toolkitOf(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase()
  return TOOLKIT.test(s) ? s : null
}

function limitFor(action: string): number {
  if (action === 'connected') return 30
  if (action === 'auth-fields') return 20
  return 8
}

function limited(request: Request, action: string): Response | null {
  if (!rateLimit(`${clientIp(request)}:${action}`, limitFor(action))) return rateLimitedResponse()
  return null
}

function runnerError(status: number, data: { error?: string }): Response {
  const message = String(data.error || 'Request failed').slice(0, 300)
  return Response.json({ error: message }, { status: status >= 500 ? 502 : status })
}

export async function GET(request: Request, ctx: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await ctx.params
    if (!ACTIONS.has(action)) return Response.json({ error: 'Not found' }, { status: 404 })
    const blocked = limited(request, action)
    if (blocked) return blocked
    if (action === 'connected') {
      return Response.json(await runnerJson('/connectors/connected', { timeoutMs: 30_000 }))
    }
    if (action === 'auth-fields') {
      const toolkit = toolkitOf(new URL(request.url).searchParams.get('toolkit'))
      if (!toolkit) return Response.json({ error: 'Invalid app' }, { status: 400 })
      return Response.json(
        await runnerJson(`/connectors/auth-fields?toolkit=${encodeURIComponent(toolkit)}`, { timeoutMs: 30_000 }),
      )
    }
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await ctx.params
    if (!ACTIONS.has(action)) return Response.json({ error: 'Not found' }, { status: 404 })
    const blocked = limited(request, action)
    if (blocked) return blocked
    if (action === 'connected' || action === 'auth-fields') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return Response.json({ error: 'Invalid request' }, { status: 400 })

    if (action === 'trigger-pause') {
      const triggerId = String(body.trigger_id ?? '')
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(triggerId)) return Response.json({ error: 'Invalid trigger' }, { status: 400 })
      const res = await runnerFetch('/connectors/trigger-pause', {
        method: 'POST',
        body: JSON.stringify({ trigger_id: triggerId, paused: Boolean(body.paused) }),
        timeoutMs: 30_000,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean }
      if (!res.ok) return runnerError(res.status, data)
      return Response.json({ ok: true, trigger_id: triggerId, paused: Boolean(body.paused) })
    }

    if (action === 'trigger-retry') {
      const eventId = Number(body.event_id)
      if (!Number.isInteger(eventId) || eventId <= 0) return Response.json({ error: 'Invalid event' }, { status: 400 })
      const res = await runnerFetch('/connectors/trigger-retry', {
        method: 'POST',
        body: JSON.stringify({ event_id: eventId }),
        timeoutMs: 20_000,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean }
      if (!res.ok) return runnerError(res.status, data)
      return Response.json({ ok: true, event_id: eventId })
    }

    const toolkit = toolkitOf(body.toolkit)
    if (!toolkit) return Response.json({ error: 'Invalid app' }, { status: 400 })

    if (action === 'link') {
      const res = await runnerFetch('/connectors/link', {
        method: 'POST',
        body: JSON.stringify({ toolkit }),
        timeoutMs: 45_000,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; url?: string }
      if (!res.ok) return runnerError(res.status, data)
      if (typeof data.url !== 'string' || !data.url.startsWith('https://')) {
        return Response.json({ error: data.error || 'Could not get a connect link' }, { status: 409 })
      }
      return Response.json({ url: data.url, toolkit, via: 'connector' })
    }

    if (action === 'disconnect') {
      return Response.json(
        await runnerJson('/connectors/disconnect', {
          method: 'POST',
          body: JSON.stringify({ toolkit }),
          timeoutMs: 30_000,
        }),
      )
    }

    if (action === 'connect') {
      const rawFields = body.fields
      if (!rawFields || typeof rawFields !== 'object' || Array.isArray(rawFields)) {
        return Response.json({ error: 'Missing fields' }, { status: 400 })
      }
      const fields: Record<string, string> = {}
      for (const [k, v] of Object.entries(rawFields as Record<string, unknown>)) {
        if (!/^[A-Za-z0-9_]{1,80}$/.test(k)) return Response.json({ error: 'Invalid field name' }, { status: 400 })
        if (v == null) continue
        const s = String(v)
        if (s.length > 8000) return Response.json({ error: 'Value too long' }, { status: 400 })
        if (s.trim()) fields[k] = s
      }
      if (Object.keys(fields).length === 0) return Response.json({ error: 'Missing fields' }, { status: 400 })
      const res = await runnerFetch('/connectors/connect', {
        method: 'POST',
        body: JSON.stringify({ toolkit, fields }),
        timeoutMs: 45_000,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean; status?: string; toolkit?: string }
      if (!res.ok) return runnerError(res.status, data)
      return Response.json({ ok: true, toolkit: data.toolkit || toolkit, status: data.status, via: 'connector' })
    }

    return Response.json({ error: 'Not found' }, { status: 404 })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
