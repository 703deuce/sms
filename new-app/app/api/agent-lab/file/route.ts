import { agentLabErrorResponse, agentLabFetch, redactSecrets, safeWorkspacePath } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

const TYPES: Record<string, string> = {
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4',
  srt: 'text/plain; charset=utf-8', vtt: 'text/vtt', md: 'text/plain; charset=utf-8', txt: 'text/plain; charset=utf-8',
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf', zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ppt: 'application/vnd.ms-powerpoint',
}

/** Streams one file from the agent's project folder (Range supported so videos can seek). */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const path = safeWorkspacePath(url.searchParams.get('path'))
    if (!path) return Response.json({ error: 'Invalid path' }, { status: 400 })
    const headers: Record<string, string> = {}
    const range = request.headers.get('range')
    const isText = /\.(srt|vtt|md|txt|json)$/i.test(path)
    if (range && !isText) headers.Range = range
    const res = await agentLabFetch(`/api/file/download?path=${encodeURIComponent(path)}`, { headers, timeoutMs: 300_000 })
    if (!res.ok) return Response.json({ error: `File not available (${res.status})` }, { status: res.status === 404 ? 404 : 502 })
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    const out = new Headers()
    out.set('Content-Type', TYPES[ext] ?? 'application/octet-stream')
    out.set('Cache-Control', 'private, no-store')
    const name = (path.split('/').pop() ?? 'file').replace(/[^\w.\-]/g, '_')
    out.set('Content-Disposition', `${url.searchParams.get('download') ? 'attachment' : 'inline'}; filename="${name}"`)
    for (const h of ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const v = res.headers.get(h)
      if (v) out.set(h, v)
    }
    if (isText && res.status === 200) {
      // Text files pass through the same secret filter as chat messages.
      const text = redactSecrets(await res.text())
      out.delete('content-length')
      out.delete('content-range')
      out.delete('accept-ranges')
      return new Response(text, { status: 200, headers: out })
    }
    return new Response(res.body, { status: res.status, headers: out })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
