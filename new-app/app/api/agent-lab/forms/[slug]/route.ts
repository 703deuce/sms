import { runnerFetch } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

/**
 * Public form endpoint for sites the agent built: POST /api/agent-lab/forms/<slug>
 * (<form method="post" action="/api/agent-lab/forms/<slug>">). Urlencoded or JSON, <= 32 KB.
 * Stored per site on the runner and the owner is notified in Agent Lab chat. Hidden field `_gotcha` = honeypot.
 */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

function thanks(ok: boolean, msg: string) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ok ? 'Thank you' : 'Sorry'}</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;text-align:center"><h1>${ok ? 'Thank you!' : 'Sorry'}</h1><p>${msg}</p><p><a href="javascript:history.back()">Back</a></p></body>`
  return new Response(html, { status: ok ? 200 : 400, headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const wantsHtml = (request.headers.get('accept') ?? '').includes('text/html')
  const reply = (status: number, body: Record<string, unknown>, msg: string) =>
    wantsHtml ? thanks(status === 200, status === 200 ? 'Your message was sent.' : msg) : Response.json(body, { status, headers: CORS })
  try {
    const { slug } = await ctx.params
    const raw = await request.text()
    if (raw.length > 32_768) return reply(413, { error: 'Too large' }, 'That message is too large.')
    const res = await runnerFetch(`/forms/${encodeURIComponent(slug)}`, {
      method: 'POST',
      headers: { 'Content-Type': request.headers.get('content-type') ?? 'text/plain' },
      body: raw,
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) return reply(res.status, { error: String(data.error ?? 'Failed') }, String(data.error ?? 'Could not send. Please try again.'))
    return reply(200, { ok: true }, '')
  } catch {
    return reply(502, { error: 'Unavailable' }, 'Could not send right now. Please try again later.')
  }
}
