import 'server-only'
import { agentLabFetch, redactSecrets } from '@/lib/server/agent-lab'

/** Pages the agent publishes with `publish` live in /workspace/pages/<slug>/ on the agent server. */
export const PAGES_ROOT = '/workspace/pages'
export const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  json: 'application/json', md: 'text/plain; charset=utf-8', txt: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', pdf: 'application/pdf',
}

/**
 * Agent-made HTML is served sandboxed (opaque origin): scripts and charts run, but the page can't read
 * transovo.ai cookies or storage.
 */
const SANDBOX_CSP = 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads'

export async function servePageFile(slug: string, rel: string[]): Promise<Response> {
  if (!SLUG.test(slug)) return new Response('Not found', { status: 404 })
  if (rel.some((seg) => !seg || seg === '.' || seg === '..' || seg.includes('\0') || seg.includes('/') || seg.includes('\\'))) {
    return new Response('Not found', { status: 404 })
  }
  const file = rel.length ? rel.join('/') : 'index.html'
  const path = `${PAGES_ROOT}/${slug}/${file}`
  const res = await agentLabFetch(`/api/file/download?path=${encodeURIComponent(path)}`, { timeoutMs: 120_000 })
  if (!res.ok) return new Response('Not found', { status: 404 })
  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  const headers = new Headers({
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': SANDBOX_CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  })
  if (['html', 'css', 'js', 'json', 'md', 'txt', 'csv', 'svg'].includes(ext)) {
    let text = redactSecrets(await res.text())
    if (ext === 'html' && !/<base\s/i.test(text)) {
      const base = `<base href="/app/agent-lab/pages/${slug}/">`
      text = /<head[^>]*>/i.test(text) ? text.replace(/<head[^>]*>/i, (m) => `${m}${base}`) : `${base}${text}`
    }
    return new Response(text, { headers })
  }
  return new Response(res.body, { headers })
}

type PageEntry = { slug: string; title?: string; updated_at?: string; updatedAt?: string; created_at?: string }

export async function listPages(): Promise<PageEntry[]> {
  const res = await agentLabFetch(`/api/file/download?path=${encodeURIComponent(`${PAGES_ROOT}/index.json`)}`)
  if (!res.ok) return []
  const data = (await res.json().catch(() => null)) as unknown
  const raw = Array.isArray(data) ? data : data && typeof data === 'object' ? ((data as { pages?: unknown }).pages ?? Object.values(data)) : []
  return (Array.isArray(raw) ? raw : [])
    .filter((p): p is PageEntry => Boolean(p) && typeof (p as PageEntry).slug === 'string' && SLUG.test((p as PageEntry).slug))
    .slice(0, 500)
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

export async function pagesIndexResponse(): Promise<Response> {
  const pages = await listPages()
  const rows = pages
    .map((p) => {
      const when = p.updated_at ?? p.updatedAt ?? p.created_at ?? ''
      return `<li><a href="/app/agent-lab/pages/${p.slug}">${esc(redactSecrets(p.title || p.slug))}</a>${when ? ` <span>${esc(String(when))}</span>` : ''}</li>`
    })
    .join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agent Lab pages</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;color:#111}
a{color:#4f46e5}li{margin:6px 0}span{color:#888;font-size:12px;margin-left:6px}</style></head>
<body><h1>Agent Lab pages</h1>${rows ? `<ul>${rows}</ul>` : '<p>No pages published yet.</p>'}<p><a href="/app/agent-lab">Back to Agent Lab</a></p></body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } })
}
